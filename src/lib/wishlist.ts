import "server-only";
import { libsql } from "./db";

// Client wishlists (signed-in clients only, stored on the site so they follow the
// client to any device). Each row remembers the price / stock / sale state the
// client was last told about, so an alert goes out once per change.

export interface WishlistItem {
  id: number;
  slug: string;
  addedAt: number;
  name: string;
  brand: string;
  type: string;
  image: string | null;
  price: number;
  regularPrice: number;
  onSale: boolean;
  inStock: boolean;
  /** false when the product was removed from the shop */
  available: boolean;
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await libsql.execute(`CREATE TABLE IF NOT EXISTS wishlist (
    customer_id INTEGER NOT NULL,
    product_slug TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT 0,
    seen_price INTEGER NOT NULL DEFAULT 0,
    seen_on_sale INTEGER NOT NULL DEFAULT 0,
    seen_in_stock INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (customer_id, product_slug)
  )`);
  ensured = true;
}

type Row = Record<string, unknown>;

export async function wishlistSlugs(customerId: number): Promise<string[]> {
  await ensureTable();
  const r = await libsql.execute({ sql: "SELECT product_slug FROM wishlist WHERE customer_id = ? ORDER BY added_at DESC", args: [customerId] });
  return r.rows.map((x) => String(x.product_slug));
}

export async function addToWishlist(customerId: number, slug: string): Promise<boolean> {
  await ensureTable();
  const p = await libsql.execute({ sql: "SELECT price, on_sale, stock_qty FROM products WHERE slug = ? AND visible = 1", args: [slug] });
  const row = p.rows[0];
  if (!row) return false;
  // Start from what the client sees now, so only FUTURE changes trigger an email.
  await libsql.execute({
    sql: `INSERT INTO wishlist (customer_id, product_slug, added_at, seen_price, seen_on_sale, seen_in_stock)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(customer_id, product_slug) DO NOTHING`,
    args: [customerId, slug, Date.now(), Number(row.price) || 0, Number(row.on_sale) ? 1 : 0, Number(row.stock_qty) > 0 ? 1 : 0],
  });
  return true;
}

export async function removeFromWishlist(customerId: number, slug: string): Promise<void> {
  await ensureTable();
  await libsql.execute({ sql: "DELETE FROM wishlist WHERE customer_id = ? AND product_slug = ?", args: [customerId, slug] });
}

export async function listWishlist(customerId: number): Promise<WishlistItem[]> {
  await ensureTable();
  const r = await libsql.execute({
    sql: `SELECT w.product_slug, w.added_at, p.id, p.name, p.brand, p.type, p.image, p.price, p.regular_price, p.on_sale, p.stock_qty, p.visible
          FROM wishlist w LEFT JOIN products p ON p.slug = w.product_slug
          WHERE w.customer_id = ? ORDER BY w.added_at DESC`,
    args: [customerId],
  });
  return r.rows.map((x: Row) => ({
    id: Number(x.id) || 0,
    slug: String(x.product_slug),
    addedAt: Number(x.added_at) || 0,
    name: String(x.name ?? x.product_slug),
    brand: String(x.brand ?? ""),
    type: String(x.type ?? "tyre"),
    image: x.image ? String(x.image) : null,
    price: Number(x.price) || 0,
    regularPrice: Number(x.regular_price) || 0,
    onSale: Number(x.on_sale) === 1,
    inStock: Number(x.stock_qty) > 0,
    available: x.name != null && Number(x.visible) === 1,
  }));
}

// ---- alerts -------------------------------------------------------------------
export interface WishlistChange { slug: string; name: string; brand: string; image: string | null; price: number; oldPrice: number; regularPrice: number; reasons: ("sale" | "price" | "stock")[] }

/** Work out, per client, which wishlist items changed for the better since they
 *  were last told: went on sale, dropped in price, or came back in stock (and
 *  can be bought right now). Also records the new state for every item, so a
 *  product that goes out of stock and comes back later alerts again. */
export async function collectWishlistChanges(): Promise<{ customerId: number; email: string; firstName: string; changes: WishlistChange[] }[]> {
  await ensureTable();
  const r = await libsql.execute(`
    SELECT w.customer_id, w.product_slug, w.seen_price, w.seen_on_sale, w.seen_in_stock,
           p.name, p.brand, p.image, p.price, p.regular_price, p.on_sale, p.stock_qty, p.visible,
           c.email, c.first_name, c.verified, c.wishlist_emails
    FROM wishlist w
    JOIN products p ON p.slug = w.product_slug
    JOIN customers c ON c.id = w.customer_id`).catch((e: Error) => {
    if (/no such table/i.test(e.message)) return { rows: [] as Row[] }; // nobody has registered yet
    throw e;
  });
  const byCustomer = new Map<number, { customerId: number; email: string; firstName: string; changes: WishlistChange[] }>();
  const updates: { cid: number; slug: string; price: number; sale: number; stock: number }[] = [];
  for (const x of r.rows as Row[]) {
    const price = Number(x.price) || 0;
    const sale = Number(x.on_sale) === 1 ? 1 : 0;
    const stock = Number(x.stock_qty) > 0 ? 1 : 0;
    const seenPrice = Number(x.seen_price) || 0;
    const seenSale = Number(x.seen_on_sale) || 0;
    const seenStock = Number(x.seen_in_stock) || 0;
    if (price === seenPrice && sale === seenSale && stock === seenStock) continue;
    updates.push({ cid: Number(x.customer_id), slug: String(x.product_slug), price, sale, stock });
    const reasons: WishlistChange["reasons"] = [];
    if (stock && !seenStock) reasons.push("stock");
    if (sale && !seenSale) reasons.push("sale");
    else if (seenPrice > 0 && price < seenPrice) reasons.push("price");
    // Only good news that can be acted on: in stock, visible, and the client wants these emails.
    if (!reasons.length || !stock || Number(x.visible) !== 1 || Number(x.verified) !== 1 || Number(x.wishlist_emails) !== 1) continue;
    const cid = Number(x.customer_id);
    if (!byCustomer.has(cid)) byCustomer.set(cid, { customerId: cid, email: String(x.email), firstName: String(x.first_name ?? ""), changes: [] });
    byCustomer.get(cid)!.changes.push({
      slug: String(x.product_slug), name: String(x.name), brand: String(x.brand ?? ""), image: x.image ? String(x.image) : null,
      price, oldPrice: seenPrice, regularPrice: Number(x.regular_price) || 0, reasons,
    });
  }
  for (const u of updates) {
    await libsql.execute({
      sql: "UPDATE wishlist SET seen_price = ?, seen_on_sale = ?, seen_in_stock = ? WHERE customer_id = ? AND product_slug = ?",
      args: [u.price, u.sale, u.stock, u.cid, u.slug],
    });
  }
  return [...byCustomer.values()];
}
