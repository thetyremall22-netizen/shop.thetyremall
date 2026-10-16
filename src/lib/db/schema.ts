import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull().default(""),
  type: text("type").notNull().default("tyre"),
  sku: text("sku").notNull().default(""),
  price: integer("price").notNull().default(0),
  regularPrice: integer("regular_price").notNull().default(0),
  salePrice: integer("sale_price").notNull().default(0),
  onSale: integer("on_sale", { mode: "boolean" }).notNull().default(false),
  stockQty: integer("stock_qty").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(4),
  image: text("image"),
  categories: text("categories").notNull().default("[]"), // json
  specs: text("specs").notNull().default("{}"), // json
  shortDescription: text("short_description").notNull().default(""),
  description: text("description").notNull().default(""),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: text("order_id").notNull().unique(),
  reference: text("reference").notNull(),
  status: text("status").notNull().default("pending"),
  customer: text("customer").notNull().default("{}"), // json
  delivery: text("delivery").notNull().default("{}"), // json
  items: text("items").notNull().default("[]"), // json
  totals: text("totals").notNull().default("{}"), // json
  paymentMethod: text("payment_method").notNull().default(""),
  pfPaymentId: text("pf_payment_id"),
  // true for PayFast-sandbox / test orders, so they can be labelled and
  // filtered apart from real paid orders in the admin.
  test: integer("test", { mode: "boolean" }).notNull().default(false),
  refunded: integer("refunded").notNull().default(0), // cumulative refunded (cents)
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

// Log of every outbound email the site sends (order lifecycle, enquiries,
// abandoned-cart) so staff can review, resend, or edit-and-resend them.
export const emails = sqliteTable("emails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  toAddr: text("to_addr").notNull().default(""),
  cc: text("cc").notNull().default("[]"), // json array
  subject: text("subject").notNull().default(""),
  html: text("html").notNull().default(""),
  type: text("type").notNull().default("custom"),
  orderRef: text("order_ref"),
  status: text("status").notNull().default("sent"), // sent | failed | skipped
  provider: text("provider").notNull().default(""), // resend | smtp | none
  error: text("error"),
  resend: integer("resend", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(0),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

// Backend-controlled site settings (singletons), one JSON doc per group key
// (site, contact, social, commerce …). Edited in /admin/settings; read by the
// storefront so contact/commerce content isn't hardcoded.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default("{}"), // json
  updatedAt: integer("updated_at").notNull().default(0),
});

export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type EmailRow = typeof emails.$inferSelect;
