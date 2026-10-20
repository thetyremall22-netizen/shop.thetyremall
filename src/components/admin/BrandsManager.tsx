"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";
import { ImagePicker } from "./ImagePicker";
import { ListFilter, matchesFilter } from "./ListFilter";
import { LOGO_CANVAS } from "./image-compress";

const LOGO_HINT = "Any size or shape works: the logo is fitted automatically onto a 640 × 416 px canvas (the same 3:2 shape as every brand tile on the site), centred with even spacing and a transparent background. For the sharpest result upload a PNG or SVG export at least 640 px wide, with a transparent or white background and little empty space around the logo.";

export interface BrandRow { name: string; slug: string; count: number; logo: string | null; uploadedLogo: string; showInMenu: boolean; registered: boolean }

const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

type Pending =
  | { kind: "create" }
  | { kind: "save"; b: BrandRow; name: string; logo: string; show: boolean }
  | { kind: "delete"; b: BrandRow };

export function BrandsManager({ brands, canEdit, canDelete }: { brands: BrandRow[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newLogo, setNewLogo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ name: string; logo: string; show: boolean }>({ name: "", logo: "", show: true });
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<{ slug: string; prev: { name: string; logo: string; showInMenu: boolean }; message: string } | null>(null);
  const [find, setFind] = useState("");
  const shown = brands.filter((b) => matchesFilter({ name: b.name }, find));

  async function yes() {
    if (!pending) return;
    setBusy(true); setMsg(null);
    let res: Response;
    if (pending.kind === "create") res = await fetch("/api/admin/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, logo: newLogo }) });
    else if (pending.kind === "save") res = await fetch(`/api/admin/brands/${pending.b.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pending.name, logo: pending.logo, showInMenu: pending.show }) });
    else res = await fetch(`/api/admin/brands/${pending.b.slug}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Failed." }); setPending(null); return; }
    if (pending.kind === "create") { setMsg({ ok: true, text: `✓ Added ${newName.trim()}. It appears in the menus once it has products.` }); setNewName(""); setNewLogo(""); }
    if (pending.kind === "save") { setMsg({ ok: true, text: "✓ Saved" }); setOpen(null); setUndo({ slug: d.slug, prev: d.previous, message: `${pending.name} updated` }); }
    if (pending.kind === "delete") setMsg({ ok: true, text: `✓ Removed ${pending.b.name}` });
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      {canEdit && (
        <div className="card p-5">
          <h2 className="font-display text-lg">Add a new brand</h2>
          <p className="mt-1 text-xs text-muted">Add the brand and its logo here, then give products this brand (in a product&apos;s Brand field, or the <code>brand</code> column of a CSV import). It shows in the “Shop by Brands” menu and brand wall once it has products.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label><span className="mb-1 block text-xs font-semibold text-muted">Brand name</span><input className={field} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Hankook" /></label>
            <button className="btn btn-volt h-10 px-5 disabled:opacity-50" disabled={!newName.trim()} onClick={() => setPending({ kind: "create" })}>Add brand</button>
          </div>
          <div className="mt-3"><ImagePicker value={newLogo} onChange={setNewLogo} label="Logo (optional)" fit={LOGO_CANVAS} previewClass="h-[78px] w-[120px]" hint={LOGO_HINT} /></div>
        </div>
      )}

      <ListFilter value={find} onChange={setFind} placeholder="Search brands…" count={shown.length} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-2.5">Logo</th><th className="px-4 py-2.5">Brand</th><th className="px-4 py-2.5">Products</th><th className="px-4 py-2.5">In menus</th><th className="px-4 py-2.5" />
          </tr></thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.slug} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-2.5">
                  {/* Same 320×208 (3:2) shape as the logos on the site. */}
                  <div className="grid h-[52px] w-20 place-items-center overflow-hidden rounded-lg bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {b.logo ? <img src={b.logo} alt={b.name} className="h-full w-full object-contain" /> : <span className="text-center text-[10px] font-bold uppercase leading-tight text-[#14171a]">{b.name}</span>}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-fg">{b.name}</div>
                  {!b.logo && <div className="text-xs text-amber-400">No logo yet</div>}
                  {open === b.slug && canEdit && (
                    <div className="mt-3 max-w-md space-y-3">
                      <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">Name (renaming updates all {b.count} products)</span><input className={field} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                      <ImagePicker value={edit.logo} onChange={(logo) => setEdit({ ...edit, logo })} label="Logo" fit={LOGO_CANVAS} previewClass="h-[78px] w-[120px]"
                        hint={`${b.logo && !b.uploadedLogo ? "Currently using the built-in logo — upload one to replace it. " : ""}${LOGO_HINT}`} />
                      {edit.logo && <button className="text-xs font-semibold text-muted hover:text-sale" onClick={() => setEdit({ ...edit, logo: "" })}>Remove uploaded logo</button>}
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.show} onChange={(e) => setEdit({ ...edit, show: e.target.checked })} className="size-4 accent-[var(--color-volt)]" /> Show in the “Shop by Brands” menu and brand wall</label>
                      <div className="flex gap-2">
                        <button className="btn btn-dark h-9 px-3 text-xs" onClick={() => setOpen(null)}>Cancel</button>
                        <button className="btn btn-volt h-9 px-4 text-xs" onClick={() => setPending({ kind: "save", b, name: edit.name, logo: edit.logo, show: edit.show })}>Save</button>
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted">{b.count.toLocaleString()}</td>
                <td className="px-4 py-2.5">{b.showInMenu ? <span className="badge badge-pay">shown</span> : <span className="badge badge-muted">hidden</span>}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-xs font-semibold">
                  {canEdit && open !== b.slug && <button className="text-volt hover:underline" onClick={() => { setOpen(b.slug); setEdit({ name: b.name, logo: b.uploadedLogo, show: b.showInMenu }); setMsg(null); }}>✏️ Edit</button>}
                  {canDelete && b.count === 0 && b.registered && <button className="ml-3 text-muted hover:text-sale" onClick={() => setPending({ kind: "delete", b })}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={!!pending} busy={busy} onNo={() => setPending(null)} onYes={yes} danger={pending?.kind === "delete"}
        title={pending?.kind === "create" ? `Add ${newName.trim()}?` : pending?.kind === "delete" ? `Remove ${pending.b.name}?` : "Are you sure you want to change this?"}
        yesLabel={pending?.kind === "create" ? "Yes, add" : pending?.kind === "delete" ? "Yes, remove" : "Yes, save"}>
        {pending?.kind === "save" && (
          <ChangeList changes={[
            ...(pending.name.trim() !== pending.b.name ? [{ label: "Name", from: pending.b.name, to: `${pending.name.trim()} (updates ${pending.b.count} products)` }] : []),
            ...(pending.logo !== pending.b.uploadedLogo ? [{ label: "Logo", from: pending.b.uploadedLogo ? "uploaded logo" : "none", to: pending.logo ? "new logo" : "none" }] : []),
            ...(pending.show !== pending.b.showInMenu ? [{ label: "In menus", from: pending.b.showInMenu ? "shown" : "hidden", to: pending.show ? "shown" : "hidden" }] : []),
          ]} />
        )}
      </ConfirmDialog>
      {undo && <UndoBar message={undo.message} onClose={() => setUndo(null)}
        onUndo={async () => { await fetch(`/api/admin/brands/${undo.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: undo.prev.name, logo: undo.prev.logo, showInMenu: undo.prev.showInMenu, undo: true }) }); router.refresh(); }} />}
    </div>
  );
}
