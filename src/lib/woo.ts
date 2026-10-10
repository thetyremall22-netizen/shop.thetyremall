import "server-only";
import type { Order } from "./orders";

const SITE = process.env.WOO_SITE_URL || "https://thetyremall.co.za";
const KEY = process.env.WOO_CONSUMER_KEY || "";
const SECRET = process.env.WOO_CONSUMER_SECRET || "";

/** True when write access (order creation / stock decrement) is configured. */
export function wooWriteConfigured(): boolean {
  return Boolean(KEY && SECRET);
}

export interface LiveInfo {
  id: number;
  inStock: boolean;
  lowStockRemaining: number | null;
  price: number; // minor units (cents)
  regularPrice: number;
  salePrice: number;
  onSale: boolean;
}

function mapLive(p: Record<string, unknown>): LiveInfo {
  const prices = (p.prices ?? {}) as Record<string, string>;
  const toInt = (v: string | undefined) => Math.round(Number(v ?? 0));
  return {
    id: Number(p.id),
    inStock: Boolean(p.is_in_stock),
    lowStockRemaining: (p.low_stock_remaining as number | null) ?? null,
    price: toInt(prices.price),
    regularPrice: toInt(prices.regular_price),
    salePrice: toInt(prices.sale_price) || toInt(prices.price),
    onSale: Boolean(p.on_sale),
  };
}

/** Live stock + price for one product, by slug. Cached ~60s for the storefront. */
export async function getLiveBySlug(slug: string, fresh = false): Promise<LiveInfo | null> {
  try {
    const res = await fetch(
      `${SITE}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`,
      fresh ? { cache: "no-store" } : { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const arr = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(arr) || !arr.length) return null;
    return mapLive(arr[0]);
  } catch {
    return null;
  }
}

/**
 * Create the order in WooCommerce after payment, so Woo decrements stock,
 * records the order in its admin and sends its own emails. Returns the Woo
 * order id, or null if write access isn't configured / the call failed.
 */
export async function createWooOrder(order: Order): Promise<number | null> {
  if (!wooWriteConfigured()) return null;
  try {
    // resolve each line to a live Woo product id (slugs are the stable key)
    const line_items: { product_id: number; quantity: number }[] = [];
    for (const it of order.items) {
      const live = await getLiveBySlug(it.slug, true);
      if (live?.id) line_items.push({ product_id: live.id, quantity: it.qty });
    }
    if (!line_items.length) return null;

    const a = order.delivery.address;
    const body = {
      payment_method: order.paymentMethod,
      payment_method_title: order.paymentMethod === "payfast" ? "PayFast" : order.paymentMethod,
      set_paid: true,
      status: "processing",
      billing: {
        first_name: order.customer.firstName,
        last_name: order.customer.lastName,
        email: order.customer.email,
        phone: order.customer.phone,
        address_1: a?.street ?? "",
        city: a?.city ?? "",
        state: a?.province ?? "",
        postcode: a?.postalCode ?? "",
        country: "ZA",
      },
      shipping: a
        ? {
            first_name: order.customer.firstName,
            last_name: order.customer.lastName,
            address_1: a.street,
            city: a.city,
            state: a.province,
            postcode: a.postalCode,
            country: "ZA",
          }
        : undefined,
      line_items,
      customer_note:
        order.delivery.method === "fitment"
          ? `Store fitment: ${order.delivery.fitmentStore ?? "partner centre"}${order.delivery.fitmentDate ? ` on ${order.delivery.fitmentDate}` : ""}`
          : "",
      meta_data: [
        { key: "ttm_reference", value: order.reference },
        { key: "ttm_payfast_id", value: order.pfPaymentId ?? "" },
      ],
    };

    const auth = Buffer.from(`${KEY}:${SECRET}`).toString("base64");
    const res = await fetch(`${SITE}/wp-json/wc/v3/orders`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[woo] create order failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const o = (await res.json()) as { id: number };
    return o.id;
  } catch (e) {
    console.error("[woo] create order error", e);
    return null;
  }
}
