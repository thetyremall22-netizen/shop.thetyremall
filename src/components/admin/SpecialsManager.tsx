"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";
import { ImagePicker } from "./ImagePicker";

export interface SpecialRow {
  id: number; slug: string; name: string; description: string; image: string;
  startAt: number | null; endAt: number | null; enabled: boolean; status: "draft" | "scheduled" | "live" | "ended"; count: number;
}

const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const lab = "mb-1 block text-xs font-semibold text-muted";
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUS: Record<SpecialRow["status"], { label: string; badge: string }> = {
  live: { label: "Live now", badge: "badge-pay" }, scheduled: { label: "Scheduled", badge: "badge-warn" },
  ended: { label: "Ended", badge: "badge-muted" }, draft: { label: "Switched off", badge: "badge-muted" },
};
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—");
/** ms → value for <input type="datetime-local"> in the viewer's time zone. */
const toLocal = (ms: number | null) => { if (!ms) return ""; const d = new Date(ms); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocal = (v: string) => (v ? new Date(v).getTime() : null);
const slugify = (s: string) => s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);

interface Form { name: string; slug: string; description: string; image: string; start: string; end: string; enabled: boolean }
const blank: Form = { name: "", slug: "", description: "", image: "", start: "", end: "", enabled: true };
const toForm = (s: SpecialRow): Form => ({ name: s.name, slug: s.slug, description: s.description, image: s.image, start: toLocal(s.startAt), end: toLocal(s.endAt), enabled: s.enabled });
const body = (f: Form) => ({ name: f.name, slug: f.slug, description: f.description, image: f.image, startAt: fromLocal(f.start), endAt: fromLocal(f.end), enabled: f.enabled });

function SpecialForm({ f, set, slugEdited, setSlugEdited }: { f: Form; set: (f: Form) => void; slugEdited: boolean; setSlugEdited: (v: boolean) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className={lab}>Name (shown on the site)</span>
          <input className={field} value={f.name} placeholder="Father's Day Specials" onChange={(e) => set({ ...f, name: e.target.value, slug: slugEdited ? f.slug : slugify(e.target.value) })} /></label>
        <label><span className={lab}>Web address</span>
          <span className="flex items-center gap-1 text-xs text-muted">/product-category/
            <input className={field} value={f.slug} onChange={(e) => { setSlugEdited(true); set({ ...f, slug: slugify(e.target.value) }); }} /></span></label>
        <label><span className={lab}>Starts (optional — blank = straight away)</span>
          <input type="datetime-local" className={field} value={f.start} onChange={(e) => set({ ...f, start: e.target.value })} /></label>
        <label><span className={lab}>Ends (optional — blank = no end)</span>
          <input type="datetime-local" className={field} value={f.end} onChange={(e) => set({ ...f, end: e.target.value })} /></label>
      </div>
      <label className="block"><span className={lab}>Short description (optional)</span>
        <input className={field} value={f.description} onChange={(e) => set({ ...f, description: e.target.value })} /></label>
      <ImagePicker value={f.image} onChange={(image) => set({ ...f, image })} label="Image (optional)" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.enabled} onChange={(e) => set({ ...f, enabled: e.target.checked })} className="size-4 accent-[var(--color-volt)]" />
        <b className="text-fg">Switched on</b> <span className="text-muted">(untick to hide it straight away, whatever the dates)</span></label>
    </div>
  );
}

interface Product { slug: string; name: string; sku: string; price: number; stockQty: number; inSpecial?: boolean }

function ProductPicker({ special, canEdit }: { special: SpecialRow; canEdit: boolean }) {
  const router = useRouter();
  const [members, setMembers] = useState<Product[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [type, setType] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState<"add" | "remove" | null>(null);
  const [undo, setUndo] = useState<{ action: "add" | "remove"; slugs: string[]; message: string } | null>(null);

  async function load(search = true) {
    const u = new URLSearchParams();
    if (search && q) u.set("q", q);
    if (search && filter) u.set("filter", filter);
    if (search && type) u.set("type", type);
    const r = await fetch(`/api/admin/specials/${special.id}/products?${u}`).then((x) => x.json()).catch(() => null);
    if (!r) return;
    setMembers(r.members); setResults(r.results); setTotal(r.total);
  }
  useEffect(() => { void load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [special.id]);

  async function change(action: "add" | "remove", payload: { slugs?: string[]; match?: { q: string; filter: string; type: string } }, isUndo = false) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/specials/${special.id}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload, undo: isUndo }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false); setConfirmAll(null);
    if (!res.ok) { setMsg(d.error ?? "Failed."); return; }
    setMsg(`✓ ${action === "add" ? "Added" : "Removed"} ${d.changed} product${d.changed === 1 ? "" : "s"}`);
    if (!isUndo && d.changed) setUndo({ action, slugs: d.slugs, message: `${action === "add" ? "Added" : "Removed"} ${d.changed} product(s)` });
    await load(!!(q || filter || type));
    router.refresh();
  }

  const row = (p: Product, inSpecial: boolean) => (
    <tr key={p.slug} className="border-b border-line last:border-0">
      <td className="px-3 py-2"><div className="text-fg">{p.name}</div><div className="text-xs text-muted">SKU {p.sku || "—"}</div></td>
      <td className="px-3 py-2 text-right whitespace-nowrap">{zar(p.price)}</td>
      <td className="px-3 py-2 text-right">{p.stockQty}</td>
      <td className="px-3 py-2 text-right">
        {canEdit && (inSpecial
          ? <button disabled={busy} onClick={() => change("remove", { slugs: [p.slug] })} className="text-xs font-semibold text-muted hover:text-sale">Remove</button>
          : <button disabled={busy} onClick={() => change("add", { slugs: [p.slug] })} className="text-xs font-semibold text-volt hover:underline">+ Add</button>)}
      </td>
    </tr>
  );

  return (
    <div className="mt-4 space-y-4">
      {canEdit && (
        <div className="rounded-xl border border-line p-3">
          <b className="text-sm">Add products</b>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className={`${field} min-w-[220px] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Search name, SKU, brand or size (e.g. 265/65R17)" />
            <select className={`${field} w-auto`} value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="tyre">Tyres</option><option value="wheel">Wheels / Rims</option><option value="other">Other</option></select>
            <select className={`${field} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Any stock</option><option value="instock">In stock</option><option value="sale">On sale</option><option value="low">Low stock</option></select>
            <button onClick={() => load()} className="btn btn-volt h-10 px-4 text-sm">Search</button>
          </div>
          {(q || filter || type) && total > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted">{total.toLocaleString()} matching</span>
              <button disabled={busy} onClick={() => setConfirmAll("add")} className="btn btn-volt-outline h-8 px-3 text-xs">+ Add all {total.toLocaleString()} matching</button>
              <button disabled={busy} onClick={() => setConfirmAll("remove")} className="btn btn-dark h-8 px-3 text-xs">Remove all matching</button>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm"><tbody>{results.map((p) => row(p, !!p.inSpecial))}</tbody></table>
              {total > results.length && <p className="px-3 py-2 text-xs text-muted">Showing the first {results.length}. Use “Add all matching” or narrow the search.</p>}
            </div>
          )}
        </div>
      )}
      <div>
        <b className="text-sm">In this special ({members?.length ?? "…"})</b>
        {members && members.length === 0 && <p className="mt-1 text-sm text-muted">No products yet. Search above and add some.</p>}
        {members && members.length > 0 && (
          <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-sm"><tbody>{members.map((p) => row(p, true))}</tbody></table>
          </div>
        )}
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</p>}
      <ConfirmDialog open={!!confirmAll} busy={busy} onNo={() => setConfirmAll(null)}
        title={confirmAll === "add" ? `Add all ${total.toLocaleString()} matching products to “${special.name}”?` : `Remove all matching products from “${special.name}”?`}
        yesLabel={confirmAll === "add" ? "Yes, add them" : "Yes, remove them"}
        onYes={() => change(confirmAll!, { match: { q, filter, type } })}>
        <p>Matching: {[q && `“${q}”`, type && { tyre: "tyres", wheel: "wheels/rims", other: "other products" }[type], filter && { instock: "in stock", sale: "on sale", low: "low stock" }[filter]].filter(Boolean).join(" · ")}</p>
      </ConfirmDialog>
      {undo && <UndoBar message={undo.message} onClose={() => setUndo(null)} onUndo={() => change(undo.action === "add" ? "remove" : "add", { slugs: undo.slugs }, true)} />}
    </div>
  );
}

export function SpecialsManager({ specials, canEdit, canDelete }: { specials: SpecialRow[]; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newF, setNewF] = useState<Form>(blank);
  const [newSlugEdited, setNewSlugEdited] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [editF, setEditF] = useState<Form>(blank);
  const [editSlugEdited, setEditSlugEdited] = useState(true);
  const [pending, setPending] = useState<{ kind: "create" } | { kind: "save"; s: SpecialRow } | { kind: "delete"; s: SpecialRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<{ id: number; f: Form } | null>(null);

  async function confirmYes() {
    if (!pending) return;
    setBusy(true); setMsg(null);
    let res: Response;
    if (pending.kind === "create") res = await fetch("/api/admin/specials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(newF)) });
    else if (pending.kind === "save") res = await fetch(`/api/admin/specials/${pending.s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(editF)) });
    else res = await fetch(`/api/admin/specials/${pending.s.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Failed." }); setPending(null); return; }
    if (pending.kind === "create") { setMsg({ ok: true, text: `✓ Created “${d.special.name}”. Now add products to it.` }); setCreating(false); setNewF(blank); setNewSlugEdited(false); setOpen(d.special.id); setEditF(toForm({ ...d.special, status: "live", count: 0 })); }
    if (pending.kind === "save") { setMsg({ ok: true, text: "✓ Saved" }); setUndo({ id: pending.s.id, f: toForm(pending.s) }); }
    if (pending.kind === "delete") { setMsg({ ok: true, text: `✓ Deleted, and removed from ${d.removedFrom} product(s)` }); setOpen(null); }
    setPending(null);
    router.refresh();
  }

  const changes = (s: SpecialRow) => {
    const a = toForm(s), b = editF;
    const L: Record<keyof Form, string> = { name: "Name", slug: "Web address", description: "Description", image: "Image", start: "Starts", end: "Ends", enabled: "Switched on" };
    return (Object.keys(L) as (keyof Form)[]).filter((k) => String(a[k]) !== String(b[k])).map((k) => ({ label: L[k], from: String(a[k] || "—"), to: String(b[k] || "—") }));
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</p>}
      {canEdit && (creating ? (
        <div className="card p-5">
          <h2 className="font-display text-lg">New special category</h2>
          <div className="mt-3"><SpecialForm f={newF} set={setNewF} slugEdited={newSlugEdited} setSlugEdited={setNewSlugEdited} /></div>
          <div className="mt-4 flex gap-2">
            <button className="btn btn-dark px-4" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn btn-volt px-5 disabled:opacity-50" disabled={!newF.name.trim()} onClick={() => setPending({ kind: "create" })}>Create special</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-volt h-10 px-4 text-sm" onClick={() => { setCreating(true); setMsg(null); }}>+ New special category</button>
      ))}

      {specials.length === 0 && !creating && <p className="text-sm text-muted">No special categories yet. Create one for Father&apos;s Day, Black Friday, Christmas and so on.</p>}

      {specials.map((s) => (
        <div key={s.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="font-display text-lg text-fg">{s.name}</span><span className={`badge ${STATUS[s.status].badge}`}>{STATUS[s.status].label}</span></div>
              <div className="mt-0.5 text-xs text-muted">/product-category/{s.slug} · {s.count} product{s.count === 1 ? "" : "s"} · {when(s.startAt)} → {when(s.endAt)}</div>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold">
              {s.status === "live" && <a href={`/product-category/${s.slug}`} target="_blank" rel="noreferrer" className="text-muted hover:text-volt">View on site ↗</a>}
              <button onClick={() => { if (open === s.id) setOpen(null); else { setOpen(s.id); setEditF(toForm(s)); setEditSlugEdited(true); setMsg(null); } }} className="text-volt hover:underline">{open === s.id ? "Close" : "✏️ Edit & products"}</button>
              {canDelete && <button onClick={() => setPending({ kind: "delete", s })} className="text-muted hover:text-sale">Delete</button>}
            </div>
          </div>
          {open === s.id && (
            <div className="border-t border-line p-5">
              {canEdit && (
                <>
                  <SpecialForm f={editF} set={setEditF} slugEdited={editSlugEdited} setSlugEdited={setEditSlugEdited} />
                  <button className="btn btn-volt mt-3 px-5 disabled:opacity-50" disabled={!changes(s).length} onClick={() => setPending({ kind: "save", s })}>Save details</button>
                </>
              )}
              <ProductPicker special={s} canEdit={canEdit} />
            </div>
          )}
        </div>
      ))}

      <ConfirmDialog open={!!pending} busy={busy} onNo={() => setPending(null)} onYes={confirmYes}
        danger={pending?.kind === "delete"}
        title={pending?.kind === "delete" ? `Delete “${pending.s.name}”?` : pending?.kind === "create" ? `Create “${newF.name}”?` : "Are you sure you want to change this?"}
        yesLabel={pending?.kind === "delete" ? "Yes, delete" : pending?.kind === "create" ? "Yes, create" : "Yes, save"}>
        {pending?.kind === "delete" && <p>The special is removed from the site and from its {pending.s.count} product(s). The products themselves stay in the shop.</p>}
        {pending?.kind === "create" && <p>Address: /product-category/{newF.slug || slugify(newF.name)}{newF.start ? ` · starts ${newF.start.replace("T", " ")}` : " · starts straight away"}{newF.end ? ` · ends ${newF.end.replace("T", " ")}` : ""}</p>}
        {pending?.kind === "save" && <ChangeList changes={changes(pending.s)} />}
      </ConfirmDialog>
      {undo && <UndoBar message="Special updated" onClose={() => setUndo(null)}
        onUndo={async () => { await fetch(`/api/admin/specials/${undo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body(undo.f), undo: true }) }); router.refresh(); }} />}
    </div>
  );
}
