// PostgreSQL de verdade (o banco da loja publicada), rodando dentro do próprio teste.
//
// Por que existe: até aqui todos os testes de banco usavam SQLite, que executa o esquema de uma vez só.
// O PostgreSQL recebe comando por comando, separados por ponto e vírgula — um detalhe de escrita que o
// SQLite perdoa derruba a subida no Render, e isso só apareceria no deploy. Este teste roda o mesmo
// caminho da produção: esquema, colunas acrescentadas depois, trava de concorrência, dados de exemplo
// e as consultas do site.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = 54329;
let server: PGLiteSocketServer;
let db: typeof import("../lib/db");

before(async () => {
  const pg = await PGlite.create();
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  Object.assign(process.env, {
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`,
    SEED_DEMO: "1",
  });
  delete (process.env as Record<string, string | undefined>).SQLITE_PATH;
  db = await import("../lib/db");
});

after(async () => { await server?.stop(); });

test("o esquema sobe inteiro num PostgreSQL de verdade", async () => {
  assert.equal(await db.dbMode(), "pg", "deveria estar no PostgreSQL, não no banco de reserva");
  const tabelas = (await db.q<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1",
  )).map((r) => r.table_name);
  for (const t of ["cash_entries", "costs", "customers", "leads", "meta", "sales", "tasks", "vehicles"]) {
    assert.ok(tabelas.includes(t), `faltou a tabela ${t}`);
  }
});

test("os índices das buscas frequentes existem", async () => {
  const idx = (await db.q<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'ix_%' ORDER BY 1",
  )).map((r) => r.indexname);
  for (const i of ["ix_costs_vehicle", "ix_leads_phone", "ix_tasks_agenda", "ix_vehicles_vitrine"]) {
    assert.ok(idx.includes(i), `faltou o índice ${i}`);
  }
});

test("as colunas acrescentadas depois da primeira versão estão lá", async () => {
  const cols = (await db.q<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles'",
  )).map((r) => r.column_name);
  for (const c of ["kind", "featured", "photo_credit"]) assert.ok(cols.includes(c), `faltou a coluna ${c}`);
});

test("os dados de exemplo entram e a vitrine do site responde", async () => {
  const [{ n }] = await db.q<{ n: number }>("SELECT COUNT(*) AS n FROM vehicles");
  assert.equal(Number(n), 60);
  const data = await import("../lib/data");
  const vitrine = await data.publicVehicles({ kind: "carro", trans: "Automático" });
  assert.ok(vitrine.length > 3, "a vitrine veio vazia no PostgreSQL");
  assert.ok(vitrine.every((v) => v.kind === "carro" && v.transmission === "Automático"));
  assert.ok(vitrine.every((v) => v.photoList.length >= 0 && typeof v.analysis.profit === "number"));
});

test("gravar e ler um lead funciona com os mesmos comandos do site", async () => {
  const data = await import("../lib/data");
  const fone = `(51) 98${String(Date.now()).slice(-7)}`;
  const id = await data.createLead({ vehicle_id: null, name: "Teste Postgres", phone: fone, message: "oi", source: "site" });
  assert.ok(id > 0);
  assert.equal(await data.findRecentLead(fone, null, "site"), id);
  await data.appendLeadMessage(id, "segunda mensagem");
  const [lead] = await db.q<{ message: string }>("SELECT message FROM leads WHERE id = $1", [id]);
  assert.match(lead.message, /segunda mensagem/);
});
