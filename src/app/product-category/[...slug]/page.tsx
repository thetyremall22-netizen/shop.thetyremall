import type { Metadata } from "next";
import { ShopListing } from "@/components/ShopListing";
import { findCategory } from "@/lib/special-categories";
import { categoryPath } from "@/lib/shop-url";

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
  const { slug } = parse((await params).slug);
  const c = await findCategory(slug);
  // Unknown/retired category: a search page, kept out of Google's index.
  if (!c) return { title: "Shop tyres & mag wheels", robots: { index: false, follow: true } };
  return {
    title: c.name,
    description: `Shop ${c.name} at The Tyre Mall — South Africa's largest online tyre range, free delivery on 2+ tyres, pay later with HappyPay.`,
    alternates: { canonical: categoryPath(c.slug) },
  };
}

export default async function ProductCategoryPage({ params, searchParams }: { params: Promise<{ slug: string[] }>; searchParams: Promise<SP> }) {
  const { slug, page } = parse((await params).slug);
  const c = await findCategory(slug);
  const sp = await searchParams;
  const pageSp = page && !sp.page ? { page } : {};
  // An old link to a category that no longer exists still lands somewhere
  // useful: a search for its words (e.g. "womens-month-specials").
  if (!c) return <ShopListing sp={{ ...sp, q: (sp.q as string) || slug.replace(/[-_]+/g, " ").trim(), ...pageSp }} />;
  return <ShopListing sp={{ ...sp, category: c.slug, ...pageSp }} />;
}
