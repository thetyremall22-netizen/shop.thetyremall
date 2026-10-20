"use client";

import Link from "next/link";
import { PasswordInput } from "./PasswordInput";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) { setError("Password must be at least 10 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); setTimeout(() => router.push("/admin/login"), 1500); }
      else setError(d.error ?? "Couldn't reset password.");
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  if (!token) {
    return <p className="mt-2 text-sm text-sale">This reset link is missing its token. Request a new one from the <Link href="/admin/forgot" className="font-semibold underline">forgot-password</Link> page.</p>;
  }
  if (done) {
    return <p className="mt-2 text-sm font-semibold text-pay">✓ Password updated. Redirecting you to sign in…</p>;
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="mb-1.5 block text-xs font-semibold text-muted">New password (min 10 characters)</label>
      <PasswordInput value={password} autoFocus autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
      <label className="mb-1.5 mt-3 block text-xs font-semibold text-muted">Confirm password</label>
      <PasswordInput value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
      {error && <div className="mt-3 rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}
      <button type="submit" disabled={busy} className="btn btn-volt mt-5 w-full py-3 disabled:opacity-60">{busy ? "Updating…" : "Set new password"}</button>
    </form>
  );
}
