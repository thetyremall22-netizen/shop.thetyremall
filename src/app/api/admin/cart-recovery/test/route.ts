import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getRecoverySettings, type RecoveryCart } from "@/lib/cart-recovery";
import { renderRecoveryEmail } from "@/lib/cart-recovery-email";
import { sendMail, SHOP_EMAIL } from "@/lib/email";

/** Preview a recovery email (returns the HTML) or send a test to the shop. */
export async function POST(req: NextRequest) {
  const actor = await authorize("deals.manage");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let step = 1, send = false;
  try { ({ step = 1, send = false } = (await req.json()) as { step?: number; send?: boolean }); } catch { /* defaults */ }
  const s = await getRecoverySettings();
  const sample: RecoveryCart = {
    id: 0, email: actor.email || SHOP_EMAIL, firstName: "Sipho", lastName: "Sample", phone: "", address: {},
    items: [{ slug: "radar-265-65r17-112t-rpx800", name: "RADAR 265/65R17 RENEGADE A/T (sample)", qty: 4, price: 189900 }],
    signature: "", total: 759600, source: "checkout", status: "abandoned", token: "sample-token-preview-only-xxxxxxxx",
    emailsSent: 0, lastEmailAt: null, orderRef: null, recoveredOrderRef: null, recoveredValue: 0, createdAt: Date.now(), updatedAt: Date.now(), lastActivityAt: Date.now(),
  };
  const st = Math.max(1, Math.min(3, Math.round(step)));
  const { subject, html } = await renderRecoveryEmail(sample, st, s);
  if (send) {
    try { await sendMail(SHOP_EMAIL, `[TEST] ${subject}`, html, { type: "abandoned_cart", noCc: true }); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
    return NextResponse.json({ ok: true, sentTo: SHOP_EMAIL });
  }
  return NextResponse.json({ subject, html });
}
