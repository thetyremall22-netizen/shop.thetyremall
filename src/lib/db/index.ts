import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Local embedded SQLite via better-sqlite3. It is SYNCHRONOUS with no background
// native threads (unlike @libsql/client's Rust/tokio runtime), which removes the
// V8-GC-vs-native segfaults the shared host observed and lets the worker shut
// down promptly. DATABASE_URL is a file path (optionally "file:"-prefixed);
// default .data/ttm.db. A remote URL (e.g. Turso libsql://) isn't supported by
// this driver and falls back to in-memory so boot never crashes.
function resolvePath(): string {
  const raw = process.env.DATABASE_URL || "file:.data/ttm.db";
  if (raw === ":memory:") return ":memory:";
  const p = raw.replace(/^file:/, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return ":memory:";
  return p;
}

function open(): Database.Database {
  try {
    const sdb = new Database(resolvePath());
    // Lean, durable-enough config for the memory-constrained shared host.
    sdb.pragma("journal_mode = WAL");
    sdb.pragma("synchronous = NORMAL");
    sdb.pragma("busy_timeout = 5000");
    sdb.pragma("cache_size = -8000"); // ~8 MB page cache cap
    sdb.pragma("wal_autocheckpoint = 400");
    return sdb;
  } catch {
    return new Database(":memory:");
  }
}

const sqlite = open();

export const db = drizzle(sqlite, { schema });
export { schema };

// Close on shutdown (instant for better-sqlite3) so the worker exits cleanly.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  try { process.once(sig, () => { try { sqlite.close(); } catch { /* already closed */ } }); } catch { /* no process */ }
}

// ---- libsql-compatible shim -------------------------------------------------
// The app has ~110 raw queries written against @libsql/client's
// `execute({ sql, args })` / `batch([...])` API returning `{ rows, lastInsertRowid }`.
// This preserves that exact surface so no caller changes. better-sqlite3 only
// binds numbers/strings/bigint/Buffer/null, so coerce booleans and undefined
// (which libsql accepted) to keep callers working.
type RawStmt = string | { sql: string; args?: readonly unknown[] };
interface ExecResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
  lastInsertRowid: number | bigint;
  columns: string[];
}

const isRead = (sql: string) => /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(sql);
const coerce = (v: unknown): unknown => (typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? null : v);

function runOne(stmt: RawStmt): ExecResult {
  const sql = typeof stmt === "string" ? stmt : stmt.sql;
  const args = ((typeof stmt === "string" ? [] : stmt.args ?? []) as unknown[]).map(coerce);
  if (isRead(sql)) {
    const rows = sqlite.prepare(sql).all(...args) as Record<string, unknown>[];
    return { rows, rowsAffected: 0, lastInsertRowid: 0, columns: rows.length ? Object.keys(rows[0]) : [] };
  }
  if (args.length === 0) {
    // DDL / no-param writes — exec() also handles multi-statement blocks.
    sqlite.exec(sql);
    return { rows: [], rowsAffected: 0, lastInsertRowid: 0, columns: [] };
  }
  const info = sqlite.prepare(sql).run(...args);
  return { rows: [], rowsAffected: info.changes, lastInsertRowid: info.lastInsertRowid, columns: [] };
}

export const libsql = {
  execute(stmt: RawStmt): Promise<ExecResult> {
    return Promise.resolve(runOne(stmt));
  },
  // Second arg is libsql's transaction mode ("write"/"read"/…) — ignored here;
  // better-sqlite3's transaction is already write-capable and atomic.
  batch(stmts: RawStmt[], _mode?: string): Promise<ExecResult[]> {
    void _mode;
    const tx = sqlite.transaction((items: RawStmt[]) => items.map(runOne));
    return Promise.resolve(tx(stmts));
  },
};
