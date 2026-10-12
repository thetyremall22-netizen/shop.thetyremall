import "server-only";
import { db, schema, libsql } from "./db";

const SITE = process.env.WOO_SITE_URL || "https://thetyremall.co.za";
const toInt = (v: unknown) => Math.round(Number(v ?? 0));

interface WooProduct {
  slug: string;
  name: string;
  sku?: string;
  on_sale?: boolean;
  is_in_stock?: boolean;
  low_stock_remaining?: number | null;
  prices?: { price?: string; regular_price?: string; sale_price?: string };
  images?: { src: string }[];
  categories?: { slug: string }[];
  brands?: { name: string }[];
}

/**
 * Pull products (stock, price, sale, new items) from the WooCommerce Store API
 * into our DB. Existing products (matched by slug) have stock/price/sale/name
 * refreshed; new products are inserted. This is what keeps the fast local
 * catalogue current with Woo — and therefore with TyreQ, which feeds Woo.
 */
export async function syncFromWoo(): Promise<{ updated: number; inserted: number; pages: number }> {
  const existing = new Set(
    (await db.select({ slug: schema.products.slug }).from(schema.products)).map((r) => r.slug)
  );
  const UPD = "UPDATE products SET price=?,regular_price=?,sale_price=?,on_sale=?,stock_qty=?,name=?,updated_at=? WHERE slug=?";
  const INS = `INSERT OR IGNORE INTO products
    (id,slug,name,brand,type,sku,price,regular_price,sale_price,on_sale,stock_qty,low_stock_threshold,image,categories,specs,short_description,description,visible,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  const stmts: { sql: string; args: (string | number)[] }[] = [];
  let page = 1, updated = 0, inserted = 0;

  for (; page <= 80; page++) {
    const res = await fetch(`${SITE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`, { cache: "no-store" });
    if (!res.ok) break;
    const arr = (await res.json()) as WooProduct[];
    if (!Array.isArray(arr) || !arr.length) break;

    for (const p of arr) {
      if (!p.slug) continue;
      const now = Date.now();
      const reg = toInt(p.prices?.regular_price);
      const sal = toInt(p.prices?.sale_price);
      const onSale = !!p.on_sale && sal > 0 && sal < reg ? 1 : 0;
      const price = onSale ? sal : reg;
      const stock = !p.is_in_stock ? 0 : (p.low_stock_remaining ?? 50);
      const cats = (p.categories ?? []).map((c) => c.slug);
      const isWheel = cats.includes("mag-wheel") || cats.includes("wheel-rims");

      if (existing.has(p.slug)) {
        stmts.push({ sql: UPD, args: [price, reg, sal || reg, onSale, stock, p.name, now, p.slug] });
        updated++;
      } else {
        const id = Math.floor(now / 1000) * 1000 + Math.floor(Math.random() * 1000);
        stmts.push({ sql: INS, args: [id, p.slug, p.name, p.brands?.[0]?.name ?? "", isWheel ? "wheel" : "tyre", p.sku ?? "", price, reg, sal || reg, onSale, stock, 4, p.images?.[0]?.src ?? "/brand/placeholder-tyre.webp", JSON.stringify(cats), "{}", "", "", 1, now] });
        existing.add(p.slug);
        inserted++;
      }
    }
  }

  // batched writes — far faster than one-by-one
  for (let i = 0; i < stmts.length; i += 300) {
    await libsql.batch(stmts.slice(i, i + 300), "write");
  }
  return { updated, inserted, pages: page - 1 };
}
