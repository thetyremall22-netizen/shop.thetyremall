import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { updateProductFields, getProductRow, deleteProduct, type ProductPatch } from "@/lib/db/queries";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  await deleteProduct(slug);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const patch: ProductPatch = {};
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : undefined);
  if ("price" in body) patch.price = num(body.price);
  if ("salePrice" in body) patch.salePrice = num(body.salePrice);
  if ("stockQty" in body) patch.stockQty = num(body.stockQty);
  if ("lowStockThreshold" in body) patch.lowStockThreshold = num(body.lowStockThreshold);
  if ("onSale" in body) patch.onSale = Boolean(body.onSale);
  if ("visible" in body) patch.visible = Boolean(body.visible);
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.shortDescription === "string") patch.shortDescription = body.shortDescription;
  if (typeof body.description === "string") patch.description = body.description;

  // keep price consistent with sale state
  if (patch.onSale === false && patch.salePrice === undefined) {
    const row = await getProductRow(slug);
    if (row) patch.price = patch.price ?? row.regularPrice;
  }
  if (patch.onSale === true && patch.salePrice !== undefined) {
    patch.price = patch.salePrice;
  }

  await updateProductFields(slug, patch);
  const row = await getProductRow(slug);
  return NextResponse.json({ ok: true, product: row });
}
