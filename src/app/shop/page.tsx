import type { Metadata } from "next";
import { ShopListing } from "@/components/ShopListing";
import { findCategory } from "@/lib/special-categories";
import { categoryPath, brandPath } from "@/lib/shop-url";

export const instant = false;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const cat = one((await searchParams).category);
  const c = cat ? await findCategory(cat) : undefined;
  // A category is the same listing as its /product-category/<slug> page.
  if (c) return { title: c.name, alternates: { canonical: categoryPath(c.slug) } };
  const brand = one((await searchParams).brand);
  // A brand on its own is the same listing as its /product-category/<brand> page.
  if (brand && !one((await searchParams).q)) return { title: `${brand} tyres`, alternates: { canonical: brandPath(brand) } };
  return { title: "Shop tyres & mag wheels" };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <ShopListing sp={await searchParams} />;
}
