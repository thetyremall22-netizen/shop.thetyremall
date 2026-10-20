import "server-only";
import { libsql } from "./db";

// Support requests from the client zone. Orders can't be changed by clients
// once placed — a change, extra items or a cancellation goes through here, and
// staff handle it from Admin → Support. Each request is a thread of messages.

export type SupportTopic = "cancel" | "change_address" | "change_items" | "add_items" | "delivery" | "payment" | "return" | "other";
export type SupportStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";

export const TOPIC_LABEL: Record<SupportTopic, string> = {
  cancel: "Cancel my order",
  change_address: "Change delivery address / fitment details",
  change_items: "Change the items on my order",
  add_items: "Add more tyres or wheels",
  delivery: "Delivery / where is my order",
  payment: "Payment or invoice question",
  return: "Return or warranty",
  other: "Something else",
};
/** Topics that must be linked to at least one order. */
export const TOPIC_NEEDS_ORDER: SupportTopic[] = ["cancel", "change_address", "change_items", "add_items", "delivery", "payment", "return"];
export const TOPICS = Object.keys(TOPIC_LABEL) as SupportTopic[];

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "New",
  in_progress: "In progress",
  waiting: "Waiting for client",
  resolved: "Resolved",
  closed: "Closed",
};
export const SUPPORT_STATUS_BADGE: Record<SupportStatus, string> = {
  open: "badge-warn",
  in_progress: "badge-volt",
  waiting: "badge-muted",
  resolved: "badge-pay",
  closed: "badge-muted",
};
export const SUPPORT_STATUSES = Object.keys(SUPPORT_STATUS_LABEL) as SupportStatus[];

export interface SupportMessage { id: number; author: "client" | "staff"; authorName: string; body: string; createdAt: number }
export interface SupportRequest {
  id: number;
  ref: string;
  customerId: number;
  email: string;
  name: string;
  phone: string;
  topic: SupportTopic;
  orderRefs: string[];
  status: SupportStatus;
  test: boolean;
  createdAt: number;
  updatedAt: number;
  /** who wrote last — "client" means staff still need to answer */
  lastBy: "client" | "staff";
  messages?: SupportMessage[];
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS support_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT NOT NULL DEFAULT '',
    customer_id INTEGER NOT NULL DEFAULT 0,
    email TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT 'other',
    order_refs TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'open',
    last_by TEXT NOT NULL DEFAULT 'client',
    test INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT 'client',
    author_name TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;
function toRequest(r: Row): SupportRequest {
  let refs: string[] = [];
  try { refs = JSON.parse(String(r.order_refs || "[]")); } catch { /* ignore */ }
  return {
    id: Number(r.id),
    ref: String(r.ref || `SUP-${String(r.id).padStart(5, "0")}`),
    customerId: Number(r.customer_id) || 0,
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    phone: String(r.phone ?? ""),
    topic: (String(r.topic) as SupportTopic) in TOPIC_LABEL ? (String(r.topic) as SupportTopic) : "other",
    orderRefs: Array.isArray(refs) ? refs.map(String) : [],
    status: (String(r.status) as SupportStatus) in SUPPORT_STATUS_LABEL ? (String(r.status) as SupportStatus) : "open",
    test: Number(r.test) === 1,
    createdAt: Number(r.created_at) || 0,
    updatedAt: Number(r.updated_at) || 0,
    lastBy: String(r.last_by) === "staff" ? "staff" : "client",
  };
}
function toMessage(r: Row): SupportMessage {
  return { id: Number(r.id), author: String(r.author) === "staff" ? "staff" : "client", authorName: String(r.author_name ?? ""), body: String(r.body ?? ""), createdAt: Number(r.created_at) || 0 };
}

async function messagesFor(id: number): Promise<SupportMessage[]> {
  const r = await libsql.execute({ sql: "SELECT * FROM support_messages WHERE request_id = ? ORDER BY id", args: [id] });
  return r.rows.map((x) => toMessage(x as Row));
}

export interface NewSupportRequest { customerId: number; email: string; name: string; phone: string; topic: SupportTopic; orderRefs: string[]; message: string; test?: boolean }

export async function createSupportRequest(i: NewSupportRequest): Promise<SupportRequest> {
  await ensureTables();
  const now = Date.now();
  const ins = await libsql.execute({
    sql: `INSERT INTO support_requests (customer_id, email, name, phone, topic, order_refs, status, last_by, test, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'open', 'client', ?, ?, ?) RETURNING id`,
    args: [i.customerId, i.email, i.name, i.phone, i.topic, JSON.stringify(i.orderRefs), i.test ? 1 : 0, now, now],
  });
  const id = Number(ins.rows[0]?.id);
  const ref = `SUP-${String(id).padStart(5, "0")}`;
  await libsql.execute({ sql: "UPDATE support_requests SET ref = ? WHERE id = ?", args: [ref, id] });
  await libsql.execute({
    sql: "INSERT INTO support_messages (request_id, author, author_name, body, created_at) VALUES (?, 'client', ?, ?, ?)",
    args: [id, i.name, i.message, now],
  });
  return (await getSupportRequest(id))!;
}

export async function getSupportRequest(id: number): Promise<SupportRequest | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM support_requests WHERE id = ?", args: [id] });
  if (!r.rows[0]) return null;
  return { ...toRequest(r.rows[0] as Row), messages: await messagesFor(id) };
}

/** A request by its SUP-number, only if it belongs to this client. */
export async function getClientSupportRequest(ref: string, customerId: number): Promise<SupportRequest | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM support_requests WHERE ref = ? AND customer_id = ?", args: [ref.trim().toUpperCase(), customerId] });
  if (!r.rows[0]) return null;
  const req = toRequest(r.rows[0] as Row);
  return { ...req, messages: await messagesFor(req.id) };
}

export async function addSupportMessage(id: number, author: "client" | "staff", authorName: string, body: string, status?: SupportStatus): Promise<void> {
  await ensureTables();
  const now = Date.now();
  await libsql.execute({ sql: "INSERT INTO support_messages (request_id, author, author_name, body, created_at) VALUES (?, ?, ?, ?, ?)", args: [id, author, authorName, body, now] });
  // A client writing back re-opens a request that was waiting / resolved.
  const next = status ?? (author === "client" ? "open" : undefined);
  await libsql.execute({
    sql: `UPDATE support_requests SET last_by = ?, updated_at = ?${next ? ", status = ?" : ""} WHERE id = ?`,
    args: next ? [author, now, next, id] : [author, now, id],
  });
}

export async function setSupportStatus(id: number, status: SupportStatus): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "UPDATE support_requests SET status = ?, updated_at = ? WHERE id = ?", args: [status, Date.now(), id] });
}

export async function setSupportTest(id: number, test: boolean): Promise<void> {
  await ensureTables();
  await libsql.execute({ sql: "UPDATE support_requests SET test = ? WHERE id = ?", args: [test ? 1 : 0, id] });
}

export async function listClientSupport(customerId: number): Promise<SupportRequest[]> {
  try {
    await ensureTables();
    const r = await libsql.execute({ sql: "SELECT * FROM support_requests WHERE customer_id = ? ORDER BY id DESC LIMIT 100", args: [customerId] });
    return r.rows.map((x) => toRequest(x as Row));
  } catch { return []; }
}

/** Requests that mention an order (for the admin order page). */
export async function supportForOrder(reference: string): Promise<SupportRequest[]> {
  try {
    await ensureTables();
    const r = await libsql.execute({ sql: "SELECT * FROM support_requests WHERE order_refs LIKE ? ORDER BY id DESC", args: [`%"${reference}"%`] });
    return r.rows.map((x) => toRequest(x as Row));
  } catch { return []; }
}

export async function listSupport(opts: { status?: string; q?: string; limit?: number } = {}): Promise<(SupportRequest & { preview: string })[]> {
  try {
    await ensureTables();
    const conds: string[] = [];
    const args: (string | number)[] = [];
    if (opts.status === "active") conds.push("s.status IN ('open','in_progress','waiting')");
    else if (opts.status && opts.status in SUPPORT_STATUS_LABEL) { conds.push("s.status = ?"); args.push(opts.status); }
    const q = opts.q?.trim().toLowerCase();
    if (q) {
      conds.push(`(LOWER(s.ref || ' ' || s.email || ' ' || s.name || ' ' || s.phone || ' ' || s.order_refs) LIKE ?
        OR EXISTS (SELECT 1 FROM support_messages m WHERE m.request_id = s.id AND LOWER(m.body) LIKE ?))`);
      args.push(`%${q}%`, `%${q}%`);
    }
    const r = await libsql.execute({
      sql: `SELECT s.*, (SELECT body FROM support_messages m WHERE m.request_id = s.id ORDER BY m.id DESC LIMIT 1) AS preview
            FROM support_requests s ${conds.length ? `WHERE ${conds.join(" AND ")}` : ""}
            ORDER BY CASE WHEN s.status IN ('open') THEN 0 WHEN s.status IN ('in_progress','waiting') THEN 1 ELSE 2 END, s.updated_at DESC
            LIMIT ?`,
      args: [...args, opts.limit ?? 200],
    });
    return r.rows.map((x) => ({ ...toRequest(x as Row), preview: String(x.preview ?? "") }));
  } catch (e) {
    console.error("[support] list failed:", (e as Error).message);
    return [];
  }
}

export async function supportCounts(): Promise<Record<string, number>> {
  try {
    await ensureTables();
    const r = await libsql.execute("SELECT status, COUNT(*) n FROM support_requests GROUP BY status");
    const out: Record<string, number> = { all: 0, active: 0 };
    for (const x of r.rows) {
      const n = Number(x.n) || 0;
      out[String(x.status)] = n;
      out.all += n;
      if (["open", "in_progress", "waiting"].includes(String(x.status))) out.active += n;
    }
    return out;
  } catch { return { all: 0, active: 0 }; }
}
