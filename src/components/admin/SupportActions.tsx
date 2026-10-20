"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";

const field = "w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

export function SupportActions({ id, status, statuses, canEdit, clientEmail }: {
  id: number; status: string; statuses: [string, string][]; canEdit: boolean; clientEmail: string;
}) {
  const router = useRouter();
  const label = Object.fromEntries(statuses);
  const [message, setMessage] = useState("");
  const [replyStatus, setReplyStatus] = useState(status === "open" ? "waiting" : status === "closed" ? "closed" : "waiting");
  const [newStatus, setNewStatus] = useState(status);
  const [pending, setPending] = useState<"reply" | "status" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<{ prev: string; message: string } | null>(null);

  if (!canEdit) return <p className="card p-4 text-sm text-muted">Your role can view support requests but not reply. Ask a manager to respond.</p>;

  async function yes() {
    setBusy(true); setMsg(null);
    const res = pending === "reply"
      ? await fetch(`/api/admin/support/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, status: replyStatus }) })
      : await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Failed." }); setPending(null); return; }
    if (pending === "reply") {
      setMessage("");
      setMsg(d.emailed ? { ok: true, text: `✓ Reply sent to ${clientEmail}` } : { ok: false, text: "Reply saved and shown in the client's account, but the email failed. Check Admin → Emails." });
    } else {
      setMsg({ ok: true, text: "✓ Status updated" });
      setUndo({ prev: d.previous, message: `Status changed to ${label[newStatus]}` });
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-5">
        <h2 className="font-display text-lg">Reply to the client</h2>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Write your reply… It's emailed to the client and shown in their account." className={`${field} py-2`} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted">Status after replying
            <select value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)} className={`${field} mt-1 h-10`}>
              {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <button className="btn btn-volt h-10 px-5" disabled={message.trim().length < 2} onClick={() => setPending("reply")}>Send reply</button>
        </div>
      </div>
      <div className="card flex flex-wrap items-end gap-3 p-5">
        <label className="text-xs font-semibold text-muted">Change status only (no email)
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={`${field} mt-1 h-10`}>
            {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn btn-dark h-10 px-4" disabled={newStatus === status} onClick={() => setPending("status")}>Save status</button>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}

      <ConfirmDialog open={!!pending} busy={busy} onNo={() => setPending(null)} onYes={yes}
        title={pending === "reply" ? `Send this reply to ${clientEmail}?` : "Are you sure you want to change this?"}
        yesLabel={pending === "reply" ? "Yes, send" : "Yes, save"}>
        {pending === "reply" ? (
          <div className="space-y-2">
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm">{message}</p>
            {replyStatus !== status && <ChangeList changes={[{ label: "Status", from: label[status], to: label[replyStatus] }]} />}
          </div>
        ) : (
          <ChangeList changes={[{ label: "Status", from: label[status], to: label[newStatus] }]} />
        )}
      </ConfirmDialog>
      {undo && <UndoBar message={undo.message} onClose={() => setUndo(null)}
        onUndo={async () => { await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: undo.prev, undo: true }) }); setNewStatus(undo.prev); router.refresh(); }} />}
    </div>
  );
}
