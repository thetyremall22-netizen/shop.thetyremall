import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateProductFields, getProductRow, deleteProduct, type ProductPatch } from "@/lib/db/queries";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorize("products.delete"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await params;
  await deleteProduct(slug);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await authorize("products.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const row = await getProductRow(slug);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch: ProductPatch = {};
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.round(v)) : typeof v === "string" && v.trim() !== "" && isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : undefined);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  // content / basics
  if (str(body.name) !== undefined) patch.name = (body.name as string).trim();
  if (str(body.brand) !== undefined) patch.brand = (body.brand as string).trim();
  if (body.type === "tyre" || body.type === "wheel" || body.type === "accessory") patch.type = body.type;
  if (str(body.sku) !== undefined) patch.sku = (body.sku as string).trim();
  if (str(body.shortDescription) !== undefined) patch.shortDescription = body.shortDescription as string;
  if (str(body.description) !== undefined) patch.description = body.description as string;
  if (str(body.image) !== undefined) patch.image = (body.image as string).trim() || null;
  if (Array.isArray(body.categories)) patch.categories = JSON.stringify((body.categories as unknown[]).map(String).map((s) => s.trim()).filter(Boolean));
  else if (str(body.categories) !== undefined) patch.categories = JSON.stringify((body.categories as string).split(/[|,]/).map((s) => s.trim()).filter(Boolean));
  // specs: merge the provided keys into the existing specs
  if (body.specs && typeof body.specs === "object") {
    let existing: Record<string, unknown> = {};
    try { existing = JSON.parse(row.specs) as Record<string, unknown>; } catch { /* ignore */ }
    const incoming = body.specs as Record<string, unknown>;
    const merged = { ...existing };
    for (const [k, v] of Object.entries(incoming)) { const s = String(v ?? "").trim(); if (s) merged[k] = s; else delete merged[k]; }
    patch.specs = JSON.stringify(merged);
  }

  // stock / visibility
  if ("stockQty" in body) patch.stockQty = num(body.stockQty);
  if ("lowStockThreshold" in body) patch.lowStockThreshold = num(body.lowStockThreshold);
  if ("visible" in body) patch.visible = Boolean(body.visible);

  // pricing — set regular + sale + onSale, then recompute the effective price
  const regularIn = num(body.regularPrice);
  const saleIn = "salePrice" in body ? num(body.salePrice) : undefined;
  const onSaleIn = "onSale" in body ? Boolean(body.onSale) : undefined;
  if (regularIn !== undefined) patch.regularPrice = regularIn;
  if (saleIn !== undefined) patch.salePrice = saleIn;
  if (onSaleIn !== undefined) patch.onSale = onSaleIn;
  if (regularIn !== undefined || saleIn !== undefined || onSaleIn !== undefined || "price" in body) {
    const reg = patch.regularPrice ?? row.regularPrice;
    const sale = patch.salePrice ?? row.salePrice;
    const os = patch.onSale ?? row.onSale;
    patch.price = os && sale > 0 && sale < reg ? sale : reg;
  }

  await updateProductFields(slug, patch);
  const updated = await getProductRow(slug);
  return NextResponse.json({ ok: true, product: updated });
}
