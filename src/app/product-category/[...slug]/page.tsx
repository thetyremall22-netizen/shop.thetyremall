import type { Metadata } from "next";
import { ShopListing } from "@/components/ShopListing";
import { findCategory, getSpecialBySlug } from "@/lib/special-categories";
import { SpecialEnded } from "@/components/SpecialEnded";
import { categoryPath, brandPath, FILTER_PAGES } from "@/lib/shop-url";
import { getBrandDirectory } from "@/lib/brand-registry";
import { listingJsonLd, ldJson } from "@/lib/site-schema";

/** A brand with products, by its page slug (e.g. "bridgestone"). */
async function findBrand(slug: string) {
  return (await getBrandDirectory()).find((b) => b.slug === slug && b.count > 0);
}

// Category pages at the old WooCommerce addresses, served directly (no
// redirect) so existing Google Ads / search links keep working:
//   /product-category/passenger-tyres
//   /product-category/mag-wheel/            (trailing slash is fine)
//   /product-category/tyres/suv-tyres       (old parent/child paths → last part)
//   /product-category/suv-tyres/page/2/     (old WordPress paging)
export const instant = false;

type SP = Record<string, string | string[] | undefined>;

function parse(segments: string[]): { slug: string; page?: string } {
  const parts = segments.map((s) => decodeURIComponent(s)).filter(Boolean);
  let page: string | undefined;
  const i = parts.indexOf("page");
  if (i >= 0 && /^\d+$/.test(parts[i + 1] ?? "")) { page = parts[i + 1]; parts.splice(i, 2); }
  return { slug: (parts[parts.length - 1] ?? "").toLowerCase(), page };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug, page } = parse((await params).slug);
  // Page 2, 3… of a listing is its own page for Google (it lists different products).
  const pg = (path: string) => (page && Number(page) > 1 ? `${path}/page/${Number(page)}` : path);
  const pt = (t: string) => (page && Number(page) > 1 ? `${t} — page ${Number(page)}` : t);
  const f = FILTER_PAGES[slug];
  if (f) return {
    title: pt(f.name),
    description: `Shop ${f.name.toLowerCase()} at The Tyre Mall — South Africa's largest online tyre range, free delivery on 2+ tyres, pay later with HappyPay.`,
    alternates: { canonical: pg(categoryPath(f.canonical ?? slug)) },
  };
  const c = await findCategory(slug);
  if (!c) {
    // A special/sale that isn't running: keep the page (no 404), out of Google.
    const s = await getSpecialBySlug(slug);
    if (s) return { title: s.name, robots: { index: false, follow: true } };
    const b = await findBrand(slug);
    if (b) return {
      title: pt(`${b.name} tyres`),
      description: `Shop ${b.name} at The Tyre Mall — South Africa's largest online tyre range, free delivery on 2+ tyres, pay later with HappyPay.`,
      alternates: { canonical: pg(brandPath(b.name)) },
    };
    // Unknown/retired category: a search page, kept out of Google's index.
    return { title: "Shop tyres & mag wheels", robots: { index: false, follow: true } };
  }
  return {
    title: pt(c.name),
    description: `Shop ${c.name} at The Tyre Mall — South Africa's largest online tyre range, free delivery on 2+ tyres, pay later with HappyPay.`,
    alternates: { canonical: pg(categoryPath(c.slug)) },
  };
}

export default async function ProductCategoryPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<SP> }) {
  const { slug, page } = parse((await params).slug);
  const c = await findCategory(slug);
  const sp = await searchParams;
  const pageSp = page && !sp.page ? { page } : {};
  // All tyres (/product-category/tyres) and everything on sale (/product-category/hot-dealz, also /on-sale).
  const f = FILTER_PAGES[slug];
  // Structured data so Google knows this is a listing and where it sits (Home › Shop › …).
  const ld = (name: string, path: string) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(listingJsonLd(name, path)) }} />;
  if (f) return <>{ld(f.name, categoryPath(f.canonical ?? slug))}<ShopListing sp={{ ...sp, ...f.params, ...pageSp }} /></>;
  // An old link to a category that no longer exists still lands somewhere
  // useful: a search for its words (e.g. "womens-month-specials").
  if (!c) {
    // A special or sale that has ended (or not started): say so and show deals.
    const s = await getSpecialBySlug(slug);
    if (s) return <div className="container-x py-6 lg:py-10"><SpecialEnded special={s} limit={12} /></div>;
    // A brand page, e.g. /product-category/bridgestone.
    const b = await findBrand(slug);
    if (b) return <>{ld(`${b.name} tyres`, brandPath(b.name))}<ShopListing sp={{ ...sp, brand: b.name, ...pageSp }} /></>;
    return <ShopListing sp={{ ...sp, q: (sp.q as string) || slug.replace(/[-_]+/g, " ").trim(), ...pageSp }} />;
  }
  return <>{ld(c.name, categoryPath(c.slug))}<ShopListing sp={{ ...sp, category: c.slug, ...pageSp }} /></>;
}
