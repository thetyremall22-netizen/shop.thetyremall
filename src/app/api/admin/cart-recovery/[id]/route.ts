import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getCart, setCartStatus, restartFlow, deleteCart, STATUS_LABEL, type CartStatus } from "@/lib/cart-recovery";
import { sendRecoveryStep } from "@/lib/cart-recovery-email";
import { addAudit, actorName } from "@/lib/audit";

const STATUSES = Object.keys(STATUS_LABEL) as CartStatus[];

/** Change a cart's status, or "resend" (restart the flow and send email 1 now). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("leads.reply");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = Number((await params).id);
  const cart = await getCart(id);
  if (!cart) return NextResponse.json({ error: "Cart not found." }, { status: 404 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  if (b.action === "resend") {
    await restartFlow(id);
    const fresh = await getCart(id);
    try {
      if (fresh) await sendRecoveryStep(fresh, 1);
    } catch (e) {
      return NextResponse.json({ error: `Couldn't send: ${(e as Error).message}` }, { status: 502 });
    }
    await addAudit({ entity: "cart", entityId: id, action: "resend", actor: actorName(actor), summary: `Flow restarted — recovery email 1 sent to ${cart.email}` });
    return NextResponse.json({ ok: true });
  }
  if (typeof b.status === "string" && STATUSES.includes(b.status as CartStatus)) {
    await setCartStatus(id, b.status as CartStatus);
    await addAudit({ entity: "cart", entityId: id, action: b.undo ? "undo" : "status", actor: actorName(actor), summary: `${b.undo ? "Undid: " : ""}Status: ${STATUS_LABEL[cart.status]} → ${STATUS_LABEL[b.status as CartStatus]}` });
    return NextResponse.json({ ok: true, previous: cart.status });
  }
  return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("leads.edit");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = Number((await params).id);
  const cart = await getCart(id);
  if (!cart) return NextResponse.json({ error: "Cart not found." }, { status: 404 });
  await deleteCart(id);
  await addAudit({ entity: "cart", entityId: id, action: "delete", actor: actorName(actor), summary: `Deleted cart #${id} (${cart.email})`, before: cart as unknown as Record<string, unknown> });
  return NextResponse.json({ ok: true });
}
