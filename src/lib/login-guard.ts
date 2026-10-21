import "server-only";
import type { NextRequest } from "next/server";
import { libsql } from "./db";
import { visitorIp } from "./geo";

// Brute-force / bot protection for the admin login. Attempts are recorded in
// the DB (Turso) so the limit holds across serverless instances — an in-memory
// counter would reset on every cold start and give bots a free pass.

const WINDOW_MS = 15 * 60 * 1000; // rolling window
const MAX_FAILS = 8; // failed attempts per IP per window before lock-out
const LOCK_SECONDS = 15 * 60;

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    ts INTEGER NOT NULL
  )`);
  ensured = true;
}

/** The visitor's real address. nginx sets X-Real-IP to the connecting address,
 *  which can't be faked; the FIRST X-Forwarded-For entry can be typed in by the
 *  visitor (that let attackers dodge the lock-out), so it's never used. */
export function clientIp(req: NextRequest): string {
  return visitorIp(req.headers) || "unknown";
}

/** How many failed attempts this IP has in the current window, and whether it's locked. */
export async function loginStatus(ip: string): Promise<{ locked: boolean; fails: number; retryAfter: number }> {
  try {
    await ensureTable();
    const since = Date.now() - WINDOW_MS;
    // prune old rows opportunistically
    await libsql.execute({ sql: "DELETE FROM login_attempts WHERE ts < ?", args: [since] });
    const res = await libsql.execute({ sql: "SELECT COUNT(*) c FROM login_attempts WHERE ip = ? AND ok = 0 AND ts > ?", args: [ip, since] });
    const fails = Number(res.rows[0].c) || 0;
    return { locked: fails >= MAX_FAILS, fails, retryAfter: LOCK_SECONDS };
  } catch (e) {
    console.error("[login-guard] status failed:", (e as Error).message);
    return { locked: false, fails: 0, retryAfter: 0 }; // fail open (don't lock out real staff on a DB blip)
  }
}

/** Record an attempt. A successful login clears this IP's failure history. */
export async function recordAttempt(ip: string, ok: boolean): Promise<void> {
  try {
    await ensureTable();
    if (ok) {
      await libsql.execute({ sql: "DELETE FROM login_attempts WHERE ip = ?", args: [ip] });
      return;
    }
    await libsql.execute({ sql: "INSERT INTO login_attempts (ip, ok, ts) VALUES (?, 0, ?)", args: [ip, Date.now()] });
  } catch (e) {
    console.error("[login-guard] record failed:", (e as Error).message);
  }
}
