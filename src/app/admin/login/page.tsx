"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/admin/PasswordInput";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — must stay empty
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // Never leave the button stuck on "Signing in…": give up after 20s and
    // show a clear message if the server can't be reached.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, website }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Login failed.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
    setBusy(false);
  }

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-7">
        <div className="mb-1 font-display text-2xl">
          <span className="text-chrome">TYRE MALL</span> <span className="text-volt-grad">ADMIN</span>
        </div>
        <p className="mb-5 text-sm text-muted">Sign in to manage stock, prices and orders.</p>
        {/* Honeypot: hidden from humans; bots that auto-fill it are rejected. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <label className="mb-1.5 block text-xs font-semibold text-muted">Email</label>
        <input
          type="email"
          value={email}
          autoFocus
          autoComplete="username"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@thetyremall.co.za"
          className="mb-3 h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
        />
        <label className="mb-1.5 block text-xs font-semibold text-muted">Password</label>
        <PasswordInput
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
        />
        <div className="mt-2 text-right">
          <Link href="/admin/forgot" className="text-xs font-semibold text-muted hover:text-volt">Forgot password?</Link>
        </div>
        {error && <div className="mt-3 rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}
        <button type="submit" disabled={busy} className="btn btn-volt mt-5 w-full py-3 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
