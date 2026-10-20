"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { useAccount, type AccountInfo } from "@/lib/account-client";
import { field, lab, FieldErr } from "./AuthForms";

const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

export function DetailsForm({ initial, wishlistEmails }: { initial: AccountInfo; wishlistEmails: boolean }) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [v, setV] = useState(initial);
  const [wish, setWish] = useState(wishlistEmails);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const up = (k: keyof AccountInfo, val: string) => setV({ ...v, [k]: val });
  const upA = (k: keyof AccountInfo["address"], val: string) => setV({ ...v, address: { ...v.address, [k]: val } });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErrors({});
    const res = await fetch("/api/account/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: v.firstName, lastName: v.lastName, phone: v.phone, address: v.address, wishlistEmails: wish }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save. Please try again." }); setErrors(d.errors ?? {}); return; }
    setMsg({ ok: true, text: "✓ Your details are saved." });
    await refresh();
    router.refresh();
  }


  return (
    <form onSubmit={save} className="card space-y-5 p-5" noValidate>
      <div>
        <h2 className="font-display text-xl">Your details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block"><span className={lab}>First name</span><input value={v.firstName} onChange={(e) => up("firstName", e.target.value)} className={field} /><FieldErr msg={errors.firstName} /></label>
          <label className="block"><span className={lab}>Surname</span><input value={v.lastName} onChange={(e) => up("lastName", e.target.value)} className={field} /><FieldErr msg={errors.lastName} /></label>
          <label className="block"><span className={lab}>Mobile number</span><input value={v.phone} onChange={(e) => up("phone", e.target.value)} type="tel" className={field} /><FieldErr msg={errors.phone} /></label>
          <label className="block"><span className={lab}>Email</span><input value={v.email} disabled className={`${field} opacity-60`} />
            <span className="mt-1 block text-xs text-muted">Your email links your orders to this account. To change it, send us a support request.</span></label>
        </div>
      </div>
      <div>
        <h2 className="font-display text-xl">Delivery address</h2>
        <p className="text-xs text-muted">Filled in for you at checkout. Changing it here doesn&apos;t change orders you&apos;ve already placed.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className={lab}>Street address</span><input value={v.address.street} onChange={(e) => upA("street", e.target.value)} autoComplete="street-address" className={field} /></label>
          <label className="block"><span className={lab}>Suburb</span><input value={v.address.suburb} onChange={(e) => upA("suburb", e.target.value)} className={field} /></label>
          <label className="block"><span className={lab}>City</span><input value={v.address.city} onChange={(e) => upA("city", e.target.value)} autoComplete="address-level2" className={field} /></label>
          <label className="block"><span className={lab}>Province</span>
            <select value={v.address.province} onChange={(e) => upA("province", e.target.value)} className={field}>
              <option value="">Choose…</option>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              {v.address.province && !PROVINCES.includes(v.address.province) && <option>{v.address.province}</option>}
            </select></label>
          <label className="block"><span className={lab}>Postal code</span><input value={v.address.postalCode} onChange={(e) => upA("postalCode", e.target.value)} autoComplete="postal-code" inputMode="numeric" className={field} /></label>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-fg">
        <input type="checkbox" checked={wish} onChange={(e) => setWish(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-volt)]" />
        Email me when items on my wishlist go on sale, drop in price or come back in stock
      </label>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      <button className="btn btn-volt h-11 px-6" disabled={busy}>{busy ? "Saving…" : "Save my details"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (fd.get("next") !== fd.get("next2")) { setMsg({ ok: false, text: "The new passwords don't match." }); return; }
    setBusy(true); setMsg(null);
    const res = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: fd.get("current"), next: fd.get("next") }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't change your password." }); return; }
    form.reset();
    setMsg({ ok: true, text: "✓ Password changed. Any other devices have been signed out." });
  }
  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <h2 className="font-display text-xl">Change password</h2>
      <label className="block"><span className={lab}>Current password</span><PasswordInput name="current" autoComplete="current-password" required className={field} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={lab}>New password (8+ characters)</span><PasswordInput name="next" autoComplete="new-password" required minLength={8} className={field} /></label>
        <label className="block"><span className={lab}>Confirm new password</span><PasswordInput name="next2" autoComplete="new-password" required minLength={8} className={field} /></label>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      <button className="btn btn-ghost h-11 px-6" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
    </form>
  );
}
