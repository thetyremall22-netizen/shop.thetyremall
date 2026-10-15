"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: number;
  to: string;
  subject: string;
  html: string;
}

export function EmailResendForm({ id, to: to0, subject: subject0, html: html0 }: Props) {
  const router = useRouter();
  const [to, setTo] = useState(to0);
  const [subject, setSubject] = useState(subject0);
  const [html, setHtml] = useState(html0);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = to !== to0 || subject !== subject0 || html !== html0;

  async function send() {
    if (busy) return;
    setBusy(true); setDone(false); setError(null);
    try {
      const res = await fetch(`/api/admin/emails/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, html }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); router.refresh(); }
      else setError(d.error ?? "Couldn't send.");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  function reset() {
    setTo(to0); setSubject(subject0); setHtml(html0); setDone(false); setError(null);
  }

  const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">To</span>
          <input value={to} onChange={(e) => { setTo(e.target.value); setDone(false); }} className={`mt-1 ${field}`} />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Subject</span>
          <input value={subject} onChange={(e) => { setSubject(e.target.value); setDone(false); }} className={`mt-1 ${field}`} />
        </label>
      </div>

      <div>
        <button type="button" onClick={() => setEdit((v) => !v)} className="text-sm font-semibold text-volt hover:underline">
          {edit ? "Hide message HTML" : "Edit message (HTML)"}
        </button>
        {edit && (
          <textarea
            value={html}
            onChange={(e) => { setHtml(e.target.value); setDone(false); }}
            spellCheck={false}
            className="mt-2 h-56 w-full rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs text-fg outline-none focus:border-volt"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button onClick={send} disabled={busy} className="btn btn-volt px-5 disabled:opacity-50">
          {busy ? "Sending…" : dirty ? "Send edited email" : "Resend email"}
        </button>
        {dirty && <button onClick={reset} disabled={busy} className="text-sm font-semibold text-muted hover:text-fg">Reset to original</button>}
        {done && <span className="text-sm font-semibold text-pay">✓ Sent{dirty ? " (edited)" : ""} — logged above</span>}
        {error && <span className="text-sm font-semibold text-sale">{error}</span>}
      </div>
      <p className="text-xs text-muted">Resending creates a new entry in the email log. A copy is CC&apos;d to the shop as usual.</p>
    </div>
  );
}
