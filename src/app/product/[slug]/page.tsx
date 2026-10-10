import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { getProduct, relatedProducts, dealProducts } from "@/lib/catalogue";
import { formatPrice, discountPct } from "@/lib/format";
import { ProductCustomiser } from "@/components/ProductCustomiser";
import { ProductRailCard } from "@/components/ProductCard";
import { YouMayLike } from "@/components/YouMayLike";
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
  const p = getProduct(slug);
  if (!p) return { title: "Product not found" };
  return { title: p.name, description: p.shortDescription };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();

  const pct = discountPct(p.regularPrice, p.salePrice);
  const brandSrc = brandLogoSrc(p.brand);
  const related = relatedProducts(p, 6);

  // "We think you'll like these" — 4 tyres, guaranteed one on sale
  let likePicks = relatedProducts(p, 16)
    .filter((r) => r.type === "tyre" && r.image && r.id !== p.id)
    .slice(0, 4);
  if (!likePicks.some((r) => r.onSale)) {
    const sale = dealProducts(60).find(
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
  const specs = [
    ["Brand", p.brand],
    ["Size", p.specs.size],
    ["Width", p.specs.width],
    ["Profile", p.specs.profile],
    ["Rim", p.specs.rim ? `${p.specs.rim}"` : undefined],
    ["SKU", p.sku],
  ].filter(([, v]) => v) as [string, string][];

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
          <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(75%_75%_at_50%_42%,#ffffff_0%,#f2f4f6_68%,#e7eaed_100%)] shadow-2xl shadow-black/50 ring-1 ring-black/5">
            <div className="relative aspect-square">
              {/* floating ground shadow */}
              <div className="float-shadow absolute bottom-10 left-1/2 h-5 w-3/5 rounded-[50%] bg-black/35 blur-xl" />
              {/* breathing tyre (transparent webp sits straight on the plate) */}
              {p.image && (
                <Image src={p.image} alt={p.name} fill priority sizes="(max-width:1024px) 100vw, 50vw" className="float-breathe object-contain p-10" />
              )}
              <div className="absolute left-3 top-3 flex flex-col gap-2">
                {p.onSale && pct > 0 && <span className="badge badge-sale text-sm">SAVE {pct}%</span>}
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

          <div className="mt-3 flex items-center gap-3">
            {p.inStock ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-pay"><Check width={15} height={15} /> In stock{p.stockQty ? ` · ${p.stockQty} available` : ""}</span>
            ) : (
              <span className="text-sm font-semibold text-sale">Out of stock</span>
            )}
            {p.reviews > 0 && (
              <span className="flex items-center gap-1 text-sm text-amber-400"><Star width={14} height={14} /> {p.rating} ({p.reviews})</span>
            )}
          </div>

          <div className="mt-4 flex items-end gap-4">
            {p.onSale && pct > 0 && <span className="text-lg text-faint line-through">{formatPrice(p.regularPrice)}</span>}
            <span className="font-display text-4xl text-fg">{formatPrice(p.price)}</span>
            <span className="ml-auto flex items-end" aria-label={`${p.brand} tyres`}>
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
              inStock={p.inStock}
              item={{ id: p.id, slug: p.slug, name: p.name, brand: p.brand, image: p.thumb ?? p.image, price: p.price, type: p.type }}
            />
          </div>

          {p.shortDescription && (
            <p className="mt-6 text-sm leading-relaxed text-muted">{p.shortDescription}</p>
          )}
        </div>
      </div>

      {/* details */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="font-display text-2xl">Description</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
            {p.description || p.shortDescription || "Full product details available on request."}
          </p>
        </div>
        <div>
          <h2 className="font-display text-2xl">Specs</h2>
          <dl className="mt-3 overflow-hidden rounded-xl border border-line">
            {specs.map(([k, v], i) => (
              <div key={k} className={`flex justify-between px-4 py-2.5 text-sm ${i % 2 ? "bg-surface" : "bg-ink-2"}`}>
                <dt className="text-muted">{k}</dt>
                <dd className="font-semibold text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl sm:text-3xl">You might also like</h2>
          <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-2">
            {related.map((r) => <ProductRailCard key={r.id} p={r} />)}
          </div>
        </section>
      )}
    </div>
  );
}
