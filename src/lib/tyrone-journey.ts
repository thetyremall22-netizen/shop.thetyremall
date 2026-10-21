import "server-only";
import { libsql } from "./db";

// Tyrone conversations: one per visitor chat, with their contact details and
// a timeline of what they did (questions, products/links clicked in the chat,
// pages visited afterwards, add to cart, WhatsApp, checkout), and the outcome
// (bought / unpaid order / added to cart / enquired / just browsed).

export type JourneyEventType = "question" | "product_click" | "link_click" | "details" | "whatsapp" | "page_view" | "add_to_cart" | "checkout";
export const EVENT_TYPES: JourneyEventType[] = ["question", "product_click", "link_click", "details", "whatsapp", "page_view", "add_to_cart", "checkout"];

export interface JourneyEvent { id: number; ts: number; type: JourneyEventType; label: string; href: string; page: string }
export interface Journey {
  sid: string; startedAt: number; lastAt: number;
  name: string; email: string; phone: string;
  firstQuestion: string; questions: number; productClicks: number; addToCart: number; whatsapp: number; pageViews: number;
  test: boolean;
}
export interface JourneyOutcome {
  kind: "bought" | "unpaid_order" | "added_to_cart" | "whatsapp" | "viewed_products" | "questions";
  label: string;
  orderRef?: string; orderId?: string; total?: number;
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS tyrone_journeys (
    sid TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL DEFAULT 0,
    last_at INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    first_question TEXT NOT NULL DEFAULT '',
    questions INTEGER NOT NULL DEFAULT 0,
    product_clicks INTEGER NOT NULL DEFAULT 0,
    add_to_cart INTEGER NOT NULL DEFAULT 0,
    whatsapp INTEGER NOT NULL DEFAULT 0,
    page_views INTEGER NOT NULL DEFAULT 0,
    test INTEGER NOT NULL DEFAULT 0
  )`);
  await libsql.execute(`CREATE TABLE IF NOT EXISTS tyrone_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sid TEXT NOT NULL,
    ts INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL DEFAULT '',
    label TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    page TEXT NOT NULL DEFAULT ''
  )`);
  await libsql.execute("CREATE INDEX IF NOT EXISTS tyrone_events_sid ON tyrone_events (sid, id)");
  ensured = true;
}

const COUNTER: Partial<Record<JourneyEventType, string>> = {
  question: "questions", product_click: "product_clicks", add_to_cart: "add_to_cart", whatsapp: "whatsapp", page_view: "page_views",
};

export async function trackJourney(sid: string, events: { type: JourneyEventType; label?: string; href?: string; page?: string }[],
  contact?: { name?: string; email?: string; phone?: string }, test = false): Promise<void> {
  await ensureTables();
  const now = Date.now();
  await libsql.execute({
    sql: "INSERT INTO tyrone_journeys (sid, started_at, last_at, test) VALUES (?, ?, ?, ?) ON CONFLICT(sid) DO UPDATE SET last_at = excluded.last_at, test = MAX(test, excluded.test)",
    args: [sid, now, now, test ? 1 : 0],
  });
  for (const e of events) {
    await libsql.execute({
      sql: "INSERT INTO tyrone_events (sid, ts, type, label, href, page) VALUES (?, ?, ?, ?, ?, ?)",
      args: [sid, now, e.type, (e.label ?? "").slice(0, 300), (e.href ?? "").slice(0, 300), (e.page ?? "").slice(0, 300)],
    });
    const col = COUNTER[e.type];
    if (col) await libsql.execute({ sql: `UPDATE tyrone_journeys SET ${col} = ${col} + 1 WHERE sid = ?`, args: [sid] });
    if (e.type === "question" && e.label) {
      await libsql.execute({ sql: "UPDATE tyrone_journeys SET first_question = ? WHERE sid = ? AND first_question = ''", args: [e.label.slice(0, 300), sid] });
    }
  }
  if (contact && (contact.email || contact.phone)) {
    await libsql.execute({
      sql: "UPDATE tyrone_journeys SET name = ?, email = ?, phone = ? WHERE sid = ?",
      args: [(contact.name ?? "").slice(0, 120), (contact.email ?? "").toLowerCase().slice(0, 160), (contact.phone ?? "").slice(0, 40), sid],
    });
  }
}

type Row = Record<string, unknown>;
const toJourney = (r: Row): Journey => ({
  sid: String(r.sid), startedAt: Number(r.started_at) || 0, lastAt: Number(r.last_at) || 0,
  name: String(r.name ?? ""), email: String(r.email ?? ""), phone: String(r.phone ?? ""),
  firstQuestion: String(r.first_question ?? ""), questions: Number(r.questions) || 0, productClicks: Number(r.product_clicks) || 0,
  addToCart: Number(r.add_to_cart) || 0, whatsapp: Number(r.whatsapp) || 0, pageViews: Number(r.page_views) || 0, test: Number(r.test) === 1,
});

const last9 = (p: string) => (p || "").replace(/\D/g, "").slice(-9);
const DIGITS = (col: string) => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},' ',''),'+',''),'-',''),'(',''),')','')`;

/** What the conversation led to. An order counts if it was placed with this
 *  conversation (checkout carries it) or by the same email / mobile within
 *  14 days of the chat. */
export async function journeyOutcome(j: Journey): Promise<JourneyOutcome> {
  const p9 = last9(j.phone);
  const r = await libsql.execute({
    sql: `SELECT order_id, reference, status, json_extract(totals,'$.total') t FROM orders
          WHERE created_at >= ? AND created_at <= ? AND (
            json_extract(attribution,'$.tyrone') = ?
            ${j.email ? "OR LOWER(json_extract(customer,'$.email')) = ?" : ""}
            ${p9.length === 9 ? `OR substr(${DIGITS("json_extract(customer,'$.phone')")}, -9) = ?` : ""})
          ORDER BY CASE WHEN status IN ('processing','completed') THEN 0 ELSE 1 END, id DESC LIMIT 1`,
    args: [j.startedAt - 60_000, j.lastAt + 14 * 86400_000, j.sid, ...(j.email ? [j.email] : []), ...(p9.length === 9 ? [p9] : [])],
  }).catch(() => ({ rows: [] as Row[] }));
  const o = r.rows[0];
  if (o) {
    const paid = ["processing", "completed"].includes(String(o.status));
    const total = Number(o.t) || 0;
    return { kind: paid ? "bought" : "unpaid_order", label: paid ? `Bought — ${o.reference}` : `Started order ${o.reference} (not paid)`, orderRef: String(o.reference), orderId: String(o.order_id), total };
  }
  if (j.addToCart > 0) return { kind: "added_to_cart", label: "Added to cart (no order yet)" };
  if (j.whatsapp > 0) return { kind: "whatsapp", label: "WhatsApp enquiry" };
  if (j.productClicks > 0 || j.pageViews > 0) return { kind: "viewed_products", label: "Viewed products" };
  return { kind: "questions", label: "Questions only" };
}

export async function listJourneys(opts: { q?: string; limit?: number } = {}): Promise<(Journey & { outcome: JourneyOutcome })[]> {
  try {
    await ensureTables();
    const q = opts.q?.trim().toLowerCase();
    const r = await libsql.execute({
      sql: `SELECT * FROM tyrone_journeys ${q ? "WHERE LOWER(name || ' ' || email || ' ' || phone || ' ' || first_question) LIKE ? OR sid IN (SELECT sid FROM tyrone_events WHERE LOWER(label) LIKE ?)" : ""}
            ORDER BY last_at DESC LIMIT ?`,
      args: q ? [`%${q}%`, `%${q}%`, opts.limit ?? 300] : [opts.limit ?? 300],
    });
    const list = (r.rows as Row[]).map(toJourney);
    return Promise.all(list.map(async (j) => ({ ...j, outcome: await journeyOutcome(j) })));
  } catch (e) {
    console.error("[tyrone-journey] list failed:", (e as Error).message);
    return [];
  }
}

export async function getJourney(sid: string): Promise<(Journey & { outcome: JourneyOutcome; events: JourneyEvent[] }) | null> {
  await ensureTables();
  const r = await libsql.execute({ sql: "SELECT * FROM tyrone_journeys WHERE sid = ?", args: [sid] });
  if (!r.rows[0]) return null;
  const j = toJourney(r.rows[0] as Row);
  const ev = await libsql.execute({ sql: "SELECT * FROM tyrone_events WHERE sid = ? ORDER BY id LIMIT 1000", args: [sid] });
  const events = (ev.rows as Row[]).map((e) => ({ id: Number(e.id), ts: Number(e.ts), type: String(e.type) as JourneyEventType, label: String(e.label ?? ""), href: String(e.href ?? ""), page: String(e.page ?? "") }));
  return { ...j, outcome: await journeyOutcome(j), events };
}

export async function journeyCount(): Promise<number> {
  try { await ensureTables(); const r = await libsql.execute("SELECT COUNT(*) n FROM tyrone_journeys"); return Number(r.rows[0]?.n) || 0; } catch { return 0; }
}
