import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { formatPrice, formatPriceShort, discountPct } from "@/lib/format";
import { hasSetPricing, setPriceOf4 } from "@/lib/pricing";
import { CompareToggle } from "./CompareToggle";
import type { CompareItem } from "@/lib/compare";
import { Star, Arrow } from "./icons";

function toCompareItem(p: Product): CompareItem {
  return {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, type: p.type,
    price: p.price, regularPrice: p.regularPrice, salePrice: p.salePrice, onSale: p.onSale,
    image: p.image, specs: p.specs, categories: p.categories, inStock: p.inStock, sku: p.sku,
  };
}

// Brands we have a real logo image for.
const LOGO_BRANDS = new Set([
  "bridgestone", "pirelli", "goodyear", "dunlop", "radar", "michelin", "continental",
  "landsail", "windforce", "tracmax", "bfgoodrich", "firestone", "sumitomo", "general",
  "sava", "yokohama", "kapsen", "timax", "anchee", "roadking",
]);
const brandSlug = (b: string) => b.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const brandLogoSrc = (b: string) => {
  const s = brandSlug(b);
  return s === "radar" ? "/brand/logos/radar.png" : `/brand/logos/${s}.webp`;
};
function BrandMark({ brand }: { brand: string }) {
  if (LOGO_BRANDS.has(brandSlug(brand))) {
    return <Image src={brandLogoSrc(brand)} alt={brand} width={120} height={32} className="h-6 w-auto max-w-[70%] object-contain" />;
  }
  return <span className="font-display text-base uppercase tracking-wider text-[#14171a]/75">{brand}</span>;
}

export function ProductCard({ p }: { p: Product }) {
  const pct = discountPct(p.regularPrice, p.salePrice);
  const payLater = formatPriceShort(Math.round(p.price / 2));

  return (
    <div
      className="glow-hover group flex flex-col overflow-hidden rounded-[14px] bg-white text-[#14171a] shadow-lg shadow-black/20 ring-1 ring-black/5"
    >
      <Link href={`/product/${p.slug}`} className="relative block">
        <div className="relative aspect-square overflow-hidden bg-white">
          {p.image ? (
            <Image
              src={p.image}
              alt={p.name}
              fill
              sizes="(max-width:768px) 50vw, 25vw"
              className="object-contain p-4 transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-neutral-400">No image</div>
          )}
          <div className="absolute left-2 top-2 flex flex-col gap-1.5">
            {p.onSale && pct > 0 && <span className="badge badge-sale">-{pct}%</span>}
            {p.type === "wheel" && <span className="badge badge-volt">MAG</span>}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col border-t border-black/5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4f7000]">{p.brand}</span>
          {p.specs.size && <span className="text-[11px] font-semibold text-[#5c646d]">{p.specs.size}</span>}
        </div>

        <Link href={`/product/${p.slug}`} className="mt-1 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-[#14171a] transition-colors group-hover:text-[#4f7000]">
            {p.name}
          </h3>
        </Link>

        {p.reviews > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-amber-500">
            <Star width={12} height={12} />
            <span className="text-[11px] text-[#5c646d]">
              {p.rating} ({p.reviews})
            </span>
          </div>
        )}

        {hasSetPricing(p.type) ? (
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#8a929c]">Per tyre</div>
              {p.onSale && pct > 0 && (
                <div className="text-[11px] leading-none text-neutral-400 line-through">{formatPrice(p.regularPrice)}</div>
              )}
              <div className="font-display text-lg leading-tight text-[#14171a]">{formatPrice(p.price)}</div>
            </div>
            <div className="shrink-0 self-stretch rounded-lg bg-[#eef6e0] px-2.5 py-1.5 text-left ring-1 ring-[#8ac53f]/40 sm:self-auto sm:text-right">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#4f7000]">Set of 4</span>
              <div className="price-set font-display text-xl leading-tight">{formatPrice(setPriceOf4(p.price))}</div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5">
            {p.onSale && pct > 0 && (
              <div className="text-xs text-neutral-400 line-through">{formatPrice(p.regularPrice)}</div>
            )}
            <div className="font-display text-xl text-[#14171a]">{formatPrice(p.price)}</div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`text-[11px] font-bold ${p.inStock ? "text-pay-ink" : "text-sale"}`}>
            {p.inStock ? "In stock" : "Out of stock"}
          </span>
          <CompareToggle item={toCompareItem(p)} className="text-[11px]" />
        </div>
        {p.onSale && pct > 0 && (
          <div className="mt-1.5 inline-flex items-center gap-1 self-start rounded-full bg-sale/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-sale">
            🔥 On sale — save {pct}%
          </div>
        )}

        <div className="mt-2 rounded-md bg-[#FFD400] px-2 py-1.5 text-black">
          <div className="text-[13px] font-black leading-none">
            2× {payLater}<span className="font-extrabold"> · 0% interest</span>
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase leading-none tracking-wide">
            HappyPay — no upfront · pay over 2 months
          </div>
        </div>

        <Link href={`/product/${p.slug}`} className="btn btn-volt mt-3 w-full">
          View product <Arrow width={15} height={15} />
        </Link>
      </div>

      {/* brand logo */}
      <div className="flex items-center justify-center border-t border-black/5 bg-neutral-50 py-2.5">
        <BrandMark brand={p.brand} />
      </div>
    </div>
  );
}

/** Compact card for horizontal rails. */
export function ProductRailCard({ p }: { p: Product }) {
  const pct = discountPct(p.regularPrice, p.salePrice);
  return (
    <Link
      href={`/product/${p.slug}`}
      className="glow-hover-tight group flex w-44 shrink-0 flex-col overflow-hidden rounded-[14px] bg-white text-[#14171a] shadow-lg shadow-black/20 ring-1 ring-black/5"
    >
      <div className="relative aspect-square w-full bg-white">
        {p.image && (
          <Image src={p.image} alt={p.name} fill sizes="176px" className="object-contain p-3 transition-transform duration-500 group-hover:scale-105" />
        )}
        {p.onSale && pct > 0 && <span className="badge badge-sale absolute left-2 top-2">-{pct}%</span>}
        {p.type === "wheel" && <span className="badge badge-volt absolute right-2 top-2">MAG</span>}
      </div>
      <div className="border-t border-black/5 p-2.5">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#4f7000]">{p.brand}</div>
        <div className="line-clamp-2 text-xs font-medium leading-snug text-[#14171a]">{p.name}</div>
        <div className="mt-1.5 font-display text-base text-[#14171a]">{formatPrice(p.price)}</div>
      </div>
    </Link>
  );
}
