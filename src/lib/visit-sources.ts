import "server-only";
import { libsql } from "./db";
import { classifyOrigin, originBucket, parseAttribution, BUCKETS, type Attribution, type Bucket } from "./attribution";

// Every visit to the shop, by where it came from (Google Ads, free Google
// listings, Google/Bing search, AI assistants…), so Admin → Traffic sources can
// show ad clicks per day next to orders and enquiries. One row per visit; no IP
// addresses or click ids are kept. Only real browsers are counted (the browser
// reports the visit), so crawlers and bots aren't.

const KEEP_DAYS = 400;
const SAST = 2 * 3600; // South Africa is UTC+2 all year

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS visit_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    bucket TEXT NOT NULL,
    source TEXT NOT NULL,
    landing TEXT NOT NULL DEFAULT '',
    device TEXT NOT NULL DEFAULT '',
    first_visit INTEGER NOT NULL DEFAULT 0
  )`);
  await libsql.execute("CREATE INDEX IF NOT EXISTS visit_sources_at ON visit_sources(at)");
  ensured = true;
}

/** Record one visit (never throws). */
export async function recordVisit(a: Attribution, firstVisit: boolean): Promise<void> {
  try {
    await ensureTable();
    const o = classifyOrigin(a);
    const landing = (a.touch.landing || "").split("?")[0].slice(0, 200);
    await libsql.execute({
      sql: "INSERT INTO visit_sources (at, bucket, source, landing, device, first_visit) VALUES (?,?,?,?,?,?)",
      args: [Date.now(), originBucket(o), o.source.slice(0, 80), landing, a.device ?? "", firstVisit ? 1 : 0],
    });
    if (Math.random() < 0.01) await libsql.execute({ sql: "DELETE FROM visit_sources WHERE at < ?", args: [Date.now() - KEEP_DAYS * 86400_000] });
  } catch (e) {
    console.error("[visits] not recorded:", (e as Error).message);
  }
}

export interface DayRow {
  day: string;                          // YYYY-MM-DD (South African time)
  visits: Record<Bucket, number>;
  total: number;
  orders: number;
  paid: number;
  leads: number;
}

export interface SourceRow { bucket: Bucket; visits: number; orders: number; paid: number; leads: number }

const PAID = new Set(["processing", "completed"]);
const dayOf = (ms: number) => new Date(ms + SAST * 1000).toISOString().slice(0, 10);
const zero = () => Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;

/** Visits, orders and leads per day and per source for the last `days` days. */
export async function trafficReport(days: number): Promise<{ daily: DayRow[]; bySource: SourceRow[]; since: number; trackingSince: number | null }> {
  await ensureTable();
  const todayStart = Date.parse(`${dayOf(Date.now())}T00:00:00Z`) - SAST * 1000;
  const since = todayStart - (days - 1) * 86400_000;

  const daily = new Map<string, DayRow>();
  for (let t = since; t <= todayStart; t += 86400_000) { const d = dayOf(t); daily.set(d, { day: d, visits: zero(), total: 0, orders: 0, paid: 0, leads: 0 }); }
  const bySource = new Map<Bucket, SourceRow>(BUCKETS.map((b) => [b, { bucket: b, visits: 0, orders: 0, paid: 0, leads: 0 }]));

  const v = await libsql.execute({
    sql: `SELECT date((at / 1000) + ${SAST}, 'unixepoch') d, bucket, COUNT(*) n FROM visit_sources WHERE at >= ? GROUP BY d, bucket`,
    args: [since],
  });
  for (const r of v.rows as Record<string, unknown>[]) {
    const row = daily.get(String(r.d)); const b = String(r.bucket) as Bucket; const n = Number(r.n);
    if (!row || !BUCKETS.includes(b)) continue;
    row.visits[b] += n; row.total += n; bySource.get(b)!.visits += n;
  }

  // Orders (staff test orders left out), credited by their own recorded source.
  const o = await libsql.execute({ sql: "SELECT created_at, status, attribution FROM orders WHERE created_at >= ?", args: [since] }).catch(() => ({ rows: [] }));
  for (const r of o.rows as Record<string, unknown>[]) {
    const a = parseAttribution(r.attribution);
    if (a?.staff) continue;
    const row = daily.get(dayOf(Number(r.created_at)));
    const paid = PAID.has(String(r.status));
    if (row) { row.orders++; if (paid) row.paid++; }
    if (a) { const s = bySource.get(originBucket(classifyOrigin(a)))!; s.orders++; if (paid) s.paid++; }
  }

  // Leads: website forms + enquiries (WhatsApp, Tyrone, call taps), not staff tests.
  for (const table of ["contacts", "enquiries"]) {
    const l = await libsql.execute({ sql: `SELECT created_at, attribution FROM ${table} WHERE created_at >= ? AND IFNULL(test,0) = 0`, args: [since] }).catch(() => ({ rows: [] }));
    for (const r of l.rows as Record<string, unknown>[]) {
      const row = daily.get(dayOf(Number(r.created_at)));
      if (row) row.leads++;
      const a = parseAttribution(r.attribution);
      if (a) bySource.get(originBucket(classifyOrigin(a)))!.leads++;
    }
  }

  const first = await libsql.execute("SELECT MIN(at) t FROM visit_sources");
  const trackingSince = first.rows[0]?.t == null ? null : Number(first.rows[0].t);
  return { daily: [...daily.values()].reverse(), bySource: [...bySource.values()], since, trackingSince };
}
