import "server-only";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { seed, SEED_VERSION } from "./seed";

// Dois bancos, um só SQL:
//  - DATABASE_URL definido  -> PostgreSQL (produção, Render/Neon/Supabase)
//  - sem DATABASE_URL       -> SQLite local em data/loja.db (desenvolvimento)
// As consultas usam placeholders $1, $2… e só tipos que existem nos dois.
export type Row = Record<string, unknown>;
export type QueryFn = (sql: string, params?: unknown[]) => Promise<Row[]>;

// reserveRetryAt: só no banco de reserva (ver connect): quando tentar o PostgreSQL de novo.
type Conn = { query: QueryFn; dialect: "pg" | "sqlite"; reserveRetryAt?: number };

const globalForDb = globalThis as unknown as { __conn?: Promise<Conn> };

const schema = `
  CREATE TABLE IF NOT EXISTS vehicles (
    id {ID},
    slug TEXT UNIQUE NOT NULL,
    plate TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'carro',
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT 'Hatch',
    year_fab INTEGER NOT NULL,
    year_model INTEGER NOT NULL,
    km INTEGER NOT NULL DEFAULT 0,
    fuel TEXT NOT NULL DEFAULT 'Flex',
    transmission TEXT NOT NULL DEFAULT 'Manual',
    color TEXT NOT NULL DEFAULT '',
    doors INTEGER NOT NULL DEFAULT 4,
    engine TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'preparacao',
    published INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    single_owner INTEGER NOT NULL DEFAULT 0,
    inspected INTEGER NOT NULL DEFAULT 0,
    factory_warranty_until INTEGER,
    purchase_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    asking_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    fipe_price DOUBLE PRECISION,
    min_price DOUBLE PRECISION,
    sale_price DOUBLE PRECISION,
    sale_date TEXT,
    ready_date TEXT,
    photos TEXT NOT NULL DEFAULT '[]',
    photo_credit TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS costs (
    id {ID},
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id {ID},
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'site',
    status TEXT NOT NULL DEFAULT 'novo',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cash_entries (
    id {ID},
    kind TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    due_date TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customers (
    id {ID},
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    birthday TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'loja',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sales (
    id {ID},
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    vehicle_title TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    lead_id INTEGER,
    sale_date TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    payment TEXT NOT NULL DEFAULT 'avista',
    down DOUBLE PRECISION NOT NULL DEFAULT 0,
    financed DOUBLE PRECISION NOT NULL DEFAULT 0,
    months INTEGER NOT NULL DEFAULT 0,
    parcel DOUBLE PRECISION NOT NULL DEFAULT 0,
    bank TEXT NOT NULL DEFAULT '',
    trade_desc TEXT NOT NULL DEFAULT '',
    trade_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id {ID},
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    vehicle_id INTEGER,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    lead_id INTEGER,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    done_at TEXT,
    created_at TEXT NOT NULL
  );
`;

// Colunas acrescentadas depois da primeira versão. Bancos já existentes recebem aqui.
const addedColumns: [string, string, string][] = [
  ["vehicles", "kind", "TEXT NOT NULL DEFAULT 'carro'"],
  ["vehicles", "featured", "INTEGER NOT NULL DEFAULT 0"],
  ["vehicles", "photo_credit", "TEXT NOT NULL DEFAULT '[]'"],
  ["leads", "customer_id", "INTEGER"],
  ["leads", "updated_at", "TEXT NOT NULL DEFAULT ''"],
];

// Dados de demonstração: só em desenvolvimento ou com SEED_DEMO=1 (nunca na loja real).
const demoEnabled = () => process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";

async function prepareDemo(q: QueryFn, dialect: "pg" | "sqlite") {
  if (!demoEnabled()) return;
  const meta = await q("SELECT value FROM meta WHERE key = 'seed_version'");
  if (meta[0]?.value === SEED_VERSION) return;
  // Versão do catálogo mudou (ou banco antigo sem versão): refaz os dados de exemplo.
  if (dialect === "pg") await q("TRUNCATE tasks, sales, customers, cash_entries, leads, costs, vehicles RESTART IDENTITY CASCADE");
  else {
    for (const t of ["tasks", "sales", "customers", "cash_entries", "leads", "costs", "vehicles"]) await q(`DELETE FROM ${t}`);
    await q("DELETE FROM sqlite_sequence");
  }
  await seed(q);
  await q("DELETE FROM meta WHERE key = 'seed_version'");
  await q("INSERT INTO meta (key, value) VALUES ('seed_version', $1)", [SEED_VERSION]);
}

async function openPg(url: string): Promise<Conn> {
  // max 1 e prepare:false: funciona com poolers (Neon/Supabase) em funções serverless.
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 8, onnotice: () => {} });
  try {
    return await prepararPg(sql);
  } catch (e) {
    await sql.end({ timeout: 1 }).catch(() => {});
    throw e;
  }
}

async function prepararPg(sql: ReturnType<typeof postgres>): Promise<Conn> {
  const query: QueryFn = async (text, params = []) => (await sql.unsafe(text, params as never[])) as unknown as Row[];
  for (const stmt of schema.replace(/\{ID\}/g, "SERIAL PRIMARY KEY").split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.unsafe(stmt);
  }
  for (const [table, col, ddl] of addedColumns) await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${ddl}`);
  if (demoEnabled()) {
    await sql.begin(async (tx) => {
      await tx.unsafe("SELECT pg_advisory_xact_lock(731100)"); // evita semear em dobro com várias instâncias subindo juntas
      await prepareDemo(async (t, p = []) => (await tx.unsafe(t, p as never[])) as unknown as Row[], "pg");
    });
  }
  return { query, dialect: "pg" };
}

async function openSqlite(arquivo?: string): Promise<Conn> {
  const { DatabaseSync } = await import("node:sqlite");
  // SQLITE_PATH permite usar um arquivo próprio (testes automáticos usam um temporário).
  const file = arquivo ?? process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "loja.db");
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(schema.replace(/\{ID\}/g, "INTEGER PRIMARY KEY AUTOINCREMENT"));
  for (const [table, col, ddl] of addedColumns) {
    const have = new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
    if (!have.has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
  const query: QueryFn = async (text, params = []) => {
    const stmt = db.prepare(text.replace(/\$(\d+)/g, "?$1"));
    const rows = stmt.all(...(params as never[]));
    return rows as unknown as Row[];
  };
  await prepareDemo(query, "sqlite");
  return { query, dialect: "sqlite" };
}

const RESERVE_RETRY_MS = 5 * 60_000;

async function connect(): Promise<Conn> {
  const url = process.env.DATABASE_URL;
  if (!url) return openSqlite();
  try {
    return await openPg(url);
  } catch (e) {
    // Só na demonstração: se o PostgreSQL grátis do Render vencer ou cair, o site continua no ar com um banco
    // temporário (dados de exemplo refeitos). Na loja real isto NÃO acontece: o erro aparece, para nunca
    // gravar venda e cliente reais num banco que se apaga sozinho.
    if (!demoEnabled()) throw e;
    console.error("[db] PostgreSQL indisponível, usando o banco de reserva temporário (demonstração):", (e as Error).message);
    const reserva = await openSqlite(path.join(os.tmpdir(), "chimarrao-reserva.db"));
    return { ...reserva, reserveRetryAt: Date.now() + RESERVE_RETRY_MS };
  }
}

// "pg", "sqlite" ou "reserva" (demonstração rodando sem o PostgreSQL); usado em /saude.
export async function dbMode(): Promise<"pg" | "sqlite" | "reserva"> {
  const c = await (globalForDb.__conn ??= connect());
  return c.reserveRetryAt ? "reserva" : c.dialect;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!globalForDb.__conn) {
    globalForDb.__conn = connect().catch((e) => {
      globalForDb.__conn = undefined; // tenta de novo na próxima requisição
      throw e;
    });
  }
  const conn = await globalForDb.__conn;
  if (conn.reserveRetryAt && Date.now() > conn.reserveRetryAt) {
    globalForDb.__conn = undefined; // de tempos em tempos tenta voltar ao PostgreSQL
    return q<T>(text, params);
  }
  return (await conn.query(text, params)) as unknown as T[];
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
