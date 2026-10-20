import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getOrder } from "@/lib/orders";
import { addAudit, actorName } from "@/lib/audit";

/** Add an internal staff note to an order's history (never sent to the customer). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("orders.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to add notes." }, { status: 403 });
  const { id } = await params;
  let text = "";
  try { text = String(((await req.json()) as { text?: string }).text ?? "").trim().slice(0, 2000); } catch { /* empty */ }
  if (!text) return NextResponse.json({ error: "Write a note first." }, { status: 400 });
  if (!(await getOrder(id))) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  await addAudit({ entity: "order", entityId: id, action: "note", actor: actorName(actor), summary: text });
  return NextResponse.json({ ok: true });
}
