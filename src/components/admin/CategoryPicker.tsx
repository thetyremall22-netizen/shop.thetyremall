"use client";

import { useEffect, useState } from "react";

interface Cat { slug: string; name: string; group: string; status: string }
const STATUS: Record<string, string> = { scheduled: "starts later", ended: "ended", disabled: "off" };

/** Make a new special or sale category on the spot (e.g. "Black Friday Sale").
 *  It's live straight away with no end date; dates, a description and more
 *  products can be set later in Products → Special categories. */
export function NewCategoryInline({ onCreated }: { onCreated: (c: { slug: string; name: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"special" | "sale">("special");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) { setError("Give the category a name."); return; }
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/specials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), kind, enabled: true }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error ?? "Couldn't create the category."); return; }
    onCreated({ slug: d.special.slug, name: d.special.name });
    setName(""); setOpen(false);
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold text-volt hover:underline">+ Create a new special or sale category</button>;
  return (
    <div className="rounded-lg border border-volt/40 bg-volt/5 p-2.5">
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void create(); } }}
          placeholder="Name, e.g. Black Friday Sale" className="num min-w-[200px] flex-1" autoFocus />
        <select value={kind} onChange={(e) => setKind(e.target.value as "special" | "sale")} className="num w-auto">
          <option value="special">★ Special category</option>
          <option value="sale">% Sale category</option>
        </select>
        <button type="button" disabled={busy} onClick={create} className="btn btn-volt h-10 px-4 text-sm disabled:opacity-60">{busy ? "Creating…" : "Create"}</button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }} className="text-xs font-semibold text-muted hover:text-fg">Cancel</button>
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-sale">{error}</p>}
      <p className="mt-1.5 text-xs text-muted">It shows on the website straight away. Add start/end dates, a picture or more products in Products → Special categories.</p>
    </div>
  );
}

/** Choose a product's categories: tick as many as you like (main categories,
 *  special and sale categories), remove any with ✕, or make a new special or
 *  sale category on the spot. */
export function CategoryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const load = () => fetch("/api/admin/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => setCats([]));
  useEffect(() => { void load(); }, []);

  const byslug = new Map((cats ?? []).map((c) => [c.slug, c]));
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  const shown = (cats ?? []).filter((c) => !q || `${c.name} ${c.slug}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(shown.map((c) => c.group))];

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface-2 p-1.5">
        {value.length === 0 && <span className="px-1.5 text-sm text-muted">No categories yet</span>}
        {value.map((slug) => (
          <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-volt/15 px-2.5 py-1 text-xs font-semibold text-volt ring-1 ring-volt/30">
            {byslug.get(slug)?.name ?? slug}
            <button type="button" onClick={() => toggle(slug)} aria-label={`Remove ${byslug.get(slug)?.name ?? slug}`} className="ml-0.5 text-volt/70 hover:text-sale">✕</button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen((o) => !o)} className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs font-bold text-muted hover:text-fg">{open ? "Done" : "+ Add / remove"}</button>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-surface p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" className="num mb-2 w-full" />
          <div className="mb-3"><NewCategoryInline onCreated={(c) => { void load(); if (!value.includes(c.slug)) onChange([...value, c.slug]); }} /></div>
          {cats === null ? <p className="text-sm text-muted">Loading…</p> : (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g}>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{g}</div>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {shown.filter((c) => c.group === g).map((c) => (
                      <label key={c.slug} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2">
                        <input type="checkbox" checked={value.includes(c.slug)} onChange={() => toggle(c.slug)} className="accent-[var(--color-volt,#7ac143)]" />
                        <span className="text-fg">{c.name}</span>
                        {STATUS[c.status] && <span className="text-xs text-muted">({STATUS[c.status]})</span>}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {!groups.length && <p className="text-sm text-muted">No categories match.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
