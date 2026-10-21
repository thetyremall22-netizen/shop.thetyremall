import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateSettings, type SiteSettings } from "@/lib/settings";

const s = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && isFinite(Number(v)) ? Number(v) : undefined);
const b = (v: unknown) => (typeof v === "boolean" ? v : undefined);

function clean<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(obj)) if (val !== undefined) out[k] = val;
  return out as Partial<T>;
}

export async function PATCH(req: NextRequest) {
  if (!(await authorize("settings.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Partial<SiteSettings>;
  try {
    body = (await req.json()) as Partial<SiteSettings>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const patch: Partial<SiteSettings> = {};

  if (body.site) {
    const url = s(body.site.copyrightUrl, 300);
    patch.site = clean({
      name: s(body.site.name, 120), tagline: s(body.site.tagline, 200), copyrightName: s(body.site.copyrightName, 120),
      // Only http(s) or site-relative links.
      copyrightUrl: url === undefined ? undefined : url === "" || /^(https?:\/\/|\/)/i.test(url) ? url : `https://${url}`,
      copyrightText: s(body.site.copyrightText, 200), footerNote: s(body.site.footerNote, 200),
    }) as SiteSettings["site"];
  }
  if (body.contact) {
    const c = body.contact;
    patch.contact = clean({
      email: s(c.email, 160),
      phoneDisplay: s(c.phoneDisplay, 40),
      phoneTel: s(c.phoneTel, 40)?.replace(/[^\d+]/g, ""),
      whatsappNumber: s(c.whatsappNumber, 40)?.replace(/[^\d]/g, ""),
      whatsappLink: s(c.whatsappLink, 300),
      addressLines: s(c.addressLines, 400),
      hours: s(c.hours, 200),
    }) as SiteSettings["contact"];
  }
  if (body.social) {
    const so = body.social;
    patch.social = clean({ facebook: s(so.facebook, 300), instagram: s(so.instagram, 300), tiktok: s(so.tiktok, 300), youtube: s(so.youtube, 300) }) as SiteSettings["social"];
  }
  if (body.commerce) {
    const m = body.commerce;
    const vat = n(m.vatRate);
    patch.commerce = clean({
      freeDeliveryMinTyres: n(m.freeDeliveryMinTyres) !== undefined ? Math.max(1, Math.round(n(m.freeDeliveryMinTyres)!)) : undefined,
      standardDeliveryFee: n(m.standardDeliveryFee) !== undefined ? Math.max(0, Math.round(n(m.standardDeliveryFee)!)) : undefined,
      vatRate: vat !== undefined ? Math.max(0, Math.min(100, vat)) : undefined,
      vatIncluded: b(m.vatIncluded),
      happyPayMonths: n(m.happyPayMonths) !== undefined ? Math.max(1, Math.round(n(m.happyPayMonths)!)) : undefined,
      roadHazardFee: n(m.roadHazardFee) !== undefined ? Math.max(0, Math.round(n(m.roadHazardFee)!)) : undefined,
      timezone: s(m.timezone, 64),
    }) as SiteSettings["commerce"];
  }
  if (body.invoice) {
    const iv = body.invoice;
    patch.invoice = clean({
      legalName: s(iv.legalName, 160), vatNumber: s(iv.vatNumber, 40),
      regNumber: s(iv.regNumber, 40), footer: s(iv.footer, 1000),
    }) as SiteSettings["invoice"];
  }
  if (body.clientZone) {
    const cz = body.clientZone;
    patch.clientZone = clean({ wishlistAlerts: b(cz.wishlistAlerts), supportEmail: s(cz.supportEmail, 160) }) as SiteSettings["clientZone"];
  }
  if (body.access) {
    patch.access = clean({ southAfricaOnly: b(body.access.southAfricaOnly) }) as SiteSettings["access"];
  }
  if (body.maintenance) {
    const mt = body.maintenance;
    patch.maintenance = clean({
      enabled: b(mt.enabled),
      heading: s(mt.heading, 120),
      message: s(mt.message, 600),
    }) as SiteSettings["maintenance"];
  }
  if (body.email) {
    const em = body.email;
    patch.email = clean({
      smtpHost: s(em.smtpHost, 200),
      smtpPort: n(em.smtpPort) !== undefined ? Math.max(1, Math.min(65535, Math.round(n(em.smtpPort)!))) : undefined,
      smtpSecure: b(em.smtpSecure),
      smtpUser: s(em.smtpUser, 200),
      smtpPass: s(em.smtpPass, 400),
      mailFrom: s(em.mailFrom, 200),
      emailCc: s(em.emailCc, 400),
      resendApiKey: s(em.resendApiKey, 200),
    }) as SiteSettings["email"];
  }

  try {
    const next = await updateSettings(patch);
    return NextResponse.json({ ok: true, settings: next });
  } catch (e) {
    return NextResponse.json({ error: `Save failed: ${(e as Error).message}` }, { status: 500 });
  }
}
