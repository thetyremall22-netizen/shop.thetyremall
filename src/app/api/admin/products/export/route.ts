import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAllProducts } from "@/lib/db/queries";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await getAllProducts();
  const headers = ["slug", "sku", "name", "brand", "type", "regular_price", "sale_price", "on_sale", "stock", "low_stock_threshold", "visible", "categories"];
  const lines = [headers.join(",")];
  for (const p of rows) {
    lines.push([
      p.slug, p.sku, p.name, p.brand, p.type,
      p.regularPrice, p.salePrice, p.onSale ? 1 : 0,
      p.stockQty, p.lowStockThreshold, p.visible ? 1 : 0,
      (JSON.parse(p.categories) as string[]).join("|"),
    ].map(csvCell).join(","));
  }
  const csv = lines.join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tyremall-products-${date}.csv"`,
    },
  });
}
