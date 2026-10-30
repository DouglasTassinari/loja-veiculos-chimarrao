// Demonstração: se o PostgreSQL (grátis, vence em 30 dias) estiver fora, o site segue no ar com um banco de reserva.
import { test } from "node:test";
import assert from "node:assert/strict";

Object.assign(process.env, { DATABASE_URL: "postgres://nao:existe@127.0.0.1:1/nada", SEED_DEMO: "1" });
delete (process.env as Record<string, string | undefined>).SQLITE_PATH;

test("sem PostgreSQL, a demonstração usa o banco de reserva com os dados de exemplo", async () => {
  const { q, dbMode } = await import("../lib/db");
  const [{ n }] = await q<{ n: number }>("SELECT COUNT(*) AS n FROM vehicles");
  assert.ok(Number(n) >= 40, `esperava o catálogo de exemplo, veio ${n}`);
  assert.equal(await dbMode(), "reserva");
  // continua gravando (leads da demonstração) enquanto o PostgreSQL não volta
  const nome = `Teste Reserva ${Date.now()}`; // o arquivo temporário sobrevive entre execuções
  await q("INSERT INTO leads (name, phone, message, source, status, created_at, updated_at) VALUES ($1, $2, $3, $4, 'novo', $5, $5)", [nome, "(51) 98000-1111", "", "site", "2026-10-30 10:00:00"]);
  const [{ c }] = await q<{ c: number }>("SELECT COUNT(*) AS c FROM leads WHERE name = $1", [nome]);
  assert.equal(Number(c), 1);
});
