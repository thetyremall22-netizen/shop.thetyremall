"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, UndoBar } from "./ConfirmDialog";
import { ImagePicker } from "./ImagePicker";
import type { HomeContent, Heading, ProductSection } from "@/lib/home-content";
import { BANNER_CANVAS, TILE_CANVAS, HERO_CANVAS, canvasHint } from "./image-compress";

export interface CategoryOption { slug: string; name: string; kind: "built-in" | "special" | "sale"; status?: string }

const MAX = 3;
const field = "h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";
const lab = "mb-1 block text-xs font-semibold text-muted";

function Section({ title, show, onShow, children, note }: { title: string; show?: boolean; onShow?: (v: boolean) => void; children?: ReactNode; note?: string }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg">{title}</h3>
        {onShow && (
          <label className="flex items-center gap-2 text-sm font-semibold text-fg">
            <input type="checkbox" checked={!!show} onChange={(e) => onShow(e.target.checked)} className="size-4 accent-[var(--color-volt)]" />
            Show on home page
          </label>
        )}
      </div>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      {children && <div className={`mt-3 space-y-3 ${onShow && !show ? "opacity-50" : ""}`}>{children}</div>}
    </section>
  );
}

function HeadingFields<T extends Heading>({ h, set, eyebrowHint }: { h: T; set: (h: T) => void; eyebrowHint?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label><span className={lab}>Small line above{eyebrowHint ? ` (${eyebrowHint})` : ""}</span><input className={field} value={h.eyebrow} onChange={(e) => set({ ...h, eyebrow: e.target.value })} /></label>
      <label><span className={lab}>Heading (silver part)</span><input className={field} value={h.silver} onChange={(e) => set({ ...h, silver: e.target.value })} /></label>
      <label><span className={lab}>Heading (green part)</span><input className={field} value={h.green} onChange={(e) => set({ ...h, green: e.target.value })} /></label>
    </div>
  );
}

/** Which products a home page row shows: automatic, or chosen categories. */
function ProductSource({ sec, set, options, autoLabel }: { sec: ProductSection; set: (s: ProductSection) => void; options: CategoryOption[]; autoLabel: string }) {
  const [find, setFind] = useState("");
  const shown = options.filter((o) => !find || o.name.toLowerCase().includes(find.toLowerCase()));
  const toggle = (slug: string) => set({ ...sec, categories: sec.categories.includes(slug) ? sec.categories.filter((c) => c !== slug) : [...sec.categories, slug] });
  const KIND: Record<CategoryOption["kind"], string> = { "built-in": "", special: "★ ", sale: "% " };
  return (
    <div className="rounded-xl border border-line p-3">
      <b className="text-sm">Products shown</b>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="radio" checked={sec.source === "auto"} onChange={() => set({ ...sec, source: "auto" })} className="accent-[var(--color-volt)]" /> {autoLabel}</label>
        <label className="flex items-center gap-2"><input type="radio" checked={sec.source === "categories"} onChange={() => set({ ...sec, source: "categories" })} className="accent-[var(--color-volt)]" /> Products from categories I choose</label>
        <label className="flex items-center gap-2">How many
          <select value={sec.limit} onChange={(e) => set({ ...sec, limit: Number(e.target.value) })} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm">
            {[4, 6, 8, 10, 12, 16].map((n) => <option key={n} value={n}>{n}</option>)}
          </select></label>
      </div>
      {sec.source === "categories" && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted">Pick one or more categories, e.g. a Black Friday sale category. Products are mixed from each one; the &ldquo;View all&rdquo; button opens the first. ★ special / % sale categories only show while they&apos;re live, and the row goes back to automatic if none have products.</p>
          {sec.categories.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {sec.categories.map((c) => { const o = options.find((x) => x.slug === c); return (
                <button key={c} type="button" onClick={() => toggle(c)} className="rounded-full bg-volt px-2.5 py-1 text-xs font-semibold text-volt-ink">{o ? KIND[o.kind] + o.name : c} ✕</button>
              ); })}
            </div>
          )}
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search categories…" className={`${field} max-w-xs`} />
          <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {shown.filter((o) => !sec.categories.includes(o.slug)).map((o) => (
              <button key={o.slug} type="button" onClick={() => toggle(o.slug)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-volt hover:text-fg">
                + {KIND[o.kind]}{o.name}{o.status && o.status !== "live" ? ` (${o.status})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HomeContentManager({ initial, defaults, categoryOptions = [] }: { initial: HomeContent; defaults: HomeContent; categoryOptions?: CategoryOption[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState<HomeContent>(initial);
  const [v, setV] = useState<HomeContent>(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [undo, setUndo] = useState<HomeContent | null>(null);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const up = <K extends keyof HomeContent>(k: K, val: HomeContent[K]) => setV((x) => ({ ...x, [k]: val }));
  const slides = v.banners.slides;
  const setSlides = (s: HomeContent["banners"]["slides"]) => up("banners", { ...v.banners, slides: s });

  async function put(body: HomeContent): Promise<HomeContent | null> {
    const res = await fetch("/api/admin/home", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "Couldn't save." }); return null; }
    return d.content as HomeContent;
  }
  async function save() {
    setBusy(true); setMsg(null);
    const prev = saved;
    const next = await put(v);
    setBusy(false); setConfirm(false);
    if (!next) return;
    setSaved(next); setV(next); setUndo(prev);
    setMsg({ ok: true, text: "✓ Saved. The home page updates within a few seconds." });
    router.refresh();
  }

  const changedSections = (Object.keys(v) as (keyof HomeContent)[]).filter((k) => JSON.stringify(v[k]) !== JSON.stringify(saved[k]));
  const NAMES: Record<string, string> = { banners: "Marketing banners", hero: "Hero background", tiles: "Tyres / Wheels tiles", reviews: "Happy customers", fanFavourites: "Fan favourites", happyPay: "HappyPay block", deals: "Massive savings", mags: "Fresh mags", about: "Our story & team", brands: "Shop by brand", video: "Featured video" };

  return (
    <div className="space-y-5">
      <Section title="Marketing banners" show={v.banners.show} onShow={(x) => up("banners", { ...v.banners, show: x })}
        note={`Wide banner under the search (best size 2000 × 668 px). Show 1 static banner, or up to ${MAX} that rotate. Each can link to any page, e.g. a product, a brand (/shop?brand=Radar) or a search (/shop?q=Renegade). Images are compressed automatically to keep the page fast.`}>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={v.banners.mode === "static"} onChange={() => up("banners", { ...v.banners, mode: "static" })} className="accent-[var(--color-volt)]" /> 1 static banner</label>
          <label className="flex items-center gap-2"><input type="radio" checked={v.banners.mode === "rotate"} onChange={() => up("banners", { ...v.banners, mode: "rotate" })} className="accent-[var(--color-volt)]" /> Rotate up to {MAX} banners</label>
          {v.banners.mode === "rotate" && (
            <label className="flex items-center gap-2">Change every
              <input type="number" min={3} max={20} value={v.banners.intervalSec} onChange={(e) => up("banners", { ...v.banners, intervalSec: Number(e.target.value) || 6 })} className="h-9 w-16 rounded-lg border border-line bg-surface-2 px-2 text-sm" /> seconds</label>
          )}
        </div>
        {slides.map((s, i) => (
          <div key={i} className={`rounded-xl border border-line p-3 ${v.banners.mode === "static" && i > 0 ? "opacity-50" : ""}`}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm">Banner {i + 1}{v.banners.mode === "static" && i > 0 ? " (hidden in static mode)" : ""}</b>
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => { const c = [...slides]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; setSlides(c); }} className="btn btn-dark h-8 px-2 text-xs disabled:opacity-40">↑</button>
                <button type="button" disabled={i === slides.length - 1} onClick={() => { const c = [...slides]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; setSlides(c); }} className="btn btn-dark h-8 px-2 text-xs disabled:opacity-40">↓</button>
                <button type="button" onClick={() => setSlides(slides.filter((_, j) => j !== i))} className="btn btn-dark h-8 px-2 text-xs hover:text-sale">Remove</button>
              </div>
            </div>
            <ImagePicker value={s.src} onChange={(src) => setSlides(slides.map((x, j) => (j === i ? { ...x, src } : x)))} label="Banner image" fit={BANNER_CANVAS} previewClass="h-14 w-40" hint={canvasHint(BANNER_CANVAS)} />
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label><span className={lab}>Link (page it opens)</span><input className={field} value={s.href} placeholder="/shop?q=Renegade" onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))} /></label>
              <label><span className={lab}>Description (for screen readers &amp; Google)</span><input className={field} value={s.alt} onChange={(e) => setSlides(slides.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} /></label>
            </div>
          </div>
        ))}
        {slides.some((s) => !s.src) && <p className="text-xs font-semibold text-sale">A banner without an image won&apos;t be shown. Choose or upload an image, or remove it.</p>}
        {slides.length < MAX ? (
          <button type="button" onClick={() => setSlides([...slides, { src: "", alt: "", href: "" }])} className="btn btn-volt-outline h-9 px-4 text-xs">+ Add banner</button>
        ) : <p className="text-xs text-muted">Maximum of {MAX} banners reached. Remove one to add another.</p>}
      </Section>

      <Section title="Hero background" note="The big image behind “South Africa’s cheapest tyres” at the top of the page (best: 1920 × 1080 px).">
        <ImagePicker value={v.hero.image} onChange={(image) => up("hero", { image })} label="Background image" fit={HERO_CANVAS} previewClass="h-16 w-36" hint={canvasHint(HERO_CANVAS, "The left side sits behind the headline, so keep it fairly dark there.")} />
        {v.hero.image !== defaults.hero.image && <button type="button" onClick={() => up("hero", defaults.hero)} className="text-xs font-semibold text-muted hover:text-volt">Restore original image</button>}
      </Section>

      <Section title="Tyres / Wheels tiles" show={v.tiles.show} onShow={(x) => up("tiles", { ...v.tiles, show: x })}>
        {v.tiles.items.map((t, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label><span className={lab}>Title</span><input className={field} value={t.title} onChange={(e) => up("tiles", { ...v.tiles, items: v.tiles.items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) as HomeContent["tiles"]["items"] })} /></label>
              <label><span className={lab}>Button text</span><input className={field} value={t.cta} onChange={(e) => up("tiles", { ...v.tiles, items: v.tiles.items.map((x, j) => (j === i ? { ...x, cta: e.target.value } : x)) as HomeContent["tiles"]["items"] })} /></label>
              <label><span className={lab}>Tags (separate with |)</span><input className={field} value={t.tags} onChange={(e) => up("tiles", { ...v.tiles, items: v.tiles.items.map((x, j) => (j === i ? { ...x, tags: e.target.value } : x)) as HomeContent["tiles"]["items"] })} /></label>
              <label><span className={lab}>Link</span><input className={field} value={t.href} onChange={(e) => up("tiles", { ...v.tiles, items: v.tiles.items.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)) as HomeContent["tiles"]["items"] })} /></label>
            </div>
            <div className="mt-2"><ImagePicker value={t.image} onChange={(image) => up("tiles", { ...v.tiles, items: v.tiles.items.map((x, j) => (j === i ? { ...x, image } : x)) as HomeContent["tiles"]["items"] })} label="Tile image" fit={TILE_CANVAS} previewClass="h-14 w-36" hint={canvasHint(TILE_CANVAS, "The title sits on the left, so keep the tyre or wheel towards the right.")} /></div>
          </div>
        ))}
      </Section>

      <Section title="Happy customers (reviews)" show={v.reviews.show} onShow={(x) => up("reviews", { ...v.reviews, show: x })}>
        <HeadingFields h={v.reviews} set={(h) => up("reviews", h)} eyebrowHint="{rating} = star rating" />
      </Section>
      <Section title="Fan favourites (best sellers)" show={v.fanFavourites.show} onShow={(x) => up("fanFavourites", { ...v.fanFavourites, show: x })}>
        <HeadingFields h={v.fanFavourites} set={(h) => up("fanFavourites", h)} />
        <ProductSource sec={v.fanFavourites} set={(x) => up("fanFavourites", x)} options={categoryOptions} autoLabel="Automatic (in-stock best sellers)" />
      </Section>
      <Section title="HappyPay — buy now, pay later" show={v.happyPay.show} onShow={(x) => up("happyPay", { ...v.happyPay, show: x })}>
        <label className="block"><span className={lab}>Heading (new line = line break)</span><textarea rows={2} className={`${field} h-auto py-2`} value={v.happyPay.heading} onChange={(e) => up("happyPay", { ...v.happyPay, heading: e.target.value })} /></label>
        <label className="block"><span className={lab}>Text</span><textarea rows={3} className={`${field} h-auto py-2`} value={v.happyPay.body} onChange={(e) => up("happyPay", { ...v.happyPay, body: e.target.value })} /></label>
        <label className="block"><span className={lab}>Button text</span><input className={field} value={v.happyPay.cta} onChange={(e) => up("happyPay", { ...v.happyPay, cta: e.target.value })} /></label>
      </Section>
      <Section title="Featured video (optional)" show={v.video.show} onShow={(x) => up("video", { ...v.video, show: x })}
        note="Shows a YouTube video below the HappyPay block. Paste a YouTube link. The player only loads when a visitor taps play, so it doesn't slow the page.">
        <label className="block"><span className={lab}>YouTube link</span><input className={field} value={v.video.youtubeId} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => up("video", { ...v.video, youtubeId: e.target.value })} /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={lab}>Small line above (optional)</span><input className={field} value={v.video.eyebrow} placeholder="See us in action" onChange={(e) => up("video", { ...v.video, eyebrow: e.target.value })} /></label>
          <label><span className={lab}>Section title (shown above the video)</span><input className={field} value={v.video.heading} placeholder="HOW WE FIT YOUR TYRES" onChange={(e) => up("video", { ...v.video, heading: e.target.value })} /></label>
        </div>
        <label className="block"><span className={lab}>Caption under the video (optional)</span><input className={field} value={v.video.caption} onChange={(e) => up("video", { ...v.video, caption: e.target.value })} /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={lab}>Size on the page</span>
            <select className={field} value={v.video.size} onChange={(e) => up("video", { ...v.video, size: e.target.value as HomeContent["video"]["size"] })}>
              <option value="full">Full width</option><option value="large">Large (default)</option><option value="medium">Medium</option><option value="small">Small</option>
            </select></label>
          <label><span className={lab}>Shape (match your video)</span>
            <select className={field} value={v.video.shape} onChange={(e) => up("video", { ...v.video, shape: e.target.value as HomeContent["video"]["shape"] })}>
              <option value="16:9">Widescreen 16:9 (normal YouTube video)</option><option value="4:3">Classic 4:3</option><option value="1:1">Square 1:1</option><option value="9:16">Vertical 9:16 (YouTube Shorts / reels)</option>
            </select></label>
        </div>
      </Section>
      <Section title="Massive savings (deals)" show={v.deals.show} onShow={(x) => up("deals", { ...v.deals, show: x })}>
        <HeadingFields h={v.deals} set={(h) => up("deals", h)} />
        <ProductSource sec={v.deals} set={(x) => up("deals", x)} options={categoryOptions} autoLabel="Automatic (products on sale)" />
      </Section>
      <Section title="Fresh mags (wheels)" show={v.mags.show} onShow={(x) => up("mags", { ...v.mags, show: x })}>
        <HeadingFields h={v.mags} set={(h) => up("mags", h)} />
        <ProductSource sec={v.mags} set={(x) => up("mags", x)} options={categoryOptions} autoLabel="Automatic (mag wheels)" />
      </Section>
      <Section title="Our story & team" show={v.about.show} onShow={(x) => up("about", { show: x })} note="The text, stat tiles and team photos are edited in the sections further down this page." />
      <Section title="Shop by brand" show={v.brands.show} onShow={(x) => up("brands", { ...v.brands, show: x })}>
        <HeadingFields h={v.brands} set={(h) => up("brands", h)} />
      </Section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink p-3 shadow-2xl">
        <button type="button" disabled={!dirty} onClick={() => setConfirm(true)} className="btn btn-volt px-6 disabled:opacity-50">Save home page</button>
        <button type="button" disabled={!dirty} onClick={() => { setV(saved); setMsg(null); }} className="btn btn-dark px-4 disabled:opacity-50">Discard changes</button>
        {dirty && <span className="text-xs text-muted">Unsaved: {changedSections.map((k) => NAMES[k]).join(", ")}</span>}
        {msg && <span className={`text-sm font-semibold ${msg.ok ? "text-pay" : "text-sale"}`}>{msg.text}</span>}
      </div>

      <ConfirmDialog open={confirm} busy={busy} onYes={save} onNo={() => setConfirm(false)} yesLabel="Yes, update the home page">
        <p>These sections will change on the live home page:</p>
        <ul className="mt-2 list-disc pl-5 text-fg">{changedSections.map((k) => <li key={k}>{NAMES[k]}</li>)}</ul>
      </ConfirmDialog>
      {undo && (
        <UndoBar message="Home page updated" onClose={() => setUndo(null)}
          onUndo={async () => { const r = await put(undo); if (r) { setSaved(r); setV(r); setMsg({ ok: true, text: "↩ Undone." }); router.refresh(); } }} />
      )}
    </div>
  );
}
