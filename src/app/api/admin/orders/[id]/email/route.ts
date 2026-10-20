import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getOrder } from "@/lib/orders";
import { sendOrderInvoice, resendOrderConfirmation, resendStatusEmail, sendShopOrderCopy } from "@/lib/email";
import { addAudit, actorName } from "@/lib/audit";

const KINDS = {
  invoice: "Tax invoice emailed to the customer",
  confirmation: "Order confirmation re-sent to the customer",
  status: "Current status email re-sent to the customer",
  shop: "Order details emailed to the shop",
} as const;
type Kind = keyof typeof KINDS;

/** Send one of the standard order emails from the order page. Logged in the
 *  order's email list and history. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("emails.send");
  if (!actor) return NextResponse.json({ error: "You don't have permission to send emails." }, { status: 403 });
  const { id } = await params;
  let kind: Kind;
  try { ({ kind } = (await req.json()) as { kind: Kind }); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (!(kind in KINDS)) return NextResponse.json({ error: "Unknown email." }, { status: 400 });
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  try {
    if (kind === "invoice") await sendOrderInvoice(order);
    else if (kind === "confirmation") await resendOrderConfirmation(order);
    else if (kind === "shop") await sendShopOrderCopy(order);
    else if (!(await resendStatusEmail(order))) {
      return NextResponse.json({ error: `There's no customer email for a “${order.status}” order.` }, { status: 400 });
    }
  } catch (e) {
    await addAudit({ entity: "order", entityId: id, action: "email", actor: actorName(actor), summary: `${KINDS[kind]} — FAILED: ${(e as Error).message}` });
    return NextResponse.json({ error: `Couldn't send: ${(e as Error).message}` }, { status: 502 });
  }
  await addAudit({ entity: "order", entityId: id, action: "email", actor: actorName(actor), summary: `${KINDS[kind]} (${kind === "shop" ? "shop" : order.customer.email})` });
  return NextResponse.json({ ok: true });
}
