import { NextRequest, NextResponse } from "next/server";
import { getProducts, searchProducts, queryProducts, dealProducts } from "@/lib/catalogue";
import { findVehicle } from "@/lib/vehicles";
import { discountPct } from "@/lib/format";
import type { Product } from "@/lib/types";

// Vehicle / use-case words → category slug
const VEHICLE: { words: string[]; cat: string; label: string }[] = [
  { words: ["suv", "crossover", "x-trail", "fortuner", "x5", "q5"], cat: "suv-tyres", label: "your SUV" },
  { words: ["bakkie", "4x4", "4×4", "jeep", "off-road", "offroad", "overland", "ranger", "hilux", "d-max", "land cruiser", "landcruiser", "amarok", "wildtrak"], cat: "4x4-tyres", label: "your bakkie / 4×4" },
  { words: ["hatchback", "hatch", "sedan", "passenger", "polo", "golf", "corolla", "city car", "family car"], cat: "passenger-tyres", label: "your car" },
  { words: ["performance", "sports car", "sport", "uhp", "gti", "amg", "m3", "fast"], cat: "uhp-tyres", label: "your performance car" },
  { words: ["van", "panel van", "commercial", "courier", "delivery"], cat: "commercial-tyres", label: "your van" },
  { words: ["truck", "lorry", "bus", "fleet"], cat: "truck-bus-tyres", label: "your truck / bus" },
  { words: ["bike", "motorbike", "motorcycle", "scooter"], cat: "bike-tyres", label: "your bike" },
  { words: ["mag", "mags", "wheel", "wheels", "rim", "rims"], cat: "__wheel", label: "your ride" },
];

function sizePattern(msg: string): string | null {
  // 265/60R18, 265/60 R18, 265-60-18, 265/60/18
  const m = msg.match(/(\d{3})\s*[\/x]\s*(\d{2})\s*[\/\s-]?\s*r?\s*(\d{2})/i);
  if (!m) return null;
  return `${m[1]}/${m[2]}R${m[3]}`;
}

function map(p: Product) {
  return {
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    price: p.price,
    regularPrice: p.regularPrice,
    onSale: p.onSale,
    pct: discountPct(p.regularPrice, p.salePrice),
    thumb: p.thumb ?? p.image,
    size: p.specs.size ?? "",
    type: p.type,
  };
}

/** On-sale first, then in-stock, so deals surface for the extra sales nudge. */
function rank(a: Product, b: Product) {
  if (a.onSale !== b.onSale) return a.onSale ? -1 : 1;
  if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
  return 0;
}

export async function GET(req: NextRequest) {
  const msg = (req.nextUrl.searchParams.get("msg") ?? "").toLowerCase();
  if (!msg.trim()) return NextResponse.json({ products: [] });

  const allProducts = await getProducts();
  const brands = [...new Set(allProducts.map((p) => p.brand))];
  const brandHit = brands.find((b) => b && msg.includes(b.toLowerCase()));
  const size = sizePattern(msg);
  const vehicle = VEHICLE.find((v) => v.words.some((w) => msg.includes(w)));
  const wantsDeals = /\b(deal|deals|sale|cheap|cheapest|special|discount|budget|affordable)\b/.test(msg);

  let picks: Product[] = [];
  let label = "";
  let note = "";

  const vehicleFit = !size ? findVehicle(msg) : null;

  if (size) {
    picks = (await searchProducts(size, 30)).filter((p) => (p.specs.size ?? "").toUpperCase().includes(size.toUpperCase()));
    if (!picks.length) picks = await searchProducts(size, 12);
    label = `Here's what I found in ${size}`;
  } else if (vehicleFit && vehicleFit.tyres.length) {
    const oe = vehicleFit.tyres[0].replace(/\s+/g, "").toUpperCase(); // 195/45R16
    picks = (await searchProducts(oe, 30)).filter((p) => (p.specs.size ?? "").toUpperCase().replace(/\s+/g, "").includes(oe));
    if (!picks.length) picks = await searchProducts(oe, 12);
    label = `For your ${vehicleFit.make} ${vehicleFit.model}${vehicleFit.label ? ` (${vehicleFit.label})` : ""}, the fitment is ${vehicleFit.tyres.join(" or ")}`;
    if (vehicleFit.rims.length) note = `Rim ${vehicleFit.rims.join(" / ")}${vehicleFit.pcd ? ` · PCD ${vehicleFit.pcd.replace(/\*/g, "×")}` : ""}`;
  } else if (brandHit) {
    const r = await queryProducts({ brand: brandHit, onSale: wantsDeals || undefined, perPage: 24 });
    picks = r.items;
    label = `Some great ${brandHit} tyres`;
  } else if (vehicle) {
    if (vehicle.cat === "__wheel") {
      picks = allProducts.filter((p) => p.type === "wheel");
      label = "Here are some mag wheels to turn heads";
    } else {
      const r = await queryProducts({ category: vehicle.cat, onSale: wantsDeals || undefined, perPage: 40 });
      picks = r.items;
      label = `Great picks for ${vehicle.label}`;
    }
  } else if (wantsDeals) {
    picks = await dealProducts(20);
    label = "🔥 Here are some hot deals right now";
  } else {
    return NextResponse.json({ products: [] }); // not a product query
  }

  picks = picks.filter((p) => p.image).sort(rank).slice(0, 4);
  const onSaleCount = picks.filter((p) => p.onSale).length;
  if (onSaleCount > 0) {
    const sn = `${onSaleCount === picks.length ? "they're all" : `${onSaleCount} of these are`} on sale right now 🔥`;
    note = note ? `${note} · ${sn}` : sn.charAt(0).toUpperCase() + sn.slice(1);
  }

  return NextResponse.json({
    label,
    note,
    size,
    products: picks.map(map),
  });
}
