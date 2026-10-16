import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getOrder, updateOrder, type OrderStatus } from "@/lib/orders";
import { incrementStock } from "@/lib/db/queries";
import { sendOrderCompleted, sendOrderRefunded, sendOrderCancelled, sendOrderOnHold } from "@/lib/email";

const ALLOWED: OrderStatus[] = ["processing", "completed", "refunded", "cancelled", "on-hold"];
const STOCK_HELD: OrderStatus[] = ["processing", "completed"]; // states where stock was already taken

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("orders.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  let status: OrderStatus;
  try {
    ({ status } = (await req.json()) as { status: OrderStatus });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "not found" }, { status: 404 });
  const prev = order.status;
  if (prev === status) return NextResponse.json({ ok: true, order });

  const updated = await updateOrder(id, { status });
  if (!updated) return NextResponse.json({ error: "update failed" }, { status: 500 });

  // Restock when moving from a stock-held state to cancelled/refunded.
  if (STOCK_HELD.includes(prev) && (status === "cancelled" || status === "refunded")) {
    for (const it of updated.items) await incrementStock(it.slug, it.qty);
  }

  // Send the matching customer email.
  if (status === "completed") await sendOrderCompleted(updated);
  else if (status === "refunded") await sendOrderRefunded(updated);
  else if (status === "cancelled") await sendOrderCancelled(updated);
  else if (status === "on-hold") await sendOrderOnHold(updated);

  return NextResponse.json({ ok: true, order: updated });
}
