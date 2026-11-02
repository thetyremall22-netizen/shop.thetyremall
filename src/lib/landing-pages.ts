import "server-only";
import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { libsql } from "./db";

// Landing pages built in Admin → Pages (super admins): a title, subtitle,
// banner image and a list of sections — text, image, video, or products from
// a category (e.g. a special). Each lives at its own address,
// thetyremall.co.za/<slug>, and can be linked from the main menu, the footer,
// or nowhere. Kept in their own table, separate from the site's built-in pages.

export type SectionType = "text" | "image" | "video" | "products";
export interface PageSection {
  id: string;
  type: SectionType;
  heading?: string;
  body?: string;       // text: paragraphs separated by a blank line; [words](link) makes a link
  image?: string;      // image section
  alt?: string;
  caption?: string;
  link?: string;       // image: optional click-through
  video?: string;      // YouTube / Vimeo / .mp4 address
  category?: string;   // products: category slug (built-in, special or sale)
  limit?: number;      // products: how many to show
}

export type MenuPlace = "none" | "main" | "footer";
export interface LandingPage {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  menu: MenuPlace;
  menuLabel: string;
  menuOrder: number;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
  sections: PageSection[];
  createdAt: number;
  updatedAt: number;
}

export const LANDING_TAG = "landing-pages";

/** Addresses the website already uses — a landing page can't take these. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "about", "account", "blog", "brand", "brands", "cart", "checkout", "compare", "coming-soon",
  "contact", "contact-us", "delivery-areas", "faq", "feeds", "how-to-apply-for-credit-online", "mag-wheels",
  "maintenance", "product", "product-category", "products", "radar-protect", "returns", "shop", "stores", "terms",
  "vehicle-search", "wishlist", "sitemap", "robots", "llms", "_next", "brand-logos", "wp-admin", "wp-content",
  "wp-includes", "wp-login", "my-account", "home", "index",
]);

export const slugifyPage = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS landing_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT NOT NULL DEFAULT '',
    hero_image TEXT NOT NULL DEFAULT '',
    menu TEXT NOT NULL DEFAULT 'none',
    menu_label TEXT NOT NULL DEFAULT '',
    menu_order INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 0,
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    sections TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;
function toPage(r: Row): LandingPage {
  let sections: PageSection[] = [];
  try { sections = JSON.parse(String(r.sections ?? "[]")); } catch { /* bad json → none */ }
  const menu = String(r.menu ?? "none");
  return {
    id: Number(r.id), slug: String(r.slug), title: String(r.title ?? ""), subtitle: String(r.subtitle ?? ""),
    heroImage: String(r.hero_image ?? ""), menu: (["main", "footer"].includes(menu) ? menu : "none") as MenuPlace,
    menuLabel: String(r.menu_label ?? ""), menuOrder: Number(r.menu_order) || 0, published: Number(r.published) === 1,
    seoTitle: String(r.seo_title ?? ""), seoDescription: String(r.seo_description ?? ""), sections: Array.isArray(sections) ? sections : [],
    createdAt: Number(r.created_at) || 0, updatedAt: Number(r.updated_at) || 0,
  };
}

// ---- admin (always live) -----------------------------------------------------------

export async function listLandingPages(): Promise<LandingPage[]> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT * FROM landing_pages ORDER BY updated_at DESC");
    return (r.rows as Row[]).map(toPage);
  } catch { return []; }
}

export async function getLandingPage(id: number): Promise<LandingPage | null> {
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT * FROM landing_pages WHERE id = ?", args: [id] });
  return r.rows.length ? toPage(r.rows[0] as Row) : null;
}

/** Why this address can't be used (null = fine). */
export async function slugProblem(slug: string, exceptId?: number): Promise<string | null> {
  if (!slug) return "Please give the page an address.";
  if (RESERVED_SLUGS.has(slug)) return `“/${slug}” is already used by the website. Please choose another address.`;
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT id FROM landing_pages WHERE slug = ? AND id != ?", args: [slug, exceptId ?? -1] });
  return r.rows.length ? `Another landing page already uses “/${slug}”.` : null;
}

const clean = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const TYPES: SectionType[] = ["text", "image", "video", "products"];

/** Tidy sections from the admin form (known fields only, sensible limits). */
export function cleanSections(raw: unknown): PageSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 60).flatMap((s, i): PageSection[] => {
    if (!s || typeof s !== "object") return [];
    const o = s as Record<string, unknown>;
    const type = TYPES.includes(o.type as SectionType) ? (o.type as SectionType) : null;
    if (!type) return [];
    const id = clean(o.id, 40) || `s${Date.now().toString(36)}${i}`;
    const base: PageSection = { id, type, heading: clean(o.heading, 200) };
    if (type === "text") return [{ ...base, body: clean(o.body, 20000) }];
    if (type === "image") return [{ ...base, image: clean(o.image, 500), alt: clean(o.alt, 200), caption: clean(o.caption, 300), link: clean(o.link, 500) }];
    if (type === "video") return [{ ...base, video: clean(o.video, 500), caption: clean(o.caption, 300) }];
    return [{ ...base, category: clean(o.category, 80), body: clean(o.body, 2000), limit: Math.max(4, Math.min(48, Math.round(Number(o.limit) || 12))) }];
  });
}

export interface LandingInput {
  slug: string; title: string; subtitle?: string; heroImage?: string; menu?: MenuPlace; menuLabel?: string; menuOrder?: number;
  published?: boolean; seoTitle?: string; seoDescription?: string; sections?: unknown;
}

export async function saveLandingPage(id: number | null, p: LandingInput): Promise<{ ok: true; page: LandingPage } | { ok: false; error: string }> {
  await ensureTable();
  const slug = slugifyPage(p.slug || p.title);
  const problem = await slugProblem(slug, id ?? undefined);
  if (problem) return { ok: false, error: problem };
  if (!p.title.trim()) return { ok: false, error: "Please give the page a title." };
  const now = Date.now();
  const vals = [
    slug, clean(p.title, 200), clean(p.subtitle, 500), clean(p.heroImage, 500),
    ["main", "footer"].includes(p.menu ?? "") ? p.menu! : "none", clean(p.menuLabel, 40), Math.round(Number(p.menuOrder) || 0),
    p.published ? 1 : 0, clean(p.seoTitle, 120), clean(p.seoDescription, 300), JSON.stringify(cleanSections(p.sections)),
  ];
  let newId = id;
  if (id) {
    await libsql.execute({
      sql: `UPDATE landing_pages SET slug=?, title=?, subtitle=?, hero_image=?, menu=?, menu_label=?, menu_order=?, published=?, seo_title=?, seo_description=?, sections=?, updated_at=? WHERE id=?`,
      args: [...vals, now, id],
    });
  } else {
    const r = await libsql.execute({
      sql: `INSERT INTO landing_pages (slug, title, subtitle, hero_image, menu, menu_label, menu_order, published, seo_title, seo_description, sections, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [...vals, now, now],
    });
    newId = Number(r.lastInsertRowid);
  }
  bump();
  const page = await getLandingPage(newId!);
  return page ? { ok: true, page } : { ok: false, error: "Couldn't save the page." };
}

export async function deleteLandingPage(id: number): Promise<void> {
  await ensureTable();
  await libsql.execute({ sql: "DELETE FROM landing_pages WHERE id = ?", args: [id] });
  bump();
}

function bump() { try { revalidateTag(LANDING_TAG, "max"); } catch { /* outside a request */ } }

// ---- public (cached; refreshed the moment a page is saved) ---------------------------

export async function getPublishedLandingPage(slug: string): Promise<LandingPage | null> {
  "use cache";
  cacheTag(LANDING_TAG);
  cacheLife("max");
  try {
    await ensureTable();
    const r = await libsql.execute({ sql: "SELECT * FROM landing_pages WHERE slug = ? AND published = 1", args: [slug] });
    return r.rows.length ? toPage(r.rows[0] as Row) : null;
  } catch { return null; }
}

/** Published pages to show in the main menu / footer. */
export async function landingMenu(): Promise<{ main: { label: string; href: string }[]; footer: { label: string; href: string }[] }> {
  "use cache";
  cacheTag(LANDING_TAG);
  cacheLife("max");
  const out = { main: [] as { label: string; href: string }[], footer: [] as { label: string; href: string }[] };
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT slug, title, menu, menu_label FROM landing_pages WHERE published = 1 AND menu IN ('main','footer') ORDER BY menu_order, title");
    for (const x of r.rows as Row[]) {
      const item = { label: String(x.menu_label || x.title), href: `/${String(x.slug)}` };
      (String(x.menu) === "main" ? out.main : out.footer).push(item);
    }
  } catch { /* none */ }
  return out;
}

export async function publishedLandingSlugs(): Promise<string[]> {
  try {
    await ensureTable();
    const r = await libsql.execute("SELECT slug FROM landing_pages WHERE published = 1");
    return (r.rows as Row[]).map((x) => String(x.slug));
  } catch { return []; }
}

// ---- video ----------------------------------------------------------------------------

/** A YouTube / Vimeo / .mp4 address → what to show (null if not a supported video). */
export function videoSource(url: string): { kind: "iframe" | "file"; src: string } | null {
  const u = url.trim();
  let m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = u.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  if (/^(https:\/\/|\/)[^\s"']+\.(mp4|webm)(\?[^\s"']*)?$/i.test(u)) return { kind: "file", src: u };
  return null;
}
