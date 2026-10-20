import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Automatic daily backup of the whole site database (orders, leads, emails,
// customers, products, settings) to <db folder>/backups/ttm-YYYY-MM-DD.db.
// Uses SQLite's online backup API on a separate read-only connection, so it is
// consistent while the site keeps serving. The last KEEP days are kept.

const KEEP = 14;
const CHECK_EVERY_MS = 60 * 60 * 1000; // look once an hour; back up once a day

function dbPath(): string | null {
  const raw = process.env.DATABASE_URL || "file:.data/ttm.db";
  if (raw === ":memory:") return null;
  const p = raw.replace(/^file:/, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) return null;
  return p;
}

export function backupDir(): string | null {
  const p = dbPath();
  return p ? path.join(path.dirname(p), "backups") : null;
}

export interface BackupFile { name: string; bytes: number; createdAt: number }

export function listBackups(): BackupFile[] {
  const dir = backupDir();
  if (!dir || !fs.existsSync(/* turbopackIgnore: true */ dir)) return [];
  return fs.readdirSync(/* turbopackIgnore: true */ dir)
    .filter((f) => /^ttm-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .map((f) => {
      const st = fs.statSync(/* turbopackIgnore: true */ path.join(dir, f));
      return { name: f, bytes: st.size, createdAt: st.mtimeMs };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" }); // YYYY-MM-DD

let running = false;
export async function backupNow(): Promise<BackupFile | null> {
  const src = dbPath();
  const dir = backupDir();
  if (!src || !dir || !fs.existsSync(/* turbopackIgnore: true */ src) || running) return null;
  running = true;
  try {
    fs.mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true, mode: 0o700 });
    const name = `ttm-${today()}.db`;
    const dest = path.join(dir, name);
    const tmp = `${dest}.part`;
    const db = new Database(/* turbopackIgnore: true */ src, { readonly: true, fileMustExist: true });
    try {
      await db.backup(tmp);
    } finally {
      db.close();
    }
    fs.renameSync(/* turbopackIgnore: true */ tmp, dest);
    try { fs.chmodSync(/* turbopackIgnore: true */ dest, 0o600); } catch { /* best effort */ }
    for (const old of listBackups().slice(KEEP)) {
      try { fs.unlinkSync(/* turbopackIgnore: true */ path.join(dir, old.name)); } catch { /* ignore */ }
    }
    const st = fs.statSync(/* turbopackIgnore: true */ dest);
    console.log(`[backup] saved ${name} (${Math.round(st.size / 1024)} KB)`);
    return { name, bytes: st.size, createdAt: st.mtimeMs };
  } catch (e) {
    console.error("[backup] failed:", (e as Error).message);
    return null;
  } finally {
    running = false;
  }
}

/** Called once at server start: back up now if today's copy is missing, then
 *  check hourly. */
export function startBackups(): void {
  const g = globalThis as unknown as { __ttmBackups?: boolean };
  if (g.__ttmBackups || !dbPath()) return;
  g.__ttmBackups = true;
  const tick = () => {
    const have = listBackups().some((b) => b.name === `ttm-${today()}.db`);
    if (!have) void backupNow();
  };
  setTimeout(tick, 60_000).unref(); // let the site finish starting first
  setInterval(tick, CHECK_EVERY_MS).unref();
}
