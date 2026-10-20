import { NextRequest, NextResponse } from "next/server";
import { getCustomer } from "@/lib/customers";
import { addSupportMessage, getClientSupportRequest } from "@/lib/support";
import { sendSupportClientFollowUp } from "@/lib/email";
import { countAttempt, limited, readJson } from "@/lib/customer-routes";

// The client adds a message to one of their requests.
export async function POST(req: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const block = await limited(req, "mail");
  if (block) return block;
  const r = await getClientSupportRequest((await params).ref, c.id);
  if (!r) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const b = await readJson<{ message?: string }>(req);
  const message = (b?.message ?? "").trim().slice(0, 4000);
  if (message.length < 2) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  if (r.status === "closed") return NextResponse.json({ error: "This request is closed. Please open a new request." }, { status: 400 });
  await addSupportMessage(r.id, "client", r.name, message);
  await countAttempt(req, "mail");
  await sendSupportClientFollowUp(r, message).catch((e) => console.error("[support] follow-up email failed:", (e as Error).message));
  return NextResponse.json({ ok: true });
}
