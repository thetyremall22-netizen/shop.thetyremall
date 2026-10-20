import { NextRequest, NextResponse, connection } from "next/server";
import { getRecoverySettings, markClickedByEmail } from "@/lib/cart-recovery";
import { checkEmail } from "@/lib/validate";

/** Exit-intent popup settings (public, only what the popup shows). */
export async function GET() {
  await connection(); // read the live settings at request time
  const s = await getRecoverySettings();
  const p = s.enabled && s.exitPopup.enabled ? s.exitPopup : null;
  return NextResponse.json(p ? { enabled: true, title: p.title, text: p.text, cta: p.cta, ctaStay: p.ctaStay, cooldownHours: p.cooldownHours } : { enabled: false },
    { headers: { "cache-control": "public, max-age=300" } });
}

/** The shopper tapped the popup button: counts as engaging with recovery. */
export async function POST(req: NextRequest) {
  let email = "";
  try { email = String(((await req.json()) as { email?: string }).email ?? "").trim(); } catch { /* empty */ }
  if (email && !checkEmail(email)) await markClickedByEmail(email);
  return NextResponse.json({ ok: true });
}
