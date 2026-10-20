import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createProduct, type NewProduct } from "@/lib/db/queries";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function POST(req: NextRequest) {
  if (!(await authorize("products.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try {
    b = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  const regularPrice = Math.round(Number(b.regularPrice) || 0);
  if (regularPrice <= 0) return NextResponse.json({ error: "A regular price is required." }, { status: 400 });

  const product: NewProduct = {
    slug: String(b.slug ?? "").trim() || slugify(name),
    name,
    brand: String(b.brand ?? "").trim(),
    type: b.type === "wheel" ? "wheel" : b.type === "other" || b.type === "accessory" ? "other" : "tyre",
    sku: String(b.sku ?? "").trim(),
    regularPrice,
    salePrice: b.salePrice ? Math.round(Number(b.salePrice)) : undefined,
    onSale: Boolean(b.onSale),
    stockQty: Math.max(0, Math.round(Number(b.stockQty) || 0)),
    categories: Array.isArray(b.categories) ? (b.categories as string[]) : String(b.categories ?? "").split("|").map((s) => s.trim()).filter(Boolean),
    shortDescription: String(b.shortDescription ?? ""),
    description: String(b.description ?? ""),
  };
  const res = await createProduct(product);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true, slug: product.slug });
}
