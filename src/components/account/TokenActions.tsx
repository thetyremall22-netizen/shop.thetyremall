"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { useAccount } from "@/lib/account-client";
import { field, lab } from "./AuthForms";

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") && n !== "/account" ? n : "/account?welcome=1");

/** "Confirm my email" button (the emailed link opens this; pressing it uses the link). */
export function ConfirmEmail({ token, next }: { token: string; next?: string }) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/account/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setErr(d.error ?? "Something went wrong."); setBusy(false); return; }
    await refresh();
    router.replace(safeNext(next));
    router.refresh();
  }
  return (
    <div className="card p-6 text-center">
      <h1 className="font-display text-3xl">Confirm your email</h1>
      <p className="mt-2 text-sm text-muted">One last step: press the button to confirm your email address and open your account.</p>
      <button className="btn btn-volt mt-5 h-11 w-full" onClick={go} disabled={busy}>{busy ? "Confirming…" : "Confirm my email"}</button>
      {err && <><p className="mt-3 text-sm font-semibold text-sale">{err}</p><Link href="/account" className="mt-3 inline-block text-sm font-bold text-volt hover:underline">Go to sign in →</Link></>}
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { refresh } = useAccount();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("password2")) { setErr("The two passwords don't match."); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/account/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: fd.get("password") }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setErr(d.error ?? "Something went wrong."); setBusy(false); return; }
    await refresh();
    router.replace("/account?reset=1");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h1 className="font-display text-3xl">Choose a new password</h1>
      <label className="block"><span className={lab}>New password (8+ characters)</span><PasswordInput name="password" autoComplete="new-password" required minLength={8} className={field} /></label>
      <label className="block"><span className={lab}>Confirm new password</span><PasswordInput name="password2" autoComplete="new-password" required minLength={8} className={field} /></label>
      {err && <p className="text-sm font-semibold text-sale">{err}</p>}
      <button className="btn btn-volt h-11 w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}

export function UnsubscribeButton({ c, t }: { c: string; t: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  async function go() {
    setState("busy");
    const res = await fetch("/api/account/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ c, t }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok) setState("done"); else { setErr(d.error ?? "Something went wrong."); setState("error"); }
  }
  return (
    <div className="card p-6 text-center">
      <h1 className="font-display text-3xl">Wishlist emails</h1>
      {state === "done" ? (
        <p className="mt-3 text-sm font-semibold text-pay">✓ Done. We won&apos;t email you about your wishlist any more. You can switch them back on in My details.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">Stop the emails telling you when items on your wishlist go on sale or come back in stock?</p>
          <button className="btn btn-volt mt-5 h-11 w-full" onClick={go} disabled={state === "busy"}>{state === "busy" ? "Saving…" : "Yes, stop wishlist emails"}</button>
          {err && <p className="mt-3 text-sm font-semibold text-sale">{err}</p>}
        </>
      )}
    </div>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { refresh } = useAccount();
  return (
    <button className={className} onClick={async () => { await fetch("/api/account/logout", { method: "POST" }); await refresh(); router.replace("/account"); router.refresh(); }}>
      Sign out
    </button>
  );
}
