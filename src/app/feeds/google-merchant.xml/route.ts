import { connection } from "next/server";
import { getProductsFresh } from "@/lib/catalogue";
import { SITE, merchantId, absUrl, googleCategory, merchantBrand, merchantDescription, feedProblem, zar } from "@/lib/merchant";

// Google Merchant Center product feed (RSS 2.0 + Google's g: fields).
// Merchant Center → Products → Add products → "Add from a file" → enter a link:
//   https://thetyremall.co.za/feeds/google-merchant.xml   (fetch daily)
// Built live from the database on every fetch, so prices and stock are always
// current. IDs match Google for WooCommerce's (gla_<id>) so history carries over.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
const tag = (k: string, v: string | undefined | null) => (v ? `<g:${k}>${esc(v)}</g:${k}>` : "");

const CATEGORY_NAMES: Record<string, string> = {
  "passenger-tyres": "Passenger Tyres", "suv-tyres": "SUV Tyres", "4x4-tyres": "4x4 Tyres", "uhp-tyres": "UHP Tyres",
  "commercial-tyres": "Commercial Tyres", "runflat-tyres": "Runflat Tyres", "truck-bus-tyres": "Truck & Bus Tyres",
  "bike-tyres": "Bike Tyres", "mag-wheel": "Mag Wheels",
};

export async function GET() {
  await connection();
  const products = await getProductsFresh();
  const items: string[] = [];
  for (const p of products) {
    if (feedProblem(p)) continue;
    const onSale = p.onSale && p.regularPrice > p.price;
    const type = p.categories.map((c) => CATEGORY_NAMES[c]).find(Boolean) ?? (p.type === "wheel" ? "Mag Wheels" : "Tyres");
    items.push(`<item>${[
      tag("id", merchantId(p)),
      tag("title", p.name.slice(0, 150)),
      tag("description", merchantDescription(p)),
      tag("link", `${SITE}/product/${p.slug}`),
      tag("image_link", absUrl(p.image!)),
      tag("availability", p.inStock ? "in_stock" : "out_of_stock"),
      tag("price", zar(onSale ? p.regularPrice : p.price)),
      onSale ? tag("sale_price", zar(p.price)) : "",
      tag("brand", merchantBrand(p)),
      p.sku ? tag("mpn", p.sku) : tag("identifier_exists", "no"),
      tag("condition", "new"),
      tag("google_product_category", googleCategory(p)),
      tag("product_type", `${p.type === "wheel" ? "Mag Wheels" : "Tyres"} > ${type}`),
      p.specs.size ? tag("size", p.specs.size) : "",
      tag("custom_label_0", merchantBrand(p)),
      tag("custom_label_1", type),
      p.specs.rim ? tag("custom_label_2", `${String(p.specs.rim).replace(/[^0-9.]/g, "")} inch`) : "",
      onSale ? tag("custom_label_3", "On sale") : "",
    ].join("")}</item>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>The Tyre Mall</title><link>${SITE}</link><description>Tyres and mag wheels from The Tyre Mall</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
