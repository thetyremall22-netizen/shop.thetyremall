"use client";

import { useEffect, useState } from "react";

interface Cat { slug: string; name: string; group: string; status: string }
const STATUS: Record<string, string> = { scheduled: "starts later", ended: "ended", disabled: "off" };

/** Choose a product's categories: tick as many as you like (main categories,
 *  special and sale categories), and remove any with ✕. */
export function CategoryPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/admin/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => setCats([])); }, []);

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
