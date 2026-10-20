import { NextRequest, NextResponse } from "next/server";
import { getCustomer } from "@/lib/customers";
import { listOrdersForEmail } from "@/lib/orders";
import { createSupportRequest, TOPIC_LABEL, TOPIC_NEEDS_ORDER, type SupportTopic } from "@/lib/support";
import { sendSupportRequestEmails } from "@/lib/email";
import { addAudit } from "@/lib/audit";
import { isAdmin } from "@/lib/admin-auth";
import { countAttempt, limited, readJson } from "@/lib/customer-routes";

const CANCEL_MIN = 20;

export async function POST(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const block = await limited(req, "mail");
  if (block) return block;
  const b = await readJson<{ topic?: string; orders?: string[]; message?: string }>(req);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const topic = (b.topic && b.topic in TOPIC_LABEL ? b.topic : "") as SupportTopic | "";
  const message = (b.message ?? "").trim().slice(0, 4000);
  const errors: Record<string, string> = {};
  if (!topic) errors.topic = "Choose what you need help with.";
  // Only the client's own orders can be referenced.
  const myOrders = new Map((await listOrdersForEmail(c.email)).map((o) => [o.reference, o.id]));
  const mine = new Set(myOrders.keys());
  const orders = [...new Set((Array.isArray(b.orders) ? b.orders : []).map((r) => String(r).trim().toUpperCase()))].filter((r) => mine.has(r));
  if (topic && TOPIC_NEEDS_ORDER.includes(topic) && orders.length === 0) errors.orders = "Choose the order (or orders) this is about.";
  if (topic === "cancel" && message.length < CANCEL_MIN) errors.message = "Please tell us why you'd like to cancel (a sentence or two).";
  else if (message.length < 10) errors.message = "Please describe what you need (a sentence or two).";
  if (Object.keys(errors).length) return NextResponse.json({ error: "Please fix the highlighted fields.", errors }, { status: 400 });

  const r = await createSupportRequest({
    customerId: c.id, email: c.email, name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone,
    topic: topic as SupportTopic, orderRefs: orders, message, test: c.test || (await isAdmin()),
  });
  await countAttempt(req, "mail");
  await addAudit({ entity: "support", entityId: String(r.id), action: "created", actor: `${r.name} (client zone)`, summary: `${TOPIC_LABEL[r.topic]}${orders.length ? ` — ${orders.join(", ")}` : ""}` }).catch(() => {});
  for (const ref of orders) {
    await addAudit({ entity: "order", entityId: myOrders.get(ref)!, action: "support", actor: `${r.name} (client zone)`, summary: `Support request ${r.ref}: ${TOPIC_LABEL[r.topic]}` }).catch(() => {});
  }
  await sendSupportRequestEmails(r, message).catch((e) => console.error("[support] emails failed:", (e as Error).message));
  return NextResponse.json({ ok: true, ref: r.ref });
}
