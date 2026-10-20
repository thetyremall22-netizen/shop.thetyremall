"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";
import { ImagePicker } from "./ImagePicker";
import type { PageDef, PageOverride } from "@/lib/page-content";

const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const lab = "mb-1 block text-xs font-semibold text-muted";
const LABELS: Record<string, string> = {
  eyebrow: "Small line above heading", silver: "Heading (silver part)", green: "Heading (green part)", intro: "Intro text",
  banner: "Banner", extraHeading: "Extra section heading", extraBody: "Extra section text", extraPosition: "Extra section position",
  seoTitle: "Google title", seoDescription: "Google description",
};

function PageEditor({ def, initial }: { def: PageDef; initial: PageOverride }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<PageOverride | null>(null);
  const d = def.defaults;
  const flat = (o: PageOverride): Record<string, string> => ({ ...o, banner: o.banner.src ? `${o.banner.src}${o.banner.href ? ` → ${o.banner.href}` : ""}` : "" });
  const changes = Object.keys(LABELS).filter((k) => flat(v)[k] !== flat(saved)[k]).map((k) => ({ label: LABELS[k], from: flat(saved)[k], to: flat(v)[k] }));

  async function put(body: PageOverride, isUndo = false) {
    const res = await fetch(`/api/admin/pages/${def.key}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, undo: isUndo }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? "Couldn't save." }); return null; }
    return j.content as PageOverride;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">Leave any box empty to keep the page&apos;s built-in text (shown in grey). <a href={def.path} target="_blank" rel="noreferrer" className="font-semibold text-volt hover:underline">Open {def.path} ↗</a></p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label><span className={lab}>Small line above heading</span><input className={field} value={v.eyebrow} placeholder={d.eyebrow} onChange={(e) => setV({ ...v, eyebrow: e.target.value })} /></label>
        <label><span className={lab}>Heading (silver part)</span><input className={field} value={v.silver} placeholder={d.silver} onChange={(e) => setV({ ...v, silver: e.target.value })} /></label>
        <label><span className={lab}>Heading (green part)</span><input className={field} value={v.green} placeholder={d.green} onChange={(e) => setV({ ...v, green: e.target.value })} /></label>
      </div>
      <label className="block"><span className={lab}>Intro text</span>
        <textarea rows={3} className={`${field} h-auto py-2`} value={v.intro} placeholder={d.intro} onChange={(e) => setV({ ...v, intro: e.target.value })} /></label>

      <div className="rounded-xl border border-line p-3">
        <b className="text-sm">Banner (optional)</b>
        <p className="mb-2 text-xs text-muted">Shows under the heading. Best size 2000 × 668 px.</p>
        <ImagePicker value={v.banner.src} onChange={(src) => setV({ ...v, banner: { ...v.banner, src } })} label="Banner image" />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label><span className={lab}>Link (optional)</span><input className={field} value={v.banner.href} placeholder="/shop?brand=Radar" onChange={(e) => setV({ ...v, banner: { ...v.banner, href: e.target.value } })} /></label>
          <label><span className={lab}>Description</span><input className={field} value={v.banner.alt} onChange={(e) => setV({ ...v, banner: { ...v.banner, alt: e.target.value } })} /></label>
        </div>
        {v.banner.src && <button type="button" onClick={() => setV({ ...v, banner: { src: "", href: "", alt: "" } })} className="mt-2 text-xs font-semibold text-muted hover:text-sale">Remove banner</button>}
      </div>

      <div className="rounded-xl border border-line p-3">
        <b className="text-sm">Extra content section (optional)</b>
        <p className="mb-2 text-xs text-muted">Formatting: <code>## Heading</code>, lines starting with <code>- </code> become bullets, a blank line starts a new paragraph, <code>**bold**</code>, and <code>[link text](/shop)</code>.</p>
        <label className="block"><span className={lab}>Heading</span><input className={field} value={v.extraHeading} onChange={(e) => setV({ ...v, extraHeading: e.target.value })} /></label>
        <label className="mt-2 block"><span className={lab}>Text</span><textarea rows={6} className={`${field} h-auto py-2 font-mono text-xs`} value={v.extraBody} onChange={(e) => setV({ ...v, extraBody: e.target.value })} /></label>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={v.extraPosition === "top"} onChange={() => setV({ ...v, extraPosition: "top" })} className="accent-[var(--color-volt)]" /> Near the top</label>
          <label className="flex items-center gap-2"><input type="radio" checked={v.extraPosition === "bottom"} onChange={() => setV({ ...v, extraPosition: "bottom" })} className="accent-[var(--color-volt)]" /> At the bottom</label>
        </div>
      </div>

      <div className="rounded-xl border border-line p-3">
        <b className="text-sm">Google search result (SEO)</b>
        <label className="mt-2 block"><span className={lab}>Title ({v.seoTitle.length}/60). “· The Tyre Mall” is added automatically</span><input className={field} value={v.seoTitle} placeholder={d.seoTitle} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} /></label>
        <label className="mt-2 block"><span className={lab}>Description ({v.seoDescription.length}/160)</span><textarea rows={2} className={`${field} h-auto py-2`} value={v.seoDescription} placeholder={d.seoDescription || "Uses the page's built-in description"} onChange={(e) => setV({ ...v, seoDescription: e.target.value })} /></label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!changes.length} onClick={() => setConfirm(true)} className="btn btn-volt px-5 disabled:opacity-50">Save {def.label}</button>
        <button type="button" disabled={!changes.length} onClick={() => { setV(saved); setMsg(null); }} className="btn btn-dark px-4 disabled:opacity-50">Discard</button>
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</span>}
      </div>
      <ConfirmDialog open={confirm} busy={busy} yesLabel="Yes, update the page" onNo={() => setConfirm(false)}
        onYes={async () => {
          setBusy(true); setMsg(null);
          const prev = saved;
          const r = await put(v);
          setBusy(false); setConfirm(false);
          if (r) { setSaved(r); setV(r); setUndo(prev); setMsg({ ok: true, text: "✓ Saved — live in a few seconds." }); router.refresh(); }
        }}>
        <ChangeList changes={changes.map((c) => ({ ...c, from: c.from.length > 80 ? c.from.slice(0, 80) + "…" : c.from, to: c.to.length > 80 ? c.to.slice(0, 80) + "…" : c.to }))} />
      </ConfirmDialog>
      {undo && <UndoBar message={`${def.label} updated`} onClose={() => setUndo(null)}
        onUndo={async () => { const r = await put(undo, true); if (r) { setSaved(r); setV(r); setMsg({ ok: true, text: "↩ Undone." }); router.refresh(); } }} />}
    </div>
  );
}

export function PagesContentManager({ pages, initial, q: q0 }: { pages: PageDef[]; initial: Record<string, PageOverride>; q: string }) {
  const [q, setQ] = useState(q0);
  const [open, setOpen] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const list = pages.filter((p) => !needle || `${p.label} ${p.path} ${Object.values(p.defaults).join(" ")} ${JSON.stringify(initial[p.key] ?? {})}`.toLowerCase().includes(needle));
  const edited = (k: string) => { const o = initial[k]; return !!o && (o.eyebrow || o.silver || o.green || o.intro || o.banner.src || o.extraBody || o.extraHeading || o.seoTitle || o.seoDescription); };
  return (
    <div className="space-y-3">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages…" className={`${field} max-w-md`} />
      {list.length === 0 && <p className="text-sm text-muted">No pages match.</p>}
      {list.map((p) => (
        <div key={p.key} className="card overflow-hidden">
          <button type="button" onClick={() => setOpen(open === p.key ? null : p.key)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface">
            <span>
              <span className="font-display text-lg text-fg">{p.label}</span> <span className="text-xs text-muted">{p.path}</span>
              {edited(p.key) && <span className="ml-2 badge badge-volt">customised</span>}
            </span>
            <span className="text-sm font-semibold text-volt">{open === p.key ? "Close" : "✏️ Edit"}</span>
          </button>
          {open === p.key && <div className="border-t border-line p-5"><PageEditor def={p} initial={initial[p.key]} /></div>}
        </div>
      ))}
    </div>
  );
}
