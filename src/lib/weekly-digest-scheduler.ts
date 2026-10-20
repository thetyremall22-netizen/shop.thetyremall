// Sends the weekly summary every Monday from 08:00 (Johannesburg time) inside
// the website process (the VPS has no cron). Checks hourly; the week it last
// sent is remembered in the database, so restarts never send it twice.
const EVERY_MS = 60 * 60 * 1000;

function sastNow(): { day: number; hour: number; monday: string } {
  const now = new Date(Date.now() + 2 * 3600_000); // SAST = UTC+2, no daylight saving
  const day = now.getUTCDay();
  const monday = new Date(now.getTime() - ((day + 6) % 7) * 86400_000).toISOString().slice(0, 10);
  return { day, hour: now.getUTCHours(), monday };
}

export function startWeeklyDigest(): void {
  const g = globalThis as unknown as { __ttmWeekly?: boolean };
  if (g.__ttmWeekly) return;
  g.__ttmWeekly = true;
  const tick = async () => {
    try {
      const { day, hour, monday } = sastNow();
      if (day !== 1 || hour < 8) return;
      const { libsql } = await import("./db");
      await libsql.execute(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
      const r = await libsql.execute({ sql: "SELECT value FROM meta WHERE key = 'weekly_digest_week'", args: [] });
      if (String(r.rows[0]?.value ?? "") === monday) return;
      // Claim the week first so two processes can't both send it.
      await libsql.execute({ sql: "INSERT INTO meta (key, value) VALUES ('weekly_digest_week', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [monday] });
      const { sendWeeklyDigest } = await import("./weekly-digest");
      const s = await sendWeeklyDigest();
      console.log(`[weekly] summary sent for week of ${monday} (stock ${s.stock}, leads ${s.leads})`);
    } catch (e) {
      console.error("[weekly] scheduler tick failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 150_000).unref();
  setInterval(tick, EVERY_MS).unref();
}
