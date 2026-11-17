import { NextRequest, NextResponse, connection } from "next/server";
import { getRecoverySettings, markClickedByEmail, recordPopupEvent, type PopupDevice, type PopupTrigger } from "@/lib/cart-recovery";
import { checkEmail } from "@/lib/validate";
import { isAdmin } from "@/lib/admin-auth";

/** Exit-intent popup settings (public, only what the popup shows). */
export async function GET() {
  await connection(); // read the live settings at request time
  const s = await getRecoverySettings();
  const p = s.enabled && s.exitPopup.enabled ? s.exitPopup : null;
  return NextResponse.json(p ? { enabled: true, title: p.title, text: p.text, cta: p.cta, ctaStay: p.ctaStay, cooldownHours: p.cooldownHours } : { enabled: false },
    { headers: { "cache-control": "public, max-age=300" } });
}

const TRIGGERS: PopupTrigger[] = ["mouse_exit", "back_button", "tab_return"];

/** The popup was shown ({event:"shown"}) or its button tapped ({event:"tapped"}, the
 *  default for older pages). A tap with a known email counts as engaging with recovery. */
export async function POST(req: NextRequest) {
  let b: { email?: unknown; event?: unknown; device?: unknown; trigger?: unknown } = {};
  try { b = (await req.json()) as typeof b; } catch { /* empty */ }
  const email = String(b.email ?? "").trim().slice(0, 160);
  const event = b.event === "shown" ? "shown" : "tapped";
  const device: PopupDevice = b.device === "mobile" ? "mobile" : "desktop";
  const trigger: PopupTrigger = TRIGGERS.includes(b.trigger as PopupTrigger) ? (b.trigger as PopupTrigger) : "mouse_exit";
  const validEmail = !!email && !checkEmail(email);
  if (await isAdmin()) return NextResponse.json({ ok: true }); // staff browsing the shop aren't counted
  await recordPopupEvent(event, device, trigger, validEmail);
  if (event === "tapped" && validEmail) await markClickedByEmail(email);
  return NextResponse.json({ ok: true });
}
