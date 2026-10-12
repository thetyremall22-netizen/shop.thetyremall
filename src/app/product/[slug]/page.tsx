import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { getProduct, relatedProducts, dealProducts, similarTyres } from "@/lib/catalogue";
import { getLive } from "@/lib/db/queries";
import { vehiclesForSize } from "@/lib/vehicles";
import { formatPrice, discountPct } from "@/lib/format";
import { hasSetPricing, setPriceOf4 } from "@/lib/pricing";
import { parseTyreSpec, keyFeatures } from "@/lib/tyre-spec";
import { ProductCustomiser } from "@/components/ProductCustomiser";
import { ProductRailCard } from "@/components/ProductCard";
import { CompareToggle } from "@/components/CompareToggle";
import type { CompareItem } from "@/lib/compare";
import type { Product } from "@/lib/types";
import { YouMayLike } from "@/components/YouMayLike";
import { TyreSizeExplainer } from "@/components/TyreSizeExplainer";
import { OnPageCompare } from "@/components/OnPageCompare";
import { Chevron, Check, Truck, Shield, Bolt, Star } from "@/components/icons";

export const instant = false;

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
  // Render per-request (not a long-lived edge cache) so live stock/price and
  // new deploys show immediately on product pages.
  await connection();
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  // Live stock + price from our database (falls back to the snapshot).
  const live = await getLive(slug);
  const inStock = live ? live.inStock : p.inStock;
  const price = live ? live.price : p.price;
  const regularPrice = live ? live.regularPrice : p.regularPrice;
  const salePrice = live ? live.salePrice : p.salePrice;
  const onSale = live ? live.onSale : p.onSale;
  const lowStock = live?.lowStockRemaining ?? null;

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
            <Link href={`/shop?brand=${encodeURIComponent(p.brand)}`} className="text-sm font-bold uppercase tracking-wider text-volt">{p.brand}</Link>
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
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Per tyre</div>
                    <div className="font-display text-4xl leading-none text-fg">{formatPrice(price)}</div>
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
          <div className="no-scrollbar -mx-4 mt-3 flex gap-4 overflow-x-auto px-4 py-7">
            {(suggested.length > 0 ? suggested : related).map((r) => <ProductRailCard key={r.id} p={r} />)}
            <span className="w-1 shrink-0" aria-hidden />
          </div>
        </section>
      )}
    </div>
  );
}
