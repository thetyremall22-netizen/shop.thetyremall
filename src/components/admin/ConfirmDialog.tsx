"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** "Are you sure?" pop-up used before every admin change. */
export function ConfirmDialog({
  open, title = "Are you sure you want to change this?", children, yesLabel = "Yes, save", noLabel = "No",
  danger = false, busy = false, onYes, onNo,
}: {
  open: boolean;
  title?: string;
  children?: ReactNode;
  yesLabel?: string;
  noLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onNo(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onNo]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onNo} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-ink-2 p-5 shadow-2xl">
        <h3 id="confirm-title" className="font-display text-lg text-fg">{title}</h3>
        {children && <div className="mt-2 text-sm text-muted">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={noRef} type="button" onClick={onNo} disabled={busy} className="btn btn-dark px-5">{noLabel}</button>
          <button type="button" onClick={onYes} disabled={busy}
            className={`btn px-5 ${danger ? "bg-sale text-white hover:opacity-90" : "btn-volt"} disabled:opacity-60`}>
            {busy ? "Saving…" : yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lists the changed fields inside the confirm pop-up. */
export function ChangeList({ changes }: { changes: { label: string; from: string; to: string }[] }) {
  if (!changes.length) return <p>No changes.</p>;
  return (
    <ul className="mt-1 space-y-1.5">
      {changes.map((c) => (
        <li key={c.label} className="rounded-lg bg-surface px-3 py-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">{c.label}</span>
          <span className="text-fg"><s className="text-faint">{c.from || "(empty)"}</s> → <b>{c.to || "(empty)"}</b></span>
        </li>
      ))}
    </ul>
  );
}

/** "Saved — Undo" bar shown after a change. Disappears after `seconds`. */
export function UndoBar({
  message, onUndo, onClose, seconds = 20,
}: { message: string; onUndo: () => Promise<void> | void; onClose: () => void; seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) { onClose(); return; }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left, onClose]);
  return (
    <div className="fixed bottom-5 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-ink px-4 py-3 text-sm shadow-2xl" role="status">
      <span className="font-semibold text-pay">✓</span>
      <span className="text-fg">{message}</span>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onUndo(); setBusy(false); onClose(); }}
        className="rounded-lg border border-volt px-3 py-1 text-xs font-bold text-volt hover:bg-volt hover:text-volt-ink disabled:opacity-60">
        {busy ? "Undoing…" : `Undo (${left}s)`}
      </button>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="text-muted hover:text-fg">✕</button>
    </div>
  );
}
