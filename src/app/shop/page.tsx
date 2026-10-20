import type { Metadata } from "next";
import { ShopListing } from "@/components/ShopListing";
import { getCategory } from "@/lib/catalogue";
import { categoryPath } from "@/lib/shop-url";

export const instant = false;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const cat = one((await searchParams).category);
  const c = cat ? getCategory(cat) : undefined;
  // A category is the same listing as its /product-category/<slug> page.
  return c
    ? { title: c.name, alternates: { canonical: categoryPath(c.slug) } }
    : { title: "Shop tyres & mag wheels" };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <ShopListing sp={await searchParams} />;
}
