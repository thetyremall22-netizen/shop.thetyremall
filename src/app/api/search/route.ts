import { NextRequest, NextResponse } from "next/server";
import { searchProducts, dealProducts, bestSellers } from "@/lib/catalogue";
import { discountPct } from "@/lib/format";
import type { Product } from "@/lib/types";

function map(p: Product) {
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    price: p.price,
    regularPrice: p.regularPrice,
    onSale: p.onSale,
    pct: discountPct(p.regularPrice, p.price),
    thumb: p.thumb ?? p.image,
    size: p.specs.size ?? "",
    type: p.type,
    inStock: p.inStock,
  };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    // recommended: on-sale first, then best sellers (deduped)
    const seen = new Set<number>();
    const recommended: ReturnType<typeof map>[] = [];
    const [deals, sellers] = await Promise.all([dealProducts(14), bestSellers(14)]);
    for (const p of [...deals, ...sellers]) {
      if (seen.has(p.id) || !p.image) continue;
      seen.add(p.id);
      recommended.push(map(p));
      if (recommended.length >= 12) break;
    }
    return NextResponse.json({ mode: "recommended", results: recommended });
  }

  const results = (await searchProducts(q, 14)).map(map);
  return NextResponse.json({ mode: "results", results });
}
