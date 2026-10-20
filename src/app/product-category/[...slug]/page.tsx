import type { Metadata } from "next";
import { ShopListing } from "@/components/ShopListing";
import { findCategory } from "@/lib/special-categories";
import { categoryPath, brandPath } from "@/lib/shop-url";
import { getBrandDirectory } from "@/lib/brand-registry";

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
  const { slug } = parse((await params).slug);
  const c = await findCategory(slug);
  if (!c) {
    const b = await findBrand(slug);
    if (b) return {
      title: `${b.name} tyres`,
      description: `Shop ${b.name} at The Tyre Mall — South Africa's largest online tyre range, free delivery on 2+ tyres, pay later with HappyPay.`,
      alternates: { canonical: brandPath(b.name) },
    };
    // Unknown/retired category: a search page, kept out of Google's index.
    return { title: "Shop tyres & mag wheels", robots: { index: false, follow: true } };
  }
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
  if (!c) {
    // A brand page, e.g. /product-category/bridgestone.
    const b = await findBrand(slug);
    if (b) return <ShopListing sp={{ ...sp, brand: b.name, ...pageSp }} />;
    return <ShopListing sp={{ ...sp, q: (sp.q as string) || slug.replace(/[-_]+/g, " ").trim(), ...pageSp }} />;
  }
  return <ShopListing sp={{ ...sp, category: c.slug, ...pageSp }} />;
}
