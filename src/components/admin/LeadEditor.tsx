"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";

type FieldDef = { k: Key; label: string; type?: string; multiline?: boolean };
const KEYS = ["name", "email", "phone", "product_name", "sku", "product_url", "message", "notes"] as const;
type Key = (typeof KEYS)[number];
const FIELDS: FieldDef[] = [
  { k: "name", label: "Name" },
  { k: "email", label: "Email", type: "email" },
  { k: "phone", label: "Phone", type: "tel" },
  { k: "product_name", label: "Product" },
  { k: "sku", label: "SKU / part number" },
  { k: "product_url", label: "Product link" },
  { k: "message", label: "Message", multiline: true },
  { k: "notes", label: "Internal notes (staff only)", multiline: true },
];
type Values = Record<Key, string>;

/** View every field of a lead, and (with permission) edit it behind an
 *  "Are you sure?" step, with Undo afterwards. */
export function LeadEditor({ id, initial, canEdit }: { id: number; initial: Values; canEdit: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Values>(initial);
  const [draft, setDraft] = useState<Values>(initial);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Partial<Record<Key, string>>>({});
  const [undo, setUndo] = useState<Values | null>(null);

  const changes = FIELDS
    .filter((f) => (draft[f.k] ?? "").trim() !== (saved[f.k] ?? "").trim())
    .map((f) => ({ label: f.label, from: saved[f.k] ?? "", to: draft[f.k] ?? "" }));

  async function send(values: Partial<Values>, isUndo = false): Promise<Values | null> {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, undo: isUndo }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Couldn't save.");
      setFieldErr(d.errors ?? {});
      return null;
    }
    const after = Object.fromEntries(FIELDS.map((f) => [f.k, d.after?.[f.k] ?? ""])) as Values;
    return after;
  }

  async function save() {
    setBusy(true); setError(null); setFieldErr({});
    const changed = Object.fromEntries(FIELDS.filter((f) => (draft[f.k] ?? "").trim() !== (saved[f.k] ?? "").trim()).map((f) => [f.k, draft[f.k]]));
    const previous = saved;
    const after = await send(changed);
    setBusy(false); setConfirm(false);
    if (!after) return;
    setSaved(after); setDraft(after); setEditing(false);
    setUndo(previous);
    router.refresh();
  }

  const doUndo = useCallback(async () => {
    if (!undo) return;
    const after = await send(undo, true);
    if (after) { setSaved(after); setDraft(after); router.refresh(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo]);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">Details</h2>
        {canEdit && !editing && (
          <button type="button" onClick={() => { setEditing(true); setError(null); }} className="btn btn-volt-outline h-9 px-4 text-xs">✏️ Edit lead</button>
        )}
      </div>

      {!editing ? (
        <dl className="mt-3 space-y-2 text-sm">
          {FIELDS.map((f) => (
            <div key={f.k} className={f.multiline ? "" : "flex justify-between gap-3"}>
              <dt className="text-muted">{f.label}</dt>
              <dd className={`${f.multiline ? "mt-1 whitespace-pre-wrap" : "text-right break-all"} text-fg`}>
                {f.k === "email" && saved.email ? <a className="text-volt hover:underline" href={`mailto:${saved.email}`}>{saved.email}</a>
                  : f.k === "phone" && saved.phone ? <a className="text-volt hover:underline" href={`tel:${saved.phone}`}>{saved.phone}</a>
                  : f.k === "product_url" && saved.product_url ? <a className="text-volt hover:underline" href={saved.product_url} target="_blank" rel="noreferrer">Open product ↗</a>
                  : saved[f.k] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (changes.length) setConfirm(true); }}>
          {FIELDS.map((f) => (
            <label key={f.k} className="block">
              <span className="mb-1 block text-xs font-semibold text-muted">{f.label}</span>
              {f.multiline ? (
                <textarea value={draft[f.k]} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })} rows={4}
                  className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-volt" />
              ) : (
                <input type={f.type ?? "text"} value={draft[f.k]} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
                  aria-invalid={!!fieldErr[f.k]}
                  className={`h-10 w-full rounded-lg border bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt ${fieldErr[f.k] ? "border-sale" : "border-line"}`} />
              )}
              {fieldErr[f.k] && <span className="mt-1 block text-xs font-semibold text-sale">{fieldErr[f.k]}</span>}
            </label>
          ))}
          {error && <p className="text-sm font-semibold text-sale">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setDraft(saved); setEditing(false); setError(null); setFieldErr({}); }} className="btn btn-dark flex-1">Cancel</button>
            <button type="submit" disabled={!changes.length} className="btn btn-volt flex-1 disabled:opacity-50">Save changes</button>
          </div>
        </form>
      )}

      <ConfirmDialog open={confirm} busy={busy} onYes={save} onNo={() => setConfirm(false)} yesLabel="Yes, change it">
        <ChangeList changes={changes} />
      </ConfirmDialog>
      {undo && <UndoBar message="Lead updated" onUndo={doUndo} onClose={() => setUndo(null)} />}
    </div>
  );
}
