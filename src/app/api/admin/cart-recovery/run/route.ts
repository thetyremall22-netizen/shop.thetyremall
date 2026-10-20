import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { runRecovery } from "@/lib/cart-recovery-email";
import { addAudit, actorName } from "@/lib/audit";

/** "Send due emails now": one recovery pass on demand. */
export async function POST() {
  const actor = await authorize("leads.reply");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const r = await runRecovery();
  await addAudit({ entity: "cart-recovery", entityId: "run", action: "run", actor: actorName(actor), summary: `Send due emails now: ${r.sent} sent, ${r.failed} failed` });
  return NextResponse.json({ ok: true, ...r });
}
