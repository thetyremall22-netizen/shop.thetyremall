import "server-only";
import { libsql } from "./db";

// Media library — images (stored in the DB, size-capped) and YouTube videos.
// Images are kept small (the client downscales before upload) so the Turso DB
// stays lean; they're served as binary via /api/media/[id] so page payloads
// don't carry base64. Videos store only a YouTube id — no file.

// Sized to the site's real assets: the homepage hero banner is ~204KB @1920px,
// promo banner ~240KB, category tiles ~228–252KB, product images only 12–32KB.
// So 300KB / 2000px lets any legitimate banner through while blocking the
// multi-MB uploads that slow the site down. The client downscales toward
// IMAGE_TARGET_BYTES before upload; this is the hard server-side ceiling.
export const MAX_IMAGE_BYTES = 300_000; // 300 KB
export const IMAGE_TARGET_BYTES = 250_000; // client compresses toward this
export const MAX_IMAGE_DIMENSION = 2000; // px (longest side)
export const ALLOWED_IMAGE_MIME = ["image/webp", "image/jpeg", "image/png"];

export interface MediaRow {
  id: number;
  kind: "image" | "video";
  title: string;
  mime: string;
  youtubeId: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: number;
}

let ensured = false;
async function ensureMedia() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'image',
    title TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    data TEXT NOT NULL DEFAULT '',
    youtube_id TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    bytes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

function rowTo(r: Record<string, unknown>): MediaRow {
  return {
    id: Number(r.id),
    kind: (r.kind as "image" | "video") ?? "image",
    title: String(r.title ?? ""),
    mime: String(r.mime ?? ""),
    youtubeId: String(r.youtube_id ?? ""),
    width: Number(r.width ?? 0),
    height: Number(r.height ?? 0),
    bytes: Number(r.bytes ?? 0),
    createdAt: Number(r.created_at ?? 0),
  };
}

/** List media (metadata only — never the base64 data), newest first. */
export async function listMedia(opts: { page?: number; perPage?: number; kind?: string } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const perPage = opts.perPage ?? 24;
  try {
    await ensureMedia();
    const where = opts.kind ? " WHERE kind = ?" : "";
    const args = opts.kind ? [opts.kind] : [];
    const rows = await libsql.execute({
      sql: `SELECT id, kind, title, mime, youtube_id, width, height, bytes, created_at
            FROM media${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      args: [...args, perPage, (page - 1) * perPage],
    });
    const totals = await libsql.execute({
      sql: `SELECT count(*) AS c, COALESCE(sum(bytes),0) AS b FROM media${where}`,
      args,
    });
    return {
      rows: rows.rows.map((r) => rowTo(r as unknown as Record<string, unknown>)),
      total: Number(totals.rows[0].c),
      totalBytes: Number(totals.rows[0].b),
      page, perPage,
    };
  } catch (e) {
    console.error("[media] listMedia failed:", (e as Error).message);
    return { rows: [], total: 0, totalBytes: 0, page, perPage };
  }
}

/** Fetch one image's raw bytes for the serving route. Returns null if missing. */
export async function getMediaRaw(id: number): Promise<{ mime: string; buffer: Buffer; title: string } | null> {
  try {
    await ensureMedia();
    const res = await libsql.execute({ sql: `SELECT mime, data, title FROM media WHERE id = ? AND kind = 'image'`, args: [id] });
    const r = res.rows[0];
    if (!r || !r.data) return null;
    return { mime: String(r.mime || "application/octet-stream"), buffer: Buffer.from(String(r.data), "base64"), title: String(r.title || `image-${id}`) };
  } catch (e) {
    console.error("[media] getMediaRaw failed:", (e as Error).message);
    return null;
  }
}

export async function createImage(p: { title: string; base64: string; mime: string; width: number; height: number }): Promise<{ ok: boolean; id?: number; error?: string }> {
  await ensureMedia();
  if (!ALLOWED_IMAGE_MIME.includes(p.mime)) return { ok: false, error: "Unsupported image type." };
  const bytes = Math.floor((p.base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return { ok: false, error: `Image too large (${Math.round(bytes / 1024)}KB). Keep it under ${Math.round(MAX_IMAGE_BYTES / 1024)}KB.` };
  const res = await libsql.execute({
    sql: `INSERT INTO media (kind, title, mime, data, width, height, bytes, created_at)
          VALUES ('image', ?, ?, ?, ?, ?, ?, ?)`,
    args: [p.title.slice(0, 160) || "image", p.mime, p.base64, Math.round(p.width) || 0, Math.round(p.height) || 0, bytes, Date.now()],
  });
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function createVideo(p: { title: string; youtubeUrl: string }): Promise<{ ok: boolean; id?: number; error?: string }> {
  await ensureMedia();
  const yt = parseYouTubeId(p.youtubeUrl);
  if (!yt) return { ok: false, error: "Enter a valid YouTube link or video id." };
  const res = await libsql.execute({
    sql: `INSERT INTO media (kind, title, youtube_id, created_at) VALUES ('video', ?, ?, ?)`,
    args: [p.title.slice(0, 160) || "video", yt, Date.now()],
  });
  return { ok: true, id: Number(res.lastInsertRowid) };
}

export async function deleteMedia(id: number): Promise<void> {
  await ensureMedia();
  await libsql.execute({ sql: `DELETE FROM media WHERE id = ?`, args: [id] });
}

/** Extract an 11-char YouTube id from a URL or bare id. */
export function parseYouTubeId(input: string): string | null {
  const s = (input || "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
