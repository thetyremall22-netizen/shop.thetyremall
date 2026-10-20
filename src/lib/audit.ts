import "server-only";
import { libsql } from "./db";

// Running history of every admin change (leads, orders, products, settings…):
// who changed what, when, and the values before and after — so any edit can be
// reviewed and undone. Stored in the site DB alongside the data it describes.

export interface AuditEntry {
  id: number;
  entity: string;
  entityId: string;
  action: string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  actor: string;
  createdAt: number;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    before TEXT,
    after TEXT,
    actor TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  )`);
  await libsql.execute(`CREATE INDEX IF NOT EXISTS audit_entity ON audit_log (entity, entity_id, id)`);
  ensured = true;
}

/** Record a change and return its id. Never throws — the history must not
 *  block the edit. */
export async function addAudit(e: {
  entity: string; entityId: string | number; action: string; summary?: string;
  before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; actor?: string;
}): Promise<number | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({
      sql: `INSERT INTO audit_log (entity, entity_id, action, summary, before, after, actor, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      args: [
        e.entity, String(e.entityId), e.action, e.summary ?? "",
        e.before ? JSON.stringify(e.before) : null, e.after ? JSON.stringify(e.after) : null,
        e.actor ?? "", Date.now(),
      ],
    });
    return Number(r.lastInsertRowid) || null;
  } catch (err) {
    console.error("[audit] add failed:", (err as Error).message);
    return null;
  }
}

export async function getAudit(id: number): Promise<AuditEntry | null> {
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM audit_log WHERE id = ?", args: [id] });
    if (!r.rows.length) return null;
    const row = r.rows[0] as unknown as Record<string, unknown>;
    return {
      id: Number(row.id), entity: String(row.entity), entityId: String(row.entity_id), action: String(row.action),
      summary: String(row.summary ?? ""), before: row.before ? JSON.parse(String(row.before)) : null,
      after: row.after ? JSON.parse(String(row.after)) : null, actor: String(row.actor ?? ""), createdAt: Number(row.created_at),
    };
  } catch { return null; }
}

export async function listAudit(entity: string, entityId: string | number, limit = 200): Promise<AuditEntry[]> {
  try {
    await ensureTable();
    const r = await libsql.execute({
      sql: `SELECT * FROM audit_log WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?`,
      args: [entity, String(entityId), limit],
    });
    return (r.rows as unknown as Record<string, unknown>[]).map((row) => ({
      id: Number(row.id),
      entity: String(row.entity),
      entityId: String(row.entity_id),
      action: String(row.action),
      summary: String(row.summary ?? ""),
      before: row.before ? JSON.parse(String(row.before)) : null,
      after: row.after ? JSON.parse(String(row.after)) : null,
      actor: String(row.actor ?? ""),
      createdAt: Number(row.created_at),
    }));
  } catch {
    return [];
  }
}

/** Only the fields that actually changed, as { field: [before, after] }. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(after)) {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a, b];
  }
  return out;
}

/** "Name: Bob → Robert · Phone: … → …" for the history list. */
export function describeChanges(changes: Record<string, [unknown, unknown]>, labels: Record<string, string> = {}): string {
  const show = (v: unknown) => (v == null || v === "" ? "(empty)" : String(v).length > 60 ? String(v).slice(0, 60) + "…" : String(v));
  return Object.entries(changes)
    .map(([k, [a, b]]) => `${labels[k] ?? k}: ${show(a)} → ${show(b)}`)
    .join(" · ");
}

export function actorName(u: { name?: string; email?: string; isOwner?: boolean }): string {
  if (u.isOwner) return "Owner";
  return u.name || u.email || "Admin";
}
