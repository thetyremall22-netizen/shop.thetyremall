"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePicker } from "./ImagePicker";
import { ConfirmDialog } from "./ConfirmDialog";

type SectionType = "text" | "image" | "video" | "products";
interface Section { id: string; type: SectionType; heading?: string; body?: string; image?: string; alt?: string; caption?: string; link?: string; video?: string; category?: string; limit?: number }
interface Page {
  id: number; slug: string; title: string; subtitle: string; heroImage: string; menu: "none" | "main" | "footer"; menuLabel: string; menuOrder: number;
  published: boolean; seoTitle: string; seoDescription: string; sections: Section[];
}
interface Cat { slug: string; name: string; group: string; status: string }

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TYPE_LABEL: Record<SectionType, string> = { text: "📝 Text", image: "🖼 Image", video: "🎬 Video", products: "🛒 Products from a category" };
const STATUS: Record<string, string> = { live: "", scheduled: " (starts later)", ended: " (ended)", disabled: " (switched off)" };

export function LandingPageEditor({ initial }: { initial: Page }) {
  const router = useRouter();
  const [p, setP] = useState<Page>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { fetch("/api/admin/categories").then((r) => r.json()).then((d) => setCats(d.categories ?? [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Page>(k: K, v: Page[K]) => { setP((x) => ({ ...x, [k]: v })); setDirty(true); };
  const setSection = (id: string, patch: Partial<Section>) => { setP((x) => ({ ...x, sections: x.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })); setDirty(true); };
  const move = (i: number, d: -1 | 1) => {
    setP((x) => { const a = [...x.sections]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, sections: a }; });
    setDirty(true);
  };
  const remove = (id: string) => { setP((x) => ({ ...x, sections: x.sections.filter((s) => s.id !== id) })); setDirty(true); };
  const add = (type: SectionType) => {
    const s: Section = { id: newId(), type, heading: "", ...(type === "products" ? { limit: 12, category: "" } : {}) };
    setP((x) => ({ ...x, sections: [...x.sections, s] })); setDirty(true);
  };

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/landing-pages/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return; }
    setP(d.page); setDirty(false);
    setMsg({ ok: true, text: d.page.published ? `✓ Saved — live at thetyremall.co.za/${d.page.slug}` : "✓ Saved as a hidden draft. Switch on “Published” to put it on the website." });
    router.refresh();
  }

  async function del() {
    setBusy(true);
    await fetch(`/api/admin/landing-pages/${p.id}`, { method: "DELETE" }).catch(() => {});
    setDirty(false);
    router.push("/admin/pages");
  }

  const groups = [...new Set(cats.map((c) => c.group))];

  return (
    <div className="mt-2 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{p.title || "Untitled page"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/pages/${p.id}/preview`} target="_blank" className="btn btn-ghost h-10 px-4">Preview ↗</Link>
          {initial.published && <a href={`/${initial.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost h-10 px-4">View live ↗</a>}
          <button onClick={save} disabled={busy || !dirty} className="btn btn-volt h-10 px-5">{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-volt" : "text-sale"}`}>{msg.text}</p>}
      {dirty && <p className="text-xs text-muted">You have unsaved changes. Preview shows the last saved version.</p>}

      {/* page details */}
      <div className="card space-y-4 p-5">
        <h2 className="font-display text-xl">Page details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page title"><input value={p.title} onChange={(e) => set("title", e.target.value)} className="num w-full" /></Field>
          <Field label="Address — thetyremall.co.za/…"><input value={p.slug} onChange={(e) => set("slug", slugify(e.target.value))} className="num w-full" /></Field>
        </div>
        <Field label="Subtitle"><textarea value={p.subtitle} onChange={(e) => set("subtitle", e.target.value)} rows={2} className="num w-full py-2" /></Field>
        <ImagePicker label="Banner image (optional — shown faintly behind the title)" value={p.heroImage} onChange={(v) => set("heroImage", v)} />
        <div className="flex flex-wrap items-center gap-6 border-t border-line pt-4">
          <Toggle label={p.published ? "Published — visible on the website" : "Draft — hidden from visitors"} checked={p.published} onChange={(v) => set("published", v)} />
        </div>
      </div>

      {/* menu */}
      <div className="card space-y-4 p-5">
        <h2 className="font-display text-xl">Where is it linked?</h2>
        <div className="flex flex-wrap gap-2">
          {([["none", "Not in a menu (share the link)"], ["main", "Main menu (top of every page)"], ["footer", "Footer menu"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => set("menu", v)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${p.menu === v ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>{label}</button>
          ))}
        </div>
        {p.menu !== "none" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Menu link text (blank = page title)"><input value={p.menuLabel} onChange={(e) => set("menuLabel", e.target.value)} maxLength={40} className="num w-full" /></Field>
            <Field label="Order (lower numbers first)"><input type="number" value={p.menuOrder} onChange={(e) => set("menuOrder", Number(e.target.value) || 0)} className="num w-full" /></Field>
          </div>
        )}
        {p.menu === "main" && <p className="text-xs text-muted">Main menu links appear just before “Contact us”. Keep it to one or two so the menu doesn&apos;t get crowded.</p>}
        <p className="text-xs text-muted">Menu links only show while the page is published.</p>
      </div>

      {/* sections */}
      <div className="space-y-4">
        <h2 className="font-display text-xl">Page sections</h2>
        {p.sections.length === 0 && <p className="text-sm text-muted">No sections yet — add text, images, a video or products below.</p>}
        {p.sections.map((s, i) => (
          <div key={s.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-fg">{i + 1}. {TYPE_LABEL[s.type]}</span>
              <div className="flex items-center gap-1 text-xs font-bold">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-line px-2 py-1 text-muted hover:text-fg disabled:opacity-30">↑ Up</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === p.sections.length - 1} className="rounded border border-line px-2 py-1 text-muted hover:text-fg disabled:opacity-30">↓ Down</button>
                <button type="button" onClick={() => remove(s.id)} className="rounded border border-line px-2 py-1 text-sale hover:border-sale">Remove</button>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <Field label={s.type === "products" ? "Heading (blank = category name)" : "Heading (optional)"}><input value={s.heading ?? ""} onChange={(e) => setSection(s.id, { heading: e.target.value })} className="num w-full" /></Field>

              {s.type === "text" && (
                <Field label="Text — leave a blank line between paragraphs. To add a link: [words to click](https://address)">
                  <textarea value={s.body ?? ""} onChange={(e) => setSection(s.id, { body: e.target.value })} rows={7} className="num w-full py-2" />
                </Field>
              )}

              {s.type === "image" && (<>
                <ImagePicker label="Image" value={s.image ?? ""} onChange={(v) => setSection(s.id, { image: v })} previewClass="h-24 w-40" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Describe the image (for Google & screen readers)"><input value={s.alt ?? ""} onChange={(e) => setSection(s.id, { alt: e.target.value })} className="num w-full" /></Field>
                  <Field label="Link when clicked (optional)"><input value={s.link ?? ""} onChange={(e) => setSection(s.id, { link: e.target.value })} placeholder="/product-category/… or https://…" className="num w-full" /></Field>
                </div>
                <Field label="Caption (optional)"><input value={s.caption ?? ""} onChange={(e) => setSection(s.id, { caption: e.target.value })} className="num w-full" /></Field>
              </>)}

              {s.type === "video" && (<>
                <Field label="Video link — YouTube or Vimeo (or a link to an .mp4 file)"><input value={s.video ?? ""} onChange={(e) => setSection(s.id, { video: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className="num w-full" /></Field>
                {s.video && !isVideo(s.video) && <p className="text-xs text-sale">That doesn&apos;t look like a YouTube, Vimeo or .mp4 link — it won&apos;t show on the page.</p>}
                <Field label="Caption (optional)"><input value={s.caption ?? ""} onChange={(e) => setSection(s.id, { caption: e.target.value })} className="num w-full" /></Field>
              </>)}

              {s.type === "products" && (<>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                  <Field label="Category to show (e.g. your special)">
                    <select value={s.category ?? ""} onChange={(e) => setSection(s.id, { category: e.target.value })} className="num w-full">
                      <option value="">— choose a category —</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {cats.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.name}{STATUS[c.status] ?? ""}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label="How many products">
                    <select value={s.limit ?? 12} onChange={(e) => setSection(s.id, { limit: Number(e.target.value) })} className="num w-full">
                      {[4, 8, 12, 16, 24, 32, 48].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Short text above the products (optional)"><input value={s.body ?? ""} onChange={(e) => setSection(s.id, { body: e.target.value })} className="num w-full" /></Field>
                <p className="text-xs text-muted">
                  Products are added to special and sale categories in <Link href="/admin/products/specials" className="font-semibold text-volt hover:underline">Products → Special categories</Link>, or
                  on each product&apos;s edit page. A special that has ended or not started yet shows a short &ldquo;not running right now&rdquo; note instead.
                </p>
              </>)}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABEL) as SectionType[]).map((t) => (
            <button key={t} type="button" onClick={() => add(t)} className="rounded-lg border border-volt/50 px-3.5 py-2 text-sm font-semibold text-volt hover:bg-volt/10">+ {TYPE_LABEL[t]}</button>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div className="card space-y-4 p-5">
        <h2 className="font-display text-xl">Google (optional)</h2>
        <Field label="Title in Google (blank = page title)"><input value={p.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={120} className="num w-full" /></Field>
        <Field label="Description in Google (blank = subtitle)"><textarea value={p.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={300} rows={2} className="num w-full py-2" /></Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-sale hover:underline">Delete this page</button>
        <button onClick={save} disabled={busy || !dirty} className="btn btn-volt h-11 px-6">{busy ? "Saving…" : dirty ? "Save changes" : "Saved"}</button>
      </div>

      <ConfirmDialog open={confirmDelete} danger title={`Delete “${p.title}”?`} yesLabel="Yes, delete it" busy={busy} onYes={del} onNo={() => setConfirmDelete(false)}>
        <p>The page and its menu link are removed from the website. This can&apos;t be undone. (Products and categories aren&apos;t affected.)</p>
      </ConfirmDialog>
    </div>
  );
}

function isVideo(u: string) {
  return /(youtube\.com\/(watch|embed|shorts|live)|youtu\.be\/|vimeo\.com\/\d|\.(mp4|webm)(\?|$))/i.test(u.trim());
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>{children}</label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-volt" : "bg-line-2"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className="text-sm font-semibold text-fg">{label}</span>
    </button>
  );
}
