import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getRecoverySettings, saveRecoverySettings, DEFAULT_RECOVERY_SETTINGS, type RecoverySettings } from "@/lib/cart-recovery";
import { addAudit, actorName } from "@/lib/audit";

const str = (v: unknown, max = 300, d = "") => (typeof v === "string" ? v.trim().slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const int = (v: unknown, min: number, max: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };

export async function PUT(req: NextRequest) {
  const actor = await authorize("deals.manage");
  if (!actor) return NextResponse.json({ error: "You don't have permission to change Cart Recovery settings." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const D = DEFAULT_RECOVERY_SETTINGS;
  const em = Array.isArray(b.emails) ? b.emails : [];
  const d = (b.discount ?? {}) as Record<string, unknown>;
  const sp = (b.support ?? {}) as Record<string, unknown>;
  const ep = (b.exitPopup ?? {}) as Record<string, unknown>;
  const next: RecoverySettings = {
    enabled: bool(b.enabled, D.enabled),
    abandonMinutes: int(b.abandonMinutes, 1, 1440, D.abandonMinutes),
    captureCheckout: bool(b.captureCheckout, D.captureCheckout),
    capturePending: bool(b.capturePending, D.capturePending),
    captureFailed: bool(b.captureFailed, D.captureFailed),
    captureCancelled: bool(b.captureCancelled, D.captureCancelled),
    markLostAfterDays: int(b.markLostAfterDays, 0, 365, D.markLostAfterDays),
    purgeAfterDays: int(b.purgeAfterDays, 0, 3650, D.purgeAfterDays),
    emails: D.emails.map((def, i) => {
      const e = (em[i] ?? {}) as Record<string, unknown>;
      return { enabled: bool(e.enabled, def.enabled), delayMinutes: int(e.delayMinutes, 0, 60 * 24 * 60, def.delayMinutes), subject: str(e.subject, 160) || def.subject, intro: str(e.intro, 1000) || def.intro };
    }),
    heading: str(b.heading, 120) || D.heading,
    brandColor: /^#[0-9a-f]{3,8}$/i.test(str(b.brandColor, 9)) ? str(b.brandColor, 9) : D.brandColor,
    discount: { enabled: bool(d.enabled, false), code: str(d.code, 40).toUpperCase(), text: str(d.text, 300) || D.discount.text, finalOnly: bool(d.finalOnly, true), autoApply: bool(d.autoApply, true) },
    support: { whatsapp: str(sp.whatsapp, 20).replace(/\D/g, ""), whatsappMessage: str(sp.whatsappMessage, 200), email: str(sp.email, 160), phone: str(sp.phone, 40) },
    exitPopup: { enabled: bool(ep.enabled, false), title: str(ep.title, 100) || D.exitPopup.title, text: str(ep.text, 300), cta: str(ep.cta, 40) || D.exitPopup.cta, ctaStay: str(ep.ctaStay, 40) || D.exitPopup.ctaStay, cooldownHours: int(ep.cooldownHours, 0, 720, 24) },
  };
  if (next.discount.enabled && !next.discount.code) return NextResponse.json({ error: "Enter a discount code (create it in Coupons first), or switch the discount off." }, { status: 400 });
  const before = await getRecoverySettings();
  await saveRecoverySettings(next);
  await addAudit({ entity: "cart-recovery", entityId: "settings", action: "edit", actor: actorName(actor), summary: "Cart Recovery settings updated", before: before as unknown as Record<string, unknown>, after: next as unknown as Record<string, unknown> });
  return NextResponse.json({ ok: true, settings: next });
}
