"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { useAccount } from "@/lib/account-client";

export const field = "h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
export const lab = "mb-1.5 block text-xs font-semibold text-muted";

export function FieldErr({ msg }: { msg?: string }) {
  return msg ? <span className="mt-1 block text-xs font-semibold text-sale">{msg}</span> : null;
}

type Mode = "signin" | "register" | "forgot" | "sent" | "reset-sent";

/** Only same-site paths are allowed as the "come back here" address. */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

export function AuthForms({ initial = "signin" }: { initial?: Mode }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { refresh } = useAccount();
  const next = safeNext(sp.get("next"));
  const wish = sp.get("wish");
  const [mode, setMode] = useState<Mode>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);

  function go(m: Mode) { setMode(m); setErr(null); setErrors({}); setUnverified(false); setResent(false); }

  async function post(url: string, body: unknown): Promise<{ ok: boolean; d: Record<string, unknown> }> {
    setBusy(true); setErr(null); setErrors({});
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(String(d.error ?? "Something went wrong. Please try again.")); setErrors((d.errors as Record<string, string>) ?? {}); }
      return { ok: res.ok, d };
    } catch {
      setErr("Couldn't reach the server. Check your connection and try again.");
      return { ok: false, d: {} };
    } finally {
      setBusy(false);
    }
  }

  async function afterSignIn() {
    if (wish) await fetch("/api/account/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: wish }) }).catch(() => {});
    await refresh();
    router.replace(wish && next === "/account" ? "/wishlist" : next);
    router.refresh();
  }

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { ok, d } = await post("/api/account/login", { email: fd.get("email"), password: fd.get("password") });
    if (ok) await afterSignIn();
    else if (d.unverified) setUnverified(true);
  }

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get("password") !== fd.get("password2")) { setErrors({ password2: "The two passwords don't match." }); setErr("Please fix the highlighted fields."); return; }
    const em = String(fd.get("email") ?? "");
    const { ok } = await post("/api/account/register", {
      firstName: fd.get("firstName"), lastName: fd.get("lastName"), email: em, phone: fd.get("phone"),
      password: fd.get("password"), wishlistEmails: fd.get("wishlistEmails") === "on",
      next: wish ? `/wishlist` : next,
    });
    if (ok) { setEmail(em); setMode("sent"); }
  }

  async function forgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const em = String(new FormData(e.currentTarget).get("email") ?? "");
    const { ok } = await post("/api/account/forgot", { email: em });
    if (ok) { setEmail(em); setMode("reset-sent"); }
  }

  async function resend(addr: string) {
    const { ok } = await post("/api/account/resend", { email: addr });
    if (ok) setResent(true);
  }


  if (mode === "sent" || mode === "reset-sent") {
    return (
      <div className="card p-6 text-center">
        <div className="text-4xl" aria-hidden>📧</div>
        <h2 className="mt-2 font-display text-2xl">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          {mode === "sent"
            ? <>We&apos;ve sent a link to <b className="text-fg">{email}</b>. Click it to confirm your email address and open your account.</>
            : <>If there&apos;s an account for <b className="text-fg">{email}</b>, we&apos;ve sent a link to choose a new password. It works for 2 hours.</>}
        </p>
        <p className="mt-2 text-xs text-muted">Can&apos;t see it? Check your spam or promotions folder.</p>
        {mode === "sent" && (resent
          ? <p className="mt-4 text-sm font-semibold text-pay">✓ Sent again</p>
          : <button className="btn btn-ghost mt-4" disabled={busy} onClick={() => resend(email)}>Resend the email</button>)}
        {err && <p className="mt-3 text-sm font-semibold text-sale">{err}</p>}
        <button className="mt-4 block w-full text-sm font-semibold text-volt hover:underline" onClick={() => go("signin")}>Back to sign in</button>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {mode !== "forgot" && (
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["signin", "register"] as const).map((m) => (
            <button key={m} onClick={() => go(m)} className={`h-10 rounded-lg text-sm font-bold ${mode === m ? "bg-volt text-volt-ink" : "text-muted hover:text-fg"}`}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
      )}

      {wish && mode !== "forgot" && (
        <p className="mb-4 rounded-lg border border-volt/40 bg-volt/10 px-3 py-2 text-sm text-fg">♥ Sign in or create a free account to save items to your wishlist. We&apos;ll keep it for you on any device, and can let you know when they go on sale or come back in stock.</p>
      )}

      {mode === "signin" && (
        <form onSubmit={signIn} className="space-y-4">
          <label className="block"><span className={lab}>Email</span><input name="email" type="email" autoComplete="email" required className={field} /></label>
          <label className="block"><span className={lab}>Password</span><PasswordInput name="password" autoComplete="current-password" required className={field} /></label>
          {err && <p className="text-sm font-semibold text-sale">{err}</p>}
          {unverified && (resent
            ? <p className="text-sm font-semibold text-pay">✓ We&apos;ve sent a new confirmation link.</p>
            : <button type="button" className="text-sm font-bold text-volt hover:underline" disabled={busy}
                onClick={(e) => resend(String(new FormData(e.currentTarget.form!).get("email") ?? ""))}>Resend confirmation email</button>)}
          <button className="btn btn-volt h-11 w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          <button type="button" onClick={() => go("forgot")} className="block w-full text-center text-sm font-semibold text-muted hover:text-volt">Forgot password?</button>
        </form>
      )}

      {mode === "register" && (
        <form onSubmit={register} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lab}>First name</span><input name="firstName" autoComplete="given-name" className={field} /><FieldErr msg={errors.firstName} /></label>
            <label className="block"><span className={lab}>Surname</span><input name="lastName" autoComplete="family-name" className={field} /><FieldErr msg={errors.lastName} /></label>
          </div>
          <label className="block"><span className={lab}>Email</span><input name="email" type="email" autoComplete="email" className={field} /><FieldErr msg={errors.email} />
            <span className="mt-1 block text-xs text-muted">Use the email you order with, so your past orders show in your account.</span></label>
          <label className="block"><span className={lab}>Mobile number</span><input name="phone" type="tel" autoComplete="tel" placeholder="082 123 4567" className={field} /><FieldErr msg={errors.phone} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lab}>Password (8+ characters)</span><PasswordInput name="password" autoComplete="new-password" className={field} /><FieldErr msg={errors.password} /></label>
            <label className="block"><span className={lab}>Confirm password</span><PasswordInput name="password2" autoComplete="new-password" className={field} /><FieldErr msg={errors.password2} /></label>
          </div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="wishlistEmails" defaultChecked className="mt-0.5 size-4 accent-[var(--color-volt)]" />
            Email me when items on my wishlist go on sale or come back in stock
          </label>
          {err && <p className="text-sm font-semibold text-sale">{err}</p>}
          <button className="btn btn-volt h-11 w-full" disabled={busy}>{busy ? "Creating your account…" : "Create account"}</button>
          <p className="text-center text-xs text-muted">We&apos;ll email you a link to confirm your address. Your details are only used for your orders and account.</p>
        </form>
      )}

      {mode === "forgot" && (
        <form onSubmit={forgot} className="space-y-4">
          <h2 className="font-display text-2xl">Forgot your password?</h2>
          <p className="text-sm text-muted">Enter your account email and we&apos;ll send you a link to choose a new one.</p>
          <label className="block"><span className={lab}>Email</span><input name="email" type="email" autoComplete="email" required className={field} /></label>
          {err && <p className="text-sm font-semibold text-sale">{err}</p>}
          <button className="btn btn-volt h-11 w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          <button type="button" onClick={() => go("signin")} className="block w-full text-center text-sm font-semibold text-muted hover:text-volt">Back to sign in</button>
        </form>
      )}
    </div>
  );
}
