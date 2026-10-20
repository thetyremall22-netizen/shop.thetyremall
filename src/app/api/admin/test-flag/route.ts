import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { libsql } from "@/lib/db";
import { addAudit, actorName } from "@/lib/audit";

// Mark a lead / enquiry / abandoned cart / order as a TEST (or as real), so
// staff can tell test entries from real customers at a glance.
const TABLES = {
  lead: { table: "contacts", key: "id", perm: "leads.edit" },
  enquiry: { table: "enquiries", key: "id", perm: "leads.edit" },
  cart: { table: "cart_recovery", key: "id", perm: "leads.reply" },
  order: { table: "orders", key: "order_id", perm: "orders.edit" },
  support: { table: "support_requests", key: "id", perm: "orders.edit" },
  client: { table: "customers", key: "id", perm: "orders.edit" },
} as const;
type Kind = keyof typeof TABLES;

export async function POST(req: NextRequest) {
  let b: { kind?: string; id?: string | number; test?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const t = TABLES[b.kind as Kind];
  if (!t || b.id == null || typeof b.test !== "boolean") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const actor = await authorize(t.perm);
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try { await libsql.execute(`ALTER TABLE ${t.table} ADD COLUMN test INTEGER NOT NULL DEFAULT 0`); } catch { /* exists */ }
  const r = await libsql.execute({ sql: `UPDATE ${t.table} SET test = ? WHERE ${t.key} = ?`, args: [b.test ? 1 : 0, String(b.id)] });
  if (!r.rowsAffected) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await addAudit({ entity: b.kind as string, entityId: String(b.id), action: "edit", actor: actorName(actor), summary: b.test ? "Marked as TEST" : "Marked as REAL (not a test)" });
  return NextResponse.json({ ok: true });
}
