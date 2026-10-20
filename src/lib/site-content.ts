import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

export interface Stat { id: number; value: string; label: string; sortOrder: number }
export interface TeamMember { id: number; name: string; role: string; photo: string; sortOrder: number }
export interface StoryContent { eyebrow: string; body: string }
export interface TeamSection { eyebrow: string; emptyCopy: string }

const DEFAULT_STORY: StoryContent = {
  eyebrow: "Proudly South African",
  body: "For the past 10 years, The Tyre Mall has been dedicated to providing quality tyres, expert service and unbeatable value. Since our founding we've built a reputation for reliability — making sure every driver finds the perfect tyres for their journey. Whether it's performance, durability or affordability you're after, we're here to keep you rolling with confidence.",
};
const DEFAULT_TEAM_SECTION: TeamSection = { eyebrow: "The faces behind your tyres", emptyCopy: "Team photos & names coming soon." };
const SEED_STATS: { value: string; label: string }[] = [
  { value: "10", label: "Years rolling" },
  { value: "7,000+", label: "Tyres in range" },
  { value: "26", label: "Top brands" },
  { value: "SA-wide", label: "Free delivery" },
];

export const CONTENT_TAG = "site-content";

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0)`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS team_members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', photo TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0)`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS content_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`);
  // Starter stats, added in ONE statement only while the table is empty, so
  // several server processes starting together can't each add a copy.
  await libsql.execute({
    sql: `INSERT INTO stats (value, label, sort_order)
          SELECT v, l, s FROM (${SEED_STATS.map(() => "SELECT ? AS v, ? AS l, ? AS s").join(" UNION ALL ")})
          WHERE NOT EXISTS (SELECT 1 FROM stats)`,
    args: SEED_STATS.flatMap((x, i) => [x.value, x.label, i]),
  });
  ensured = true;
}

type Row = Record<string, unknown>;
async function readMeta<T>(key: string, fallback: T): Promise<T> {
  try {
    await ensureTables();
    const r = await libsql.execute({ sql: "SELECT value FROM content_meta WHERE key = ? LIMIT 1", args: [key] });
    if (!r.rows.length) return fallback;
    return { ...fallback, ...(JSON.parse(String(r.rows[0].value)) as Partial<T>) };
  } catch { return fallback; }
}
async function readStats(): Promise<Stat[]> {
  try { await ensureTables(); const r = await libsql.execute("SELECT * FROM stats ORDER BY sort_order, id"); return (r.rows as unknown as Row[]).map((x) => ({ id: Number(x.id), value: String(x.value ?? ""), label: String(x.label ?? ""), sortOrder: Number(x.sort_order) || 0 })); }
  catch { return []; }
}
async function readTeam(): Promise<TeamMember[]> {
  try { await ensureTables(); const r = await libsql.execute("SELECT * FROM team_members ORDER BY sort_order, id"); return (r.rows as unknown as Row[]).map((x) => ({ id: Number(x.id), name: String(x.name ?? ""), role: String(x.role ?? ""), photo: String(x.photo ?? ""), sortOrder: Number(x.sort_order) || 0 })); }
  catch { return []; }
}

// ---- cached storefront reads -----------------------------------------------
export async function getStory(): Promise<StoryContent> { "use cache"; cacheTag(CONTENT_TAG); cacheLife("max"); return readMeta("story", DEFAULT_STORY); }
export async function getTeamSection(): Promise<TeamSection> { "use cache"; cacheTag(CONTENT_TAG); cacheLife("max"); return readMeta("team_section", DEFAULT_TEAM_SECTION); }
export async function getStats(): Promise<Stat[]> { "use cache"; cacheTag(CONTENT_TAG); cacheLife("max"); return readStats(); }
export async function getTeam(): Promise<TeamMember[]> { "use cache"; cacheTag(CONTENT_TAG); cacheLife("max"); return readTeam(); }

// ---- admin (uncached) -------------------------------------------------------
export const listStats = readStats;
export const listTeam = readTeam;
export async function getStoryRaw() { await ensureTables(); return readMeta("story", DEFAULT_STORY); }
export async function getTeamSectionRaw() { await ensureTables(); return readMeta("team_section", DEFAULT_TEAM_SECTION); }

function bump() { revalidateTag(CONTENT_TAG, "max"); }

export async function saveStory(p: Partial<StoryContent>) {
  await ensureTables();
  const cur = await readMeta("story", DEFAULT_STORY);
  const next: StoryContent = { eyebrow: (p.eyebrow ?? cur.eyebrow).slice(0, 120), body: (p.body ?? cur.body).slice(0, 2000) };
  await libsql.execute({ sql: "INSERT INTO content_meta (key, value) VALUES ('story', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(next)] });
  bump();
}
export async function saveTeamSection(p: Partial<TeamSection>) {
  await ensureTables();
  const cur = await readMeta("team_section", DEFAULT_TEAM_SECTION);
  const next: TeamSection = { eyebrow: (p.eyebrow ?? cur.eyebrow).slice(0, 120), emptyCopy: (p.emptyCopy ?? cur.emptyCopy).slice(0, 200) };
  await libsql.execute({ sql: "INSERT INTO content_meta (key, value) VALUES ('team_section', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", args: [JSON.stringify(next)] });
  bump();
}

export async function saveStat(id: number | null, s: { value: string; label: string; sortOrder?: number }) {
  await ensureTables();
  if (id) await libsql.execute({ sql: "UPDATE stats SET value=?, label=?, sort_order=? WHERE id=?", args: [s.value.trim(), s.label.trim(), s.sortOrder ?? 0, id] });
  else await libsql.execute({ sql: "INSERT INTO stats (value, label, sort_order) VALUES (?,?,?)", args: [s.value.trim(), s.label.trim(), s.sortOrder ?? 0] });
  bump();
}
export async function deleteStat(id: number) { await ensureTables(); await libsql.execute({ sql: "DELETE FROM stats WHERE id=?", args: [id] }); bump(); }

export async function saveTeamMember(id: number | null, m: { name: string; role: string; photo: string; sortOrder?: number }) {
  await ensureTables();
  if (id) await libsql.execute({ sql: "UPDATE team_members SET name=?, role=?, photo=?, sort_order=? WHERE id=?", args: [m.name.trim(), m.role.trim(), m.photo.trim(), m.sortOrder ?? 0, id] });
  else await libsql.execute({ sql: "INSERT INTO team_members (name, role, photo, sort_order) VALUES (?,?,?,?)", args: [m.name.trim(), m.role.trim(), m.photo.trim(), m.sortOrder ?? 0] });
  bump();
}
export async function deleteTeamMember(id: number) { await ensureTables(); await libsql.execute({ sql: "DELETE FROM team_members WHERE id=?", args: [id] }); bump(); }
