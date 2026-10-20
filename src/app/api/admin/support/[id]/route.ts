import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { addAudit, actorName } from "@/lib/audit";
import { addSupportMessage, getSupportRequest, setSupportStatus, SUPPORT_STATUS_LABEL, type SupportStatus } from "@/lib/support";
import { sendSupportReplyToClient } from "@/lib/email";

const isStatus = (s: unknown): s is SupportStatus => typeof s === "string" && s in SUPPORT_STATUS_LABEL;

/** Reply to the client (emailed + shown in their account), optionally with a new status. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("orders.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to reply." }, { status: 403 });
  const id = Number((await params).id);
  const r = await getSupportRequest(id);
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let b: { message?: string; status?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const message = (b.message ?? "").trim().slice(0, 6000);
  if (message.length < 2) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  const status: SupportStatus = isStatus(b.status) ? b.status : "waiting";
  const who = actorName(actor);
  await addSupportMessage(id, "staff", who, message, status);
  let emailed = true;
  try { await sendSupportReplyToClient(r, message, SUPPORT_STATUS_LABEL[status]); }
  catch (e) { emailed = false; console.error("[support] reply email failed:", (e as Error).message); }
  await addAudit({ entity: "support", entityId: String(id), action: "reply", actor: who, summary: `Replied${status !== r.status ? ` and set status to ${SUPPORT_STATUS_LABEL[status]}` : ""}${emailed ? " (emailed to client)" : " (email FAILED — check Emails)"}` });
  return NextResponse.json({ ok: true, emailed });
}

/** Change the status only (no message to the client). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("orders.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to change this." }, { status: 403 });
  const id = Number((await params).id);
  const r = await getSupportRequest(id);
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let b: { status?: string; undo?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (!isStatus(b.status)) return NextResponse.json({ error: "Choose a status." }, { status: 400 });
  await setSupportStatus(id, b.status);
  await addAudit({
    entity: "support", entityId: String(id), action: b.undo ? "undo" : "edit", actor: actorName(actor),
    summary: `Status: ${SUPPORT_STATUS_LABEL[r.status]} → ${SUPPORT_STATUS_LABEL[b.status]}`,
  });
  return NextResponse.json({ ok: true, previous: r.status });
}
