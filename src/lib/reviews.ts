import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

export interface Review {
  id: number;
  name: string;
  location: string;
  rating: number; // 1-5
  quote: string;
  source: string; // google | onsite
  verified: boolean;
  featured: boolean;
  sortOrder: number;
}

export interface RatingSummary {
  overall: number; // e.g. 4.8
  count: string; // e.g. "1,200+"
  sourceCopy: string; // e.g. "Verified Google & on-site reviews"
}

const DEFAULT_SUMMARY: RatingSummary = { overall: 4.8, count: "1,200+", sourceCopy: "Verified Google & on-site reviews" };
export const REVIEWS_TAG = "reviews";

// The testimonials the homepage shipped with — seeded once so nothing changes
// on day one, then fully editable in admin.
const SEED: { name: string; quote: string }[] = [
  { name: "Gavin Hancock", quote: "Two tyres delivered at no extra charge within 3–4 days. Best service ever." },
  { name: "Waheed Swales", quote: "Needed a specific tyre with fitment at my nearest branch — sorted swiftly. 3rd purchase, all smooth." },
  { name: "Morgan Malyon", quote: "Basically the cheapest option. Ordered late afternoon, delivered before 10am. Highly recommend!" },
  { name: "Gillian Cuturi", quote: "5-star service and price. Wonderful experience — went out of their way to help." },
  { name: "Mohammed Shah", quote: "Good prices, great service, and after-sales care to boot." },
  { name: "Jorge", quote: "Great prices and fast delivery. Kept updated via email. Supporting them over the overpriced shops." },
  { name: "Dwayne De Lange", quote: "Helped immediately and went over and above to get me the tyres I wanted. Thanks, guys!" },
];

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    rating INTEGER NOT NULL DEFAULT 5,
    quote TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'onsite',
    verified INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS review_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  // seed testimonials once
  // One statement, only while empty — parallel server processes can't double it.
  const now = Date.now();
  await libsql.execute({
    sql: `INSERT INTO reviews (name, location, rating, quote, source, verified, featured, sort_order, created_at)
          SELECT n, '', 5, q, 'google', 1, 1, s, ? FROM (${SEED.map(() => "SELECT ? AS n, ? AS q, ? AS s").join(" UNION ALL ")})
          WHERE NOT EXISTS (SELECT 1 FROM reviews)`,
    args: [now, ...SEED.flatMap((x, i) => [x.name, x.quote, i])],
  });
  ensured = true;
}

type Row = Record<string, unknown>;
const toReview = (r: Row): Review => ({
  id: Number(r.id), name: String(r.name ?? ""), location: String(r.location ?? ""), rating: Number(r.rating) || 5,
  quote: String(r.quote ?? ""), source: String(r.source ?? "onsite"), verified: Number(r.verified) === 1,
  featured: Number(r.featured) === 1, sortOrder: Number(r.sort_order) || 0,
});

async function readSummary(): Promise<RatingSummary> {
  try {
    await ensureTables();
    const r = await libsql.execute({ sql: "SELECT value FROM review_meta WHERE key = 'summary' LIMIT 1", args: [] });
    if (!r.rows.length) return DEFAULT_SUMMARY;
    return { ...DEFAULT_SUMMARY, ...(JSON.parse(String(r.rows[0].value)) as Partial<RatingSummary>) };
  } catch { return DEFAULT_SUMMARY; }
}

async function readFeatured(): Promise<Review[]> {
  try {
    await ensureTables();
    const r = await libsql.execute("SELECT * FROM reviews WHERE featured = 1 ORDER BY sort_order, id LIMIT 24");
    return (r.rows as unknown as Row[]).map(toReview);
  } catch { return []; }
}

// ---- cached storefront reads -----------------------------------------------
export async function getRatingSummary(): Promise<RatingSummary> {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("max");
  return readSummary();
}
export async function getFeaturedReviews(): Promise<Review[]> {
  "use cache";
  cacheTag(REVIEWS_TAG);
  cacheLife("max");
  return readFeatured();
}

// ---- admin ------------------------------------------------------------------
export async function listReviews(): Promise<Review[]> {
  try { await ensureTables(); const r = await libsql.execute("SELECT * FROM reviews ORDER BY sort_order, id"); return (r.rows as unknown as Row[]).map(toReview); }
  catch { return []; }
}

export async function saveRatingSummary(patch: Partial<RatingSummary>): Promise<void> {
  await ensureTables();
  const cur = await readSummary();
  const next: RatingSummary = {
    overall: typeof patch.overall === "number" && isFinite(patch.overall) ? Math.max(0, Math.min(5, patch.overall)) : cur.overall,
    count: patch.count !== undefined ? String(patch.count).slice(0, 40) : cur.count,
    sourceCopy: patch.sourceCopy !== undefined ? String(patch.sourceCopy).slice(0, 120) : cur.sourceCopy,
  };
  await libsql.execute({ sql: "INSERT INTO review_meta (key, value) VALUES ('summary', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(next)] });
  revalidateTag(REVIEWS_TAG, "max");
}

export interface ReviewInput { name: string; location?: string; rating?: number; quote: string; source?: string; verified?: boolean; featured?: boolean; sortOrder?: number }

export async function createReview(i: ReviewInput): Promise<{ ok: boolean; error?: string; id?: number }> {
  await ensureTables();
  if (!i.name?.trim() || !i.quote?.trim()) return { ok: false, error: "Name and quote are required." };
  const res = await libsql.execute({
    sql: "INSERT INTO reviews (name, location, rating, quote, source, verified, featured, sort_order, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    args: [i.name.trim(), (i.location ?? "").trim(), Math.max(1, Math.min(5, i.rating ?? 5)), i.quote.trim(), i.source ?? "onsite", i.verified === false ? 0 : 1, i.featured === false ? 0 : 1, i.sortOrder ?? 0, Date.now()],
  });
  revalidateTag(REVIEWS_TAG, "max");
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function updateReview(id: number, i: Partial<ReviewInput>): Promise<void> {
  await ensureTables();
  const sets: string[] = [], args: (string | number)[] = [];
  if (i.name !== undefined) { sets.push("name = ?"); args.push(i.name.trim()); }
  if (i.location !== undefined) { sets.push("location = ?"); args.push(i.location.trim()); }
  if (i.rating !== undefined) { sets.push("rating = ?"); args.push(Math.max(1, Math.min(5, i.rating))); }
  if (i.quote !== undefined) { sets.push("quote = ?"); args.push(i.quote.trim()); }
  if (i.source !== undefined) { sets.push("source = ?"); args.push(i.source); }
  if (i.verified !== undefined) { sets.push("verified = ?"); args.push(i.verified ? 1 : 0); }
  if (i.featured !== undefined) { sets.push("featured = ?"); args.push(i.featured ? 1 : 0); }
  if (i.sortOrder !== undefined) { sets.push("sort_order = ?"); args.push(i.sortOrder); }
  if (!sets.length) return;
  args.push(id);
  await libsql.execute({ sql: `UPDATE reviews SET ${sets.join(", ")} WHERE id = ?`, args });
  revalidateTag(REVIEWS_TAG, "max");
}

export async function deleteReview(id: number): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "DELETE FROM reviews WHERE id = ?", args: [id] });
  revalidateTag(REVIEWS_TAG, "max");
}
