"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialTo?: string;
  initialSubject?: string;
  initialMessage?: string;
  orderRef?: string;
  /** When true, clear the form after a successful send (standalone compose page). */
  clearOnSend?: boolean;
}

export function ComposeEmailForm({ initialTo = "", initialSubject = "", initialMessage = "", orderRef, clearOnSend }: Props) {
  const router = useRouter();
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState(initialMessage);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true); setDone(false); setError(null);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, orderRef }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        if (clearOnSend) { setSubject(""); setMessage(""); }
        router.refresh();
      } else setError(d.error ?? "Couldn't send.");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const field = "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">To</span>
        <input type="email" value={to} onChange={(e) => { setTo(e.target.value); setDone(false); }} placeholder="customer@email.com" className={`mt-1 h-10 ${field}`} />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Subject</span>
        <input value={subject} onChange={(e) => { setSubject(e.target.value); setDone(false); }} placeholder="Subject line" className={`mt-1 h-10 ${field}`} />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Message</span>
        <textarea value={message} onChange={(e) => { setMessage(e.target.value); setDone(false); }} rows={8} placeholder="Write your message… (it'll be sent in the branded Tyre Mall template)" className={`mt-1 p-3 ${field}`} />
      </label>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button onClick={send} disabled={busy || !to || !subject || !message} className="btn btn-volt px-5 disabled:opacity-50">
          {busy ? "Sending…" : "Send email"}
        </button>
        {done && <span className="text-sm font-semibold text-pay">✓ Sent — copied to the shop &amp; logged in Emails</span>}
        {error && <span className="text-sm font-semibold text-sale">{error}</span>}
      </div>
      <p className="text-xs text-muted">Sends in the branded template and CCs shop@thetyremall.co.za. A copy is recorded in the Emails log.</p>
    </div>
  );
}
