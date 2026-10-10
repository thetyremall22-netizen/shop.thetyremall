import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/orders";
import { sendOrderCancelled } from "@/lib/email";

export async function POST(req: NextRequest) {
  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const order = await getOrder(id);
  // Only cancel orders that never completed payment.
  if (order && order.status === "pending") {
    const updated = await updateOrder(id, { status: "cancelled" });
    if (updated) await sendOrderCancelled(updated);
  }
  return NextResponse.json({ ok: true });
}
