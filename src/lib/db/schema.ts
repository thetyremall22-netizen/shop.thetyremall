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
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

export type ProductRow = typeof products.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
