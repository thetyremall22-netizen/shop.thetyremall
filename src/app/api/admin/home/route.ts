import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { readHomeRaw, saveHomeContent, HOME_DEFAULTS, MAX_BANNERS, type HomeContent, type Heading, type Banner, type Tile, type ProductSection, type VideoSize, type VideoShape } from "@/lib/home-content";
import { addAudit, actorName } from "@/lib/audit";

const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
/** Links: site pages ("/shop?…") or full https addresses only. */
const link = (v: unknown) => { const s = str(v, 500); return s && (/^\/(?!\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };
/** Images: our media library, our own /promo or /brand files, or https. */
const image = (v: unknown) => { const s = str(v, 500); return s && (/^\/(api\/media\/\d+|promo\/|brand\/|products\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };
const youtubeId = (v: unknown) => {
  const s = str(v, 200);
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) ?? s.match(/^([\w-]{11})$/);
  return m ? m[1] : "";
};
const heading = (v: unknown, d: Heading): Heading => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { show: bool(o.show, d.show), eyebrow: str(o.eyebrow, 120), silver: str(o.silver, 40), green: str(o.green, 40) };
};

const productSection = (v: unknown, d: ProductSection): ProductSection => {
  const o = (v ?? {}) as Record<string, unknown>;
  const cats = Array.isArray(o.categories) ? (o.categories as unknown[]).map((c) => str(c, 80)).filter((c) => /^[a-z0-9-]+$/.test(c)).slice(0, 12) : [];
  return {
    ...heading(v, d),
    source: o.source === "categories" && cats.length ? "categories" : "auto",
    categories: cats,
    limit: Math.max(4, Math.min(16, Math.round(Number(o.limit) || d.limit))),
  };
};
const SIZES: VideoSize[] = ["full", "large", "medium", "small"];
const SHAPES: VideoShape[] = ["16:9", "4:3", "1:1", "9:16"];

export async function PUT(req: NextRequest) {
  const actor = await authorize("content.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit content." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const D = HOME_DEFAULTS;

  const bn = (b.banners ?? {}) as Record<string, unknown>;
  const slides: Banner[] = (Array.isArray(bn.slides) ? bn.slides : []).slice(0, MAX_BANNERS)
    .map((x) => { const o = x as Record<string, unknown>; return { src: image(o.src), alt: str(o.alt, 200), href: link(o.href) }; })
    .filter((x) => x.src);
  if (Array.isArray(bn.slides) && bn.slides.length > MAX_BANNERS) {
    return NextResponse.json({ error: `A maximum of ${MAX_BANNERS} banners can show at a time (keeps the home page fast).` }, { status: 400 });
  }
  const tilesIn = ((b.tiles ?? {}) as Record<string, unknown>).items;
  const tiles = [0, 1].map((i) => {
    const o = (Array.isArray(tilesIn) ? tilesIn[i] : {}) as Record<string, unknown>;
    const d = D.tiles.items[i];
    return { title: str(o?.title, 30) || d.title, tags: str(o?.tags, 160), href: link(o?.href) || d.href, cta: str(o?.cta, 40) || d.cta, image: image(o?.image) || d.image };
  }) as [Tile, Tile];
  const hp = (b.happyPay ?? {}) as Record<string, unknown>;
  const vid = (b.video ?? {}) as Record<string, unknown>;

  const next: HomeContent = {
    banners: { show: bool(bn.show, true), mode: bn.mode === "rotate" ? "rotate" : "static", intervalSec: Math.max(3, Math.min(20, Math.round(Number(bn.intervalSec) || 6))), slides },
    hero: { image: image(((b.hero ?? {}) as Record<string, unknown>).image) || D.hero.image },
    tiles: { show: bool(((b.tiles ?? {}) as Record<string, unknown>).show, true), items: tiles },
    reviews: heading(b.reviews, D.reviews),
    fanFavourites: productSection(b.fanFavourites, D.fanFavourites),
    happyPay: { show: bool(hp.show, true), heading: str(hp.heading, 80), body: str(hp.body, 400), cta: str(hp.cta, 60) },
    deals: productSection(b.deals, D.deals),
    mags: productSection(b.mags, D.mags),
    about: { show: bool(((b.about ?? {}) as Record<string, unknown>).show, true) },
    brands: heading(b.brands, D.brands),
    video: {
      show: bool(vid.show, false), youtubeId: youtubeId(vid.youtubeId), eyebrow: str(vid.eyebrow, 120), heading: str(vid.heading, 80), caption: str(vid.caption, 300),
      size: SIZES.includes(vid.size as VideoSize) ? (vid.size as VideoSize) : "large",
      shape: SHAPES.includes(vid.shape as VideoShape) ? (vid.shape as VideoShape) : "16:9",
    },
  };
  if (next.video.show && !next.video.youtubeId) return NextResponse.json({ error: "Add a YouTube link for the video section, or switch it off." }, { status: 400 });

  const before = await readHomeRaw();
  await saveHomeContent(next);
  const changed = (Object.keys(next) as (keyof HomeContent)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
  if (changed.length) {
    await addAudit({
      entity: "content", entityId: "home", action: "edit", actor: actorName(actor),
      summary: `Home page updated: ${changed.join(", ")}${changed.includes("banners") ? ` (${slides.length} banner${slides.length === 1 ? "" : "s"}, ${next.banners.mode})` : ""}`,
      before: before as unknown as Record<string, unknown>, after: next as unknown as Record<string, unknown>,
    });
  }
  return NextResponse.json({ ok: true, content: next });
}
