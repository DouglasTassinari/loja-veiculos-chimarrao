import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { seed } from "./seed";

// SQLite embutido no Node para o MVP. A camada de acesso fica isolada em
// lib/data.ts, então a troca para PostgreSQL não mexe nas telas.
const globalForDb = globalThis as unknown as { __db?: DatabaseSync };

function open(): DatabaseSync {
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "loja.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      purchase_price REAL NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      asking_price REAL NOT NULL DEFAULT 0,
      fipe_price REAL,
      min_price REAL,
      sale_price REAL,
      sale_date TEXT,
      ready_date TEXT,
      photos TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'site',
      status TEXT NOT NULL DEFAULT 'novo',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cash_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,            -- 'receber' | 'pagar'
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL
    );
  `);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM vehicles").get() as { n: number };
  if (n === 0) seed(db);
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__db) globalForDb.__db = open();
  return globalForDb.__db;
}
