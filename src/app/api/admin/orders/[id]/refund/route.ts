import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getOrder, updateOrder } from "@/lib/orders";
import { incrementStock } from "@/lib/db/queries";
import { actorName, addAudit } from "@/lib/audit";
import { sendOrderRefunded } from "@/lib/email";
import { refundHappyPayOrder } from "@/lib/happypay";

const REFUNDABLE = new Set(["processing", "completed", "partially_refunded"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("orders.edit");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;

  let body: { amount?: number; reason?: string };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!REFUNDABLE.has(order.status)) return NextResponse.json({ error: `A ${order.status} order can't be refunded.` }, { status: 400 });

  const already = order.refundedAmount ?? 0;
  const maxRefund = order.totals.total - already;
  if (maxRefund <= 0) return NextResponse.json({ error: "This order is already fully refunded." }, { status: 400 });

  const requested = typeof body.amount === "number" && body.amount > 0 ? Math.round(body.amount) : maxRefund;
  const amount = Math.min(requested, maxRefund);
  const reason = (body.reason ?? "Refund").slice(0, 200);

  // Process through the gateway where supported, otherwise mark it manual.
  let manual = true;
  if (order.paymentMethod === "happypay") {
    const r = await refundHappyPayOrder(order.id, amount, reason);
    if (!r.ok) return NextResponse.json({ error: `HappyPay refund failed: ${r.error}` }, { status: 502 });
    manual = false;
  }
  // PayFast (and others): no self-serve refund API — recorded here, money
  // released from the gateway dashboard.

  const newRefunded = already + amount;
  const fully = newRefunded >= order.totals.total;
  const status = fully ? "refunded" : "partially_refunded";

  // Restock on a full refund of a stock-held order.
  if (fully && (order.status === "processing" || order.status === "completed")) {
    for (const it of order.items) await incrementStock(it.slug, it.qty);
  }

  const updated = await updateOrder(id, { status, refundedAmount: newRefunded }, { actor: actorName(actor) });
  await addAudit({
    entity: "order", entityId: id, action: "refund", actor: actorName(actor),
    summary: `Refund R${(amount / 100).toFixed(2)} — ${reason}${manual ? " (recorded here; release the money in the payment gateway dashboard)" : " (processed through HappyPay)"}. Refunded so far: R${(newRefunded / 100).toFixed(2)}`,
  });
  if (updated) await sendOrderRefunded(updated).catch(() => {});

  return NextResponse.json({ ok: true, manual, refunded: newRefunded, status, amount });
}
