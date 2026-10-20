import Image from "next/image";
import { brandPath, shopHref } from "@/lib/shop-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { getProduct, getProducts, relatedProducts, dealProducts, similarTyres, crossFitment } from "@/lib/catalogue";
import { vehiclesForSize } from "@/lib/vehicles";
import { formatPrice, discountPct } from "@/lib/format";
import { hasSetPricing, setPriceOf4 } from "@/lib/pricing";
import { parseTyreSpec, keyFeatures } from "@/lib/tyre-spec";
import { ProductCustomiser } from "@/components/ProductCustomiser";
import { ProductRailCard } from "@/components/ProductCard";
import { DragScroll } from "@/components/DragScroll";
import { CompareToggle } from "@/components/CompareToggle";
import { WishlistButton } from "@/components/WishlistButton";
import type { CompareItem } from "@/lib/compare";
import type { Product } from "@/lib/types";
import { YouMayLike } from "@/components/YouMayLike";
import { TyreSizeExplainer } from "@/components/TyreSizeExplainer";
import { OnPageCompare } from "@/components/OnPageCompare";
import { Chevron, Check, Truck, Shield, Bolt, Star } from "@/components/icons";

export const instant = false;

// Require the whole product route to be static: it is prerendered to HTML at
// build time (one file per product) and served straight off disk, instead of
// running a fresh server render on every request. This is what lets a single
// shared-host worker absorb a full Googlebot crawl of thousands of product
// URLs — each hit is a cheap file read, not a render. `next build` will FAIL
// loudly if anything in this route reads request-time data (so a regression
// can't silently turn it dynamic again). Stock/price stay fresh because the
// catalogue is cached by PRODUCTS_TAG and revalidated on every edit/order.
export const ensureStatic = "navigation";

const LOW_STOCK_THRESHOLD = 4;

// Prerender a SEED of the most-visited product pages at build; every other
// product page is generated on its first request and then cached to disk
// (ISR / `dynamicParams` defaults to true). We don't prerender all ~4,500 at
// build because:
//   • a single render is fast, and on the running server the catalogue is
//     loaded ONCE and shared across all requests, so on-demand first-hits are
//     cheap (a crawl renders each URL once, then serves it static);
//   • on-demand pages render against the LIVE database on the server, so prices
//     and stock are correct — not frozen to the build-time snapshot;
//   • it keeps `next build` fast instead of spawning many workers that each
//     parse the 11 MB catalogue + 4 MB vehicle data and thrash memory.
// Seed = in-stock products that have an image (the ones actually linked from
// the storefront), capped so the build stays quick AND stays under V8's ~512 MB
// max string length: prerendering too many pages at once overflows the build's
// final serialization step (~400 product pages is the cliff → "RangeError:
// Invalid string length"). 150 pre-warms the popular pages with comfortable
// headroom; every other product page is generated on-demand at runtime (which
// serializes one page at a time and never hits that aggregate limit).
const SEED_LIMIT = Number(process.env.TTM_SEED_LIMIT ?? 24);
export async function generateStaticParams() {
  const all = await getProducts();
  return all
    .filter((p) => p.inStock && p.image)
    .slice(0, SEED_LIMIT)
    .map((p) => ({ slug: p.slug }));
}

/** Use a real white/transparent brand logo from /public/brand/logos/<slug>.(svg|png|webp) when present. */
function brandLogoSrc(brand: string): string | null {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  for (const ext of ["svg", "png", "webp"]) {
    const rel = `brand/logos/${slug}.${ext}`;
    if (existsSync(join(process.cwd(), "public", rel))) return "/" + rel;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: "Product not found" };
  return { title: p.name, description: p.shortDescription };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  // Stock + price come from the cached catalogue (PRODUCTS_TAG) — refreshed the
  // moment a product is edited or an order changes stock — so the page needs no
  // per-request DB read and can be served as static HTML.
  const { inStock, price, regularPrice, salePrice, onSale } = p;
  const lowStock = inStock && p.stockQty != null && p.stockQty > 0 && p.stockQty <= LOW_STOCK_THRESHOLD ? p.stockQty : null;

  const pct = discountPct(regularPrice, salePrice);
  const brandSrc = brandLogoSrc(p.brand);
  const related = await relatedProducts(p, 6);

  const compareItem: CompareItem = {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, type: p.type,
    price, regularPrice, salePrice, onSale,
    image: p.image, specs: p.specs, categories: p.categories, inStock, sku: p.sku,
  };
  // live-priced copy of this product for the on-page comparison strip
  const selfProduct: Product = { ...p, price, regularPrice, salePrice, onSale, inStock };

  // "We think you'll like these" — 4 tyres, guaranteed one on sale
  let likePicks = (await relatedProducts(p, 16))
    .filter((r) => r.type === "tyre" && r.image && r.id !== p.id)
    .slice(0, 4);
  if (!likePicks.some((r) => r.onSale)) {
    const sale = (await dealProducts(60)).find(
      (d) => d.type === "tyre" && d.image && d.id !== p.id && !likePicks.some((x) => x.id === d.id)
    );
    if (sale) likePicks = [sale, ...likePicks].slice(0, 4);
  }
  const likeItems = likePicks.map((r) => ({
    slug: r.slug,
    name: r.name,
    brand: r.brand,
    image: r.thumb ?? r.image,
    price: r.price,
    regularPrice: r.regularPrice,
    size: r.specs.size,
    onSale: r.onSale,
  }));
  const isTyre = p.type === "tyre";
  const tyreSpec = parseTyreSpec(p);
  const features = isTyre ? keyFeatures(p, tyreSpec) : [];
  const fits = isTyre && tyreSpec.size ? vehiclesForSize(tyreSpec.size, 12) : [];
  const suggested = isTyre ? await similarTyres(p, 8) : [];
  // Cross-sell the opposite category by rim diameter (tyres ↔ mag wheels).
  const cross = await crossFitment(p, 10);
  const crossRim = (p.specs.rim || "").replace(/[^0-9.]/g, "");

  const kmh = (v?: string) => (v === "240+" ? "240+" : v);
  const specs = (
    isTyre
      ? [
          ["Brand", p.brand],
          tyreSpec.pattern ? ["Pattern", tyreSpec.pattern] : null,
          ["Size", tyreSpec.size ?? ""],
          ["Range", tyreSpec.range],
          tyreSpec.loadIndex
            ? ["Load index", tyreSpec.loadKg ? `${tyreSpec.loadIndex} · ${tyreSpec.loadKg} kg` : tyreSpec.loadIndex]
            : null,
          tyreSpec.speed
            ? ["Speed rating", tyreSpec.speedKmh ? `${tyreSpec.speed} · ${kmh(tyreSpec.speedKmh)} km/h` : tyreSpec.speed]
            : null,
          ["Run-flat", tyreSpec.runFlat ? "Yes" : "No"],
          ["Extra load", tyreSpec.extraLoad ? "Yes" : "No"],
          p.sku ? ["SKU", p.sku] : null,
        ]
      : [
          ["Brand", p.brand],
          p.specs.size ? ["Size", p.specs.size] : null,
          p.specs.rim ? ["Rim", `${p.specs.rim}"`] : null,
          p.specs.width ? ["Width", p.specs.width] : null,
          p.specs.pcd ? ["PCD", p.specs.pcd] : null,
          p.sku ? ["SKU", p.sku] : null,
        ]
  ).filter(Boolean) as [string, string][];

  return (
    <div className="container-x py-6 lg:py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <Link href="/shop" className="hover:text-volt">Shop</Link>
        <Chevron width={12} height={12} />
        <span className="line-clamp-1 text-fg">{p.name}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-2">
        {/* gallery */}
        <div className="lg:sticky lg:top-40 lg:h-fit">
          <div className="relative w-full overflow-hidden rounded-3xl bg-[radial-gradient(75%_75%_at_50%_42%,#ffffff_0%,#f2f4f6_68%,#e7eaed_100%)] shadow-2xl shadow-black/50 ring-1 ring-black/5">
            <div className="relative aspect-[3/2]">
              {/* floating ground shadow */}
              <div className="float-shadow absolute bottom-10 left-1/2 h-5 w-3/5 rounded-[50%] bg-black/35 blur-xl" />
              {/* breathing tyre (transparent webp sits straight on the plate) */}
              {p.image && (
                <Image src={p.image} alt={p.name} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="float-breathe object-contain p-7" />
              )}
              <div className="absolute left-3 top-3 flex flex-col gap-2">
                {onSale && pct > 0 && <span className="badge badge-sale text-sm">SAVE {pct}%</span>}
                {p.type === "wheel" && <span className="badge badge-volt">MAG WHEEL</span>}
              </div>
            </div>
          </div>
          {/* trust row */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: Truck, t: "Free delivery", s: "on 2+ tyres" },
              { icon: Bolt, t: "Pay later", s: "0% interest" },
              { icon: Shield, t: "Road hazard", s: "optional cover" },
            ].map((f) => (
              <div key={f.t} className="card flex flex-col items-center p-3">
                <f.icon width={20} height={20} className="text-volt" />
                <span className="mt-1.5 text-xs font-bold text-fg">{f.t}</span>
                <span className="text-[10px] text-muted">{f.s}</span>
              </div>
            ))}
          </div>

          {/* delayed recommendations */}
          <YouMayLike items={likeItems} />
        </div>

        {/* buy box */}
        <div>
          <div className="flex items-center gap-2">
            <Link href={brandPath(p.brand)} className="text-sm font-bold uppercase tracking-wider text-volt">{p.brand}</Link>
            {p.specs.size && <span className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{p.specs.size}</span>}
          </div>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{p.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {inStock ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-pay">
                <Check width={15} height={15} /> In stock{lowStock ? ` · only ${lowStock} left` : ""}
              </span>
            ) : (
              <span className="text-sm font-semibold text-sale">Out of stock</span>
            )}
            {p.reviews > 0 && (
              <span className="flex items-center gap-1 text-sm text-amber-400"><Star width={14} height={14} /> {p.rating} ({p.reviews})</span>
            )}
            <CompareToggle item={compareItem} dark labelAdd="Add to compare" className="text-sm" />
            <WishlistButton slug={p.slug} variant="text" className="text-sm" />
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              {onSale && pct > 0 && (
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-lg text-faint line-through">{formatPrice(regularPrice)}</span>
                  <span className="rounded-full bg-sale/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-sale">🔥 On sale!</span>
                </div>
              )}
              {hasSetPricing(p.type) ? (
                <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                  <div className="px-0.5 py-2">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Per tyre</div>
                    <div className="font-display text-3xl leading-none text-fg">{formatPrice(price)}</div>
                  </div>
                  <div className="rounded-xl bg-volt/10 px-3.5 py-2 ring-1 ring-volt/30">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-volt">Set of 4</div>
                    <div className="font-display text-3xl leading-none text-volt">{formatPrice(setPriceOf4(price))}</div>
                  </div>
                </div>
              ) : (
                <div className="font-display text-4xl text-fg">{formatPrice(price)}</div>
              )}
            </div>
            <span className="flex shrink-0 items-end" aria-label={`${p.brand} tyres`}>
              {brandSrc ? (
                <span className="mb-0.5 inline-flex items-center rounded-lg bg-white px-3 py-2 shadow-lg shadow-black/20 ring-1 ring-black/10">
                  <Image src={brandSrc} alt={`${p.brand} logo`} width={430} height={124} className="h-6 w-auto object-contain sm:h-7" />
                </span>
              ) : (
                <span className="font-display text-2xl uppercase tracking-[0.12em] text-fg/85">{p.brand}</span>
              )}
            </span>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <ProductCustomiser
              inStock={inStock}
              sku={p.sku}
              size={p.specs.size}
              item={{ id: p.id, slug: p.slug, name: p.name, brand: p.brand, image: p.thumb ?? p.image, price: price, type: p.type }}
            />
          </div>

          {p.shortDescription && (
            <p className="mt-6 text-sm leading-relaxed text-muted">{p.shortDescription}</p>
          )}
        </div>
      </div>

      {/* details */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {features.length > 0 && (
            <>
              <h2 className="font-display text-2xl">Key features</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted">
                    <Check width={16} height={16} className="mt-0.5 shrink-0 text-volt" /> {f}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="mt-8 font-display text-2xl">Description</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
            {p.description || p.shortDescription || "Full product details available on request."}
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl">Specifications</h2>
          <dl className="mt-3 overflow-hidden rounded-xl border border-line">
            {specs.map(([k, v], i) => (
              <div key={k} className={`flex justify-between gap-3 px-4 py-2.5 text-sm ${i % 2 ? "bg-surface" : "bg-ink-2"}`}>
                <dt className="shrink-0 text-muted">{k}</dt>
                <dd className="text-right font-semibold text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* how to read this size (tyres) */}
      {isTyre && <TyreSizeExplainer spec={tyreSpec} />}

      {/* fits these vehicles (tyres) */}
      {fits.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl sm:text-3xl">
            Fits these vehicles <span className="text-base font-normal text-muted">factory size match</span>
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {fits.map((v) => (
              <span key={`${v.make}-${v.model}`} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
                <span className="font-semibold text-fg">{v.make} {v.model}</span>
                {v.years && <span className="ml-1.5 text-xs text-muted">{v.years}</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            Always confirm against your vehicle&apos;s door-jamb placard — alternative fitments may also apply.
          </p>
        </section>
      )}

      {/* cross-fitment: tyres ↔ mag wheels that share the same rim diameter */}
      {cross.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl">
                {isTyre ? "Mag wheels that fit" : "Tyres for these wheels"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {crossRim
                  ? isTyre
                    ? `${crossRim}" mags that take this rim size — complete the look.`
                    : `${crossRim}" tyres to match — grab a set and roll.`
                  : isTyre
                    ? "Mags that take this rim size — complete the look."
                    : "Matching tyres — grab a set and roll."}
              </p>
            </div>
            <Link
              href={shopHref(new URLSearchParams(crossRim ? { type: isTyre ? "wheel" : "tyre", rim: crossRim } : { type: isTyre ? "wheel" : "tyre" }))}
              className="btn btn-ghost shrink-0"
            >
              View all
            </Link>
          </div>
          <DragScroll className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 py-6 [&>a]:snap-start">
            {cross.map((r) => <ProductRailCard key={r.id} p={r} />)}
            <span className="w-1 shrink-0" aria-hidden />
          </DragScroll>
        </section>
      )}

      {/* on-page comparison strip — this product vs alternatives */}
      <OnPageCompare
        items={[selfProduct, ...(isTyre ? suggested : related.filter((r) => r.type === "wheel")).filter((r) => r.id !== p.id)].slice(0, 4)}
        isTyre={isTyre}
        currentId={p.id}
      />

      {/* suggested tyres from other brands (item 9) / related */}
      {(suggested.length > 0 ? suggested : related).length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl sm:text-3xl">
            {suggested.length > 0 ? "Suggested tyres — other brands" : "You might also like"}
          </h2>
          {suggested.length > 0 && tyreSpec.size && (
            <p className="mt-1 text-sm text-muted">Same {tyreSpec.size} size, different brands &amp; price points.</p>
          )}
          <DragScroll className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 py-6 [&>a]:snap-start">
            {(suggested.length > 0 ? suggested : related).map((r) => <ProductRailCard key={r.id} p={r} />)}
            <span className="w-1 shrink-0" aria-hidden />
          </DragScroll>
        </section>
      )}
    </div>
  );
}
