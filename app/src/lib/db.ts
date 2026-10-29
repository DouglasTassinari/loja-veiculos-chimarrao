import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { seed } from "./seed";

// Dois bancos, um só SQL:
//  - DATABASE_URL definido  -> PostgreSQL (produção, Vercel/Neon/Supabase)
//  - sem DATABASE_URL       -> SQLite local em data/loja.db (desenvolvimento)
// As consultas usam placeholders $1, $2… e só tipos que existem nos dois.
export type Row = Record<string, unknown>;
export type QueryFn = (sql: string, params?: unknown[]) => Promise<Row[]>;

type Conn = { query: QueryFn; dialect: "pg" | "sqlite" };

const globalForDb = globalThis as unknown as { __conn?: Promise<Conn> };

const schema = `
  CREATE TABLE IF NOT EXISTS vehicles (
    id {ID},
    slug TEXT UNIQUE NOT NULL,
    plate TEXT NOT NULL,
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
`;

const shouldSeed = () => process.env.NODE_ENV !== "production" || process.env.SEED_DEMO === "1";

async function openPg(url: string): Promise<Conn> {
  // max 1 e prepare:false: funciona com poolers (Neon/Supabase) em funções serverless.
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, onnotice: () => {} });
  const query: QueryFn = async (text, params = []) => (await sql.unsafe(text, params as never[])) as unknown as Row[];
  for (const stmt of schema.replace(/\{ID\}/g, "SERIAL PRIMARY KEY").split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.unsafe(stmt);
  }
  if (shouldSeed()) {
    await sql.begin(async (tx) => {
      await tx.unsafe("SELECT pg_advisory_xact_lock(731100)"); // evita semear em dobro com várias instâncias subindo juntas
      const [{ n }] = (await tx.unsafe("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM vehicles")) as unknown as { n: number }[];
      if (n === 0) await seed(async (t, p = []) => (await tx.unsafe(t, p as never[])) as unknown as Row[]);
    });
  }
  return { query, dialect: "pg" };
}

async function openSqlite(): Promise<Conn> {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "loja.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(schema.replace(/\{ID\}/g, "INTEGER PRIMARY KEY AUTOINCREMENT"));
  const query: QueryFn = async (text, params = []) => {
    const stmt = db.prepare(text.replace(/\$(\d+)/g, "?$1"));
    const rows = stmt.all(...(params as never[]));
    return rows as unknown as Row[];
  };
  if (shouldSeed()) {
    const [{ n }] = (await query("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM vehicles")) as { n: number }[];
    if (n === 0) await seed(query);
  }
  return { query, dialect: "sqlite" };
}

function connect(): Promise<Conn> {
  const url = process.env.DATABASE_URL;
  return url ? openPg(url) : openSqlite();
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!globalForDb.__conn) {
    globalForDb.__conn = connect().catch((e) => {
      globalForDb.__conn = undefined; // tenta de novo na próxima requisição
      throw e;
    });
  }
  return (await (await globalForDb.__conn).query(text, params)) as unknown as T[];
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}
