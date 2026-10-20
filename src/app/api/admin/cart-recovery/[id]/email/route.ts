import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getCart } from "@/lib/cart-recovery";
import { sendManualRecoveryEmail } from "@/lib/cart-recovery-email";
import { addAudit, actorName } from "@/lib/audit";

/** A one-off branded email to the shopper, written by staff. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("emails.send");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = Number((await params).id);
  const cart = await getCart(id);
  if (!cart) return NextResponse.json({ error: "Cart not found." }, { status: 404 });
  let subject = "", message = "";
  try { ({ subject = "", message = "" } = (await req.json()) as { subject?: string; message?: string }); } catch { /* empty */ }
  subject = subject.trim().slice(0, 160); message = message.trim().slice(0, 5000);
  if (!subject || !message) return NextResponse.json({ error: "Write a subject and a message." }, { status: 400 });
  try {
    await sendManualRecoveryEmail(cart, subject, message);
  } catch (e) {
    return NextResponse.json({ error: `Couldn't send: ${(e as Error).message}` }, { status: 502 });
  }
  await addAudit({ entity: "cart", entityId: id, action: "email", actor: actorName(actor), summary: `Emailed ${cart.email}: “${subject}”` });
  return NextResponse.json({ ok: true });
}
