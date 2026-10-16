import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getProductRow, createProduct, type NewProduct } from "@/lib/db/queries";

function parse<T>(s: string, fb: T): T { try { return JSON.parse(s) as T; } catch { return fb; } }

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorize("products.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await params;
  const row = await getProductRow(slug);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Find a free slug: slug-copy, slug-copy-2, …
  let newSlug = `${slug}-copy`;
  for (let i = 2; await getProductRow(newSlug); i++) newSlug = `${slug}-copy-${i}`;

  const product: NewProduct = {
    slug: newSlug,
    name: `${row.name} (Copy)`,
    brand: row.brand,
    type: row.type,
    sku: row.sku ? `${row.sku}-COPY` : "",
    regularPrice: row.regularPrice,
    salePrice: row.salePrice,
    onSale: row.onSale,
    stockQty: 0, // a copy starts out of stock until reviewed
    lowStockThreshold: row.lowStockThreshold,
    image: row.image,
    categories: parse<string[]>(row.categories, []),
    specs: parse<Record<string, string>>(row.specs, {}),
    shortDescription: row.shortDescription,
    description: row.description,
    visible: false, // draft until reviewed
  };
  const res = await createProduct(product);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, slug: newSlug });
}
