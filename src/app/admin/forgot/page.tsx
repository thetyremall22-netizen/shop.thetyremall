"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminForgot() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, website }) });
      if (!res.ok) throw new Error(String(res.status));
      setSent(true);
    } catch {
      setErr("Couldn't send the request — please check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-7">
        <div className="mb-1 font-display text-2xl"><span className="text-chrome">TYRE MALL</span> <span className="text-volt-grad">ADMIN</span></div>
        {sent ? (
          <>
            <p className="mb-2 mt-2 text-sm text-fg">If <b>{email}</b> is a staff account, we&apos;ve emailed it a password-reset link. It&apos;s valid for 1 hour.</p>
            <p className="mb-5 text-xs text-muted">Nothing after a few minutes? Check your spam folder, and make sure you used the exact email address of your staff login.</p>
            <Link href="/admin/login" className="btn btn-volt w-full py-3 text-center">Back to sign in</Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="mb-5 text-sm text-muted">Enter the email address you sign in to the admin with, and we&apos;ll email you a reset link.</p>
            <input type="text" name="ttm_hp_x9" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
            <label className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
            <input type="email" value={email} autoFocus onChange={(e) => setEmail(e.target.value)} placeholder="you@thetyremall.co.za" className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
            {err && <p className="mt-3 text-sm font-semibold text-sale">{err}</p>}
            <button type="submit" disabled={busy || !email} className="btn btn-volt mt-5 w-full py-3 disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
            <Link href="/admin/login" className="mt-3 block text-center text-xs font-semibold text-muted hover:text-volt">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
