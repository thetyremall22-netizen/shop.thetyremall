"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteSettings } from "@/lib/settings";
import { TIMEZONE_OPTIONS } from "@/lib/tz";

const field = "mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const label = "text-xs font-bold uppercase tracking-wide text-muted";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [v, setV] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function up<G extends keyof SiteSettings>(group: G, key: keyof SiteSettings[G], val: unknown) {
    setV((prev) => ({ ...prev, [group]: { ...prev[group], [key]: val } }));
    setDone(false);
  }

  async function save() {
    if (busy) return;
    setBusy(true); setDone(false); setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); if (d.settings) setV(d.settings); router.refresh(); }
      else setError(d.error ?? "Couldn't save.");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const rand = (cents: number) => (cents / 100).toString();
  const toCents = (r: string) => Math.max(0, Math.round((Number(r) || 0) * 100));

  return (
    <div className="space-y-5">
      <div className={`card p-5 ${v.maintenance.enabled ? "border-amber-500/50" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Maintenance / Coming-soon mode
              {v.maintenance.enabled && <span className="ml-2 badge badge-warn">LIVE — store hidden</span>}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">When on, the public storefront is replaced by a &quot;coming soon&quot; page and no orders can be placed. The admin panel stays open, and you (while logged in) still see the real site.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={v.maintenance.enabled} onChange={(e) => up("maintenance", "enabled", e.target.checked)} className="size-5 accent-volt" />
            {v.maintenance.enabled ? "On" : "Off"}
          </label>
        </div>
        <div className="mt-4 grid gap-4">
          <label className="block"><span className={label}>Heading</span>
            <input value={v.maintenance.heading} onChange={(e) => up("maintenance", "heading", e.target.value)} className={field} /></label>
          <label className="block"><span className={label}>Message</span>
            <textarea value={v.maintenance.message} onChange={(e) => up("maintenance", "message", e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-volt" /></label>
          <p className="text-xs text-muted">Changes take effect within about half a minute of saving. Remember to turn this <span className="font-semibold text-fg">off</span> when you&apos;re ready to open the store.</p>
        </div>
      </div>

      <Group title="Site identity">
        <label className="block"><span className={label}>Site name</span>
          <input value={v.site.name} onChange={(e) => up("site", "name", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>Tagline</span>
          <input value={v.site.tagline} onChange={(e) => up("site", "tagline", e.target.value)} className={field} /></label>
        <label className="block sm:col-span-2"><span className={label}>Copyright name (footer)</span>
          <input value={v.site.copyrightName} onChange={(e) => up("site", "copyrightName", e.target.value)} className={field} /></label>
      </Group>

      <Group title="Contact & hours">
        <label className="block"><span className={label}>Email</span>
          <input value={v.contact.email} onChange={(e) => up("contact", "email", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>Phone (display)</span>
          <input value={v.contact.phoneDisplay} onChange={(e) => up("contact", "phoneDisplay", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>Phone (dial — digits)</span>
          <input value={v.contact.phoneTel} onChange={(e) => up("contact", "phoneTel", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>WhatsApp number (intl digits)</span>
          <input value={v.contact.whatsappNumber} onChange={(e) => up("contact", "whatsappNumber", e.target.value)} placeholder="27780088788" className={field} /></label>
        <label className="block sm:col-span-2"><span className={label}>WhatsApp quick link (wa.link/…)</span>
          <input value={v.contact.whatsappLink} onChange={(e) => up("contact", "whatsappLink", e.target.value)} className={field} /></label>
        <label className="block sm:col-span-2"><span className={label}>Address</span>
          <textarea value={v.contact.addressLines} onChange={(e) => up("contact", "addressLines", e.target.value)} rows={2} className={`${field} h-auto py-2`} /></label>
        <label className="block sm:col-span-2"><span className={label}>Hours</span>
          <input value={v.contact.hours} onChange={(e) => up("contact", "hours", e.target.value)} className={field} /></label>
      </Group>

      <Group title="Tax invoice details">
        <label className="block sm:col-span-2"><span className={label}>Registered business name</span>
          <input value={v.invoice.legalName} onChange={(e) => up("invoice", "legalName", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>VAT number</span>
          <input value={v.invoice.vatNumber} onChange={(e) => up("invoice", "vatNumber", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>Company registration no. (optional)</span>
          <input value={v.invoice.regNumber} onChange={(e) => up("invoice", "regNumber", e.target.value)} className={field} /></label>
        <label className="block sm:col-span-2"><span className={label}>Invoice footer (e.g. banking details, terms)</span>
          <textarea value={v.invoice.footer} onChange={(e) => up("invoice", "footer", e.target.value)} rows={3} className={`${field} h-auto py-2`} /></label>
      </Group>

      <Group title="Social links">
        <label className="block"><span className={label}>Facebook URL</span>
          <input value={v.social.facebook} onChange={(e) => up("social", "facebook", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>Instagram URL</span>
          <input value={v.social.instagram} onChange={(e) => up("social", "instagram", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>TikTok URL</span>
          <input value={v.social.tiktok} onChange={(e) => up("social", "tiktok", e.target.value)} className={field} /></label>
        <label className="block"><span className={label}>YouTube URL</span>
          <input value={v.social.youtube} onChange={(e) => up("social", "youtube", e.target.value)} className={field} /></label>
      </Group>

      <Group title="Commerce">
        <label className="block"><span className={label}>Free delivery — min tyres</span>
          <input type="number" min={1} value={v.commerce.freeDeliveryMinTyres} onChange={(e) => up("commerce", "freeDeliveryMinTyres", Number(e.target.value))} className={field} /></label>
        <label className="block"><span className={label}>Single-tyre delivery fee (R)</span>
          <input type="number" min={0} step="0.01" value={rand(v.commerce.standardDeliveryFee)} onChange={(e) => up("commerce", "standardDeliveryFee", toCents(e.target.value))} className={field} /></label>
        <label className="block"><span className={label}>VAT rate (%)</span>
          <input type="number" min={0} max={100} step="0.1" value={v.commerce.vatRate} onChange={(e) => up("commerce", "vatRate", Number(e.target.value))} className={field} /></label>
        <label className="block"><span className={label}>HappyPay months</span>
          <input type="number" min={1} value={v.commerce.happyPayMonths} onChange={(e) => up("commerce", "happyPayMonths", Number(e.target.value))} className={field} /></label>
        <label className="block"><span className={label}>Road-hazard cover, per tyre (R)</span>
          <input type="number" min={0} step="0.01" value={rand(v.commerce.roadHazardFee)} onChange={(e) => up("commerce", "roadHazardFee", toCents(e.target.value))} className={field} /></label>
        <label className="flex items-center gap-2.5 pt-6">
          <input type="checkbox" checked={v.commerce.vatIncluded} onChange={(e) => up("commerce", "vatIncluded", e.target.checked)} className="size-4 accent-volt" />
          <span className="text-sm font-semibold text-fg">Prices shown include VAT</span>
        </label>
        <label className="block sm:col-span-2"><span className={label}>Store timezone</span>
          <select value={v.commerce.timezone} onChange={(e) => up("commerce", "timezone", e.target.value)} className={field}>
            {TIMEZONE_OPTIONS.map((tz) => (<option key={tz} value={tz}>{tz.replace("_", " ")}</option>))}
          </select>
          <span className="mt-1 block text-xs text-muted">Coupon &amp; special start/end times run on this timezone — they go live and expire at the right local moment regardless of where you edit from.</span>
        </label>
      </Group>

      <Group title="Email (sending)">
        <p className="col-span-full -mb-1 text-sm text-muted">How the site sends order confirmations and notifications. For Microsoft 365, use host <span className="font-mono text-fg">smtp.office365.com</span>, port <span className="font-mono text-fg">587</span>, your <span className="font-mono text-fg">shop@</span> address and its password (or app password). Leave blank to fall back to server env vars.</p>
        <label className="block"><span className={label}>SMTP host</span>
          <input value={v.email.smtpHost} onChange={(e) => up("email", "smtpHost", e.target.value)} placeholder="smtp.office365.com" className={field} /></label>
        <label className="block"><span className={label}>SMTP port</span>
          <input type="number" min={1} max={65535} value={v.email.smtpPort} onChange={(e) => up("email", "smtpPort", Number(e.target.value))} className={field} /></label>
        <label className="block"><span className={label}>SMTP username</span>
          <input value={v.email.smtpUser} onChange={(e) => up("email", "smtpUser", e.target.value)} placeholder="shop@thetyremall.co.za" autoComplete="off" className={field} /></label>
        <label className="block"><span className={label}>SMTP password</span>
          <input type="password" value={v.email.smtpPass} onChange={(e) => up("email", "smtpPass", e.target.value)} autoComplete="new-password" className={field} /></label>
        <label className="block"><span className={label}>From address</span>
          <input value={v.email.mailFrom} onChange={(e) => up("email", "mailFrom", e.target.value)} placeholder="The Tyre Mall <shop@thetyremall.co.za>" className={field} /></label>
        <label className="block"><span className={label}>CC on every email (optional)</span>
          <input value={v.email.emailCc} onChange={(e) => up("email", "emailCc", e.target.value)} placeholder="shop@thetyremall.co.za" className={field} /></label>
        <label className="flex items-center gap-2.5 pt-6">
          <input type="checkbox" checked={v.email.smtpSecure} onChange={(e) => up("email", "smtpSecure", e.target.checked)} className="size-4 accent-volt" />
          <span className="text-sm font-semibold text-fg">Use SSL (port 465). Leave off for 587/STARTTLS.</span>
        </label>
        <label className="block sm:col-span-2"><span className={label}>Resend API key (optional — use instead of SMTP)</span>
          <input type="password" value={v.email.resendApiKey} onChange={(e) => up("email", "resendApiKey", e.target.value)} placeholder="re_…" autoComplete="off" className={field} /></label>
      </Group>

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-ink/80 px-1 py-3 backdrop-blur">
        <button onClick={save} disabled={busy} className="btn btn-volt px-6 disabled:opacity-50">{busy ? "Saving…" : "Save settings"}</button>
        {done && <span className="text-sm font-semibold text-pay">✓ Saved — live on the storefront</span>}
        {error && <span className="text-sm font-semibold text-sale">{error}</span>}
        <span className="ml-auto text-xs text-muted">Changes appear on the storefront within a few seconds.</span>
      </div>
    </div>
  );
}
