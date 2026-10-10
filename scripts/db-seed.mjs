// Seeds the custom-backend database from the product snapshot.
// Local:  node scripts/db-seed.mjs            (writes .data/ttm.db)
// Turso:  DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… node scripts/db-seed.mjs
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const url = process.env.DATABASE_URL || "file:.data/ttm.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;
const db = createClient(authToken ? { url, authToken } : { url });

await db.batch(
  [
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'tyre',
      sku TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL DEFAULT 0,
      regular_price INTEGER NOT NULL DEFAULT 0,
      sale_price INTEGER NOT NULL DEFAULT 0,
      on_sale INTEGER NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 4,
      image TEXT,
      categories TEXT NOT NULL DEFAULT '[]',
      specs TEXT NOT NULL DEFAULT '{}',
      short_description TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      visible INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_products_type ON products(type)`,
    `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand)`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL UNIQUE,
      reference TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer TEXT NOT NULL DEFAULT '{}',
      delivery TEXT NOT NULL DEFAULT '{}',
      items TEXT NOT NULL DEFAULT '[]',
      totals TEXT NOT NULL DEFAULT '{}',
      payment_method TEXT NOT NULL DEFAULT '',
      pf_payment_id TEXT,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`,
    `INSERT OR IGNORE INTO meta (key, value) VALUES ('order_seq', '0')`,
  ],
  "write"
);

const prods = JSON.parse(readFileSync("src/data/products.json", "utf8"));
const now = Date.now();

// Seed stock: use the snapshot qty when present, else a placeholder the admin
// can correct (in-stock -> 25, out-of-stock -> 0).
function stockFor(p) {
  if (typeof p.stockQty === "number") return p.stockQty;
  return p.inStock ? 25 : 0;
}

const sql =
  `INSERT INTO products
   (id, slug, name, brand, type, sku, price, regular_price, sale_price, on_sale,
    stock_qty, low_stock_threshold, image, categories, specs, short_description, description, visible, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(slug) DO UPDATE SET
     name=excluded.name, brand=excluded.brand, type=excluded.type, sku=excluded.sku,
     price=excluded.price, regular_price=excluded.regular_price, sale_price=excluded.sale_price,
     on_sale=excluded.on_sale, image=excluded.image, categories=excluded.categories,
     specs=excluded.specs, short_description=excluded.short_description, description=excluded.description,
     updated_at=excluded.updated_at`;

let n = 0;
const CHUNK = 400;
for (let i = 0; i < prods.length; i += CHUNK) {
  const batch = prods.slice(i, i + CHUNK).map((p) => ({
    sql,
    args: [
      p.id, p.slug, p.name, p.brand ?? "", p.type ?? "tyre", p.sku ?? "",
      p.price ?? 0, p.regularPrice ?? 0, p.salePrice ?? 0, p.onSale ? 1 : 0,
      stockFor(p), 4, p.image ?? null,
      JSON.stringify(p.categories ?? []), JSON.stringify(p.specs ?? {}),
      p.shortDescription ?? "", p.description ?? "", 1, now,
    ],
  }));
  await db.batch(batch, "write");
  n += batch.length;
}

const count = (await db.execute("SELECT COUNT(*) c FROM products")).rows[0].c;
const inStock = (await db.execute("SELECT COUNT(*) c FROM products WHERE stock_qty > 0")).rows[0].c;
console.log(`seeded ${n} products | table now holds ${count} | in stock: ${inStock}`);
