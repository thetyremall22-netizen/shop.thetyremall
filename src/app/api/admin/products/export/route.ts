import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/db/queries";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await getAllProducts();
  // Same columns the import reads, so a downloaded file can be edited and uploaded back.
  const headers = ["slug", "sku", "name", "brand", "type", "regular_price", "sale_price", "on_sale", "stock", "low_stock_threshold", "visible", "categories",
    "image", "short_description", "long_description", "tyre_size", "width", "profile", "rim", "pcd"];
  const lines = [headers.join(",")];
  for (const p of rows) {
    let specs: Record<string, string> = {};
    try { specs = JSON.parse(p.specs || "{}"); } catch { /* bad json → blank specs */ }
    lines.push([
      p.slug, p.sku, p.name, p.brand, p.type,
      p.regularPrice, p.salePrice, p.onSale ? 1 : 0,
      p.stockQty, p.lowStockThreshold, p.visible ? 1 : 0,
      (JSON.parse(p.categories) as string[]).join("|"),
      p.image ?? "", p.shortDescription ?? "", p.description ?? "",
      specs.size ?? "", specs.width ?? "", specs.profile ?? "", specs.rim ?? "", specs.pcd ?? "",
    ].map(csvCell).join(","));
  }
  // BOM so Excel opens it as UTF-8 (R, ×, quotes in descriptions); the import strips it.
  const csv = "\uFEFF" + lines.join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tyremall-products-${date}.csv"`,
    },
  });
}
