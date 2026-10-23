import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts, queryProducts, primaryCategories, dealProducts } from "@/lib/catalogue";
import { getBrandDirectory, type BrandInfo } from "@/lib/brand-registry";
import { brandPath, shopHref } from "@/lib/shop-url";
import { formatPrice } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { Bolt, Chevron, Shield, Truck } from "@/components/icons";
import { BRAND_CONTENT, type BrandCopy } from "@/data/brand-content";
import { hasBrandLogo, brandLogoPath } from "@/lib/brands";
import { WhatsAppGateButton } from "@/components/WhatsAppGate";
import { WhatsApp } from "@/components/icons";
import type { Product } from "@/lib/types";

// Brand landing pages at the old site's addresses: /brand/<brand-slug>/
// (e.g. /brand/landspider/). Logo, a write-up about the brand, and every
// product we have from it. The filterable listing stays at
// /product-category/<brand-slug>.
export const instant = false;

const PER_PAGE = 24;
const pagePath = (slug: string) => `/brand/${slug}/`;

/** A brand by its slug: one we stock, or one we know (write-up or logo) even
 *  when nothing is in stock right now — that page says so and offers to help,
 *  instead of "not found". */
async function findBrand(slug: string): Promise<BrandInfo | undefined> {
  const s = decodeURIComponent(slug).toLowerCase();
  if (s === "tyre-mall") return undefined;
  const known = (await getBrandDirectory()).find((b) => b.slug === s);
  if (known && (known.count > 0 || known.registered || BRAND_CONTENT[s] || known.logo)) return known;
  const copy = BRAND_CONTENT[s];
  if (!copy && !hasBrandLogo(s)) return undefined;
  const name = copy?.name ?? s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("-");
  return { name, slug: s, count: 0, logo: hasBrandLogo(s) ? brandLogoPath(s) : null, uploadedLogo: "", showInMenu: false, registered: false };
}

interface Stats {
  total: number; wheels: boolean; fromPrice: number | null;
  rims: number[]; categories: { slug: string; name: string; count: number }[]; pcds: string[];
}

function brandStats(products: Product[]): Stats {
  const wheels = products.length > 0 && products.every((p) => p.type === "wheel");
  const rims = [...new Set(products.map((p) => Number(String(p.specs.rim ?? "").replace(",", "."))).filter((n) => n >= 10 && n <= 26))].sort((a, b) => a - b);
  const prices = products.filter((p) => p.price > 0).map((p) => p.price);
  const categories = primaryCategories
    .map((c) => ({ slug: c.slug, name: c.name, count: products.filter((p) => p.categories.includes(c.slug)).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const pcds = [...new Set(products.flatMap((p) => String(p.specs.pcd ?? "").split("|")).map((s) => s.trim().toUpperCase()).filter(Boolean))].sort();
  return { total: products.length, wheels, fromPrice: prices.length ? Math.min(...prices) : null, rims, categories, pcds };
}

/** Write-up for a brand with no hand-written copy: built from what we stock. */
function fallbackCopy(name: string, s: Stats): BrandCopy {
  const what = s.wheels ? "mag wheels" : "tyres";
  const kinds = listJoin(s.categories.slice(0, 3).map((c) => c.name));
  const rimText = s.rims.length > 1 ? `${s.rims[0]}" to ${s.rims[s.rims.length - 1]}"` : s.rims.length ? `${s.rims[0]}"` : "";
  return {
    tagline: `Affordable ${name} ${what}, delivered across South Africa.`,
    about: s.total === 0 ? [
      `${name} ${what} aren't in stock at The Tyre Mall right now. Ask us and we'll check availability and pricing for your size, or have a look at the alternatives on this page.`,
    ] : [
      `${name} is a value ${s.wheels ? "wheel" : "tyre"} brand — a good option when you want new ${what} without paying premium-brand prices.`,
      `We currently stock ${s.total} ${name} ${s.total === 1 ? "product" : "products"}${kinds ? ` (${kinds})` : ""}${rimText ? ` in ${rimText} rim sizes` : ""}. Browse them on this page, or contact us if you're looking for a size you can't see.`,
    ],
  };
}

const listJoin = (a: string[]) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const b = await findBrand((await params).slug);
  if (!b) return { title: "Brand not found", robots: { index: false, follow: true } };
  const copy = BRAND_CONTENT[b.slug];
  const what = copy?.wheels ? "mag wheels" : "tyres";
  return {
    title: `${b.name} ${copy?.wheels ? "Mag Wheels" : "Tyres"} — Shop Online`,
    description: `Buy ${b.name} ${what} online at The Tyre Mall. ${copy?.tagline ?? ""} Free delivery on 2+ tyres and pay later with HappyPay.`.replace(/\s+/g, " ").trim(),
    alternates: { canonical: pagePath(b.slug) },
    openGraph: b.logo ? { images: [{ url: b.logo }] } : undefined,
  };
}

type SP = Record<string, string | string[] | undefined>;

export default async function BrandLandingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const b = await findBrand((await params).slug);
  if (!b) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);

  const all = (await getProducts()).filter((p) => p.brand.toLowerCase() === b.name.toLowerCase());
  const stats = brandStats(all);
  const copy = BRAND_CONTENT[b.slug] ?? fallbackCopy(b.name, stats);
  const wheels = copy.wheels ?? stats.wheels;
  const noun = wheels ? "Mag Wheels" : "Tyres";
  const result = await queryProducts({ brand: b.name, page, perPage: PER_PAGE });
  const listing = brandPath(b.name);
  const none = stats.total === 0;
  const alternatives = none ? (await dealProducts(40)).filter((p) => p.inStock && p.type === (wheels ? "wheel" : "tyre")).slice(0, 8) : [];
  const askUs = (
    <WhatsAppGateButton message={`Hi The Tyre Mall! I'm looking for ${b.name} ${noun.toLowerCase()}. Can you help?`}
      lead={{ source: "whatsapp-enquiry", productName: `${b.name} ${noun.toLowerCase()}` }} className="btn btn-volt h-12 px-6">
      <WhatsApp width={18} height={18} /> Ask us about {b.name}
    </WhatsAppGateButton>
  );
  const pageHref = (p: number) => (p === 1 ? pagePath(b.slug) : `${pagePath(b.slug)}?page=${p}`) + "#shop";

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${b.name} ${noun}`,
    url: `https://thetyremall.co.za${pagePath(b.slug)}`,
    about: { "@type": "Brand", name: b.name, ...(b.logo ? { logo: b.logo.startsWith("/") ? `https://thetyremall.co.za${b.logo}` : b.logo } : {}) },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://thetyremall.co.za/" },
        { "@type": "ListItem", position: 2, name: "Shop", item: "https://thetyremall.co.za/shop" },
        { "@type": "ListItem", position: 3, name: b.name, item: `https://thetyremall.co.za${pagePath(b.slug)}` },
      ],
    },
  };

  return (
    <div className="container-x py-6 lg:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <Link href="/shop" className="hover:text-volt">Shop</Link>
        <Chevron width={12} height={12} />
        <span className="text-fg">{b.name}</span>
      </nav>

      {/* hero */}
      <div className="mt-4 rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-ink-2 to-ink-2 p-6 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-28 w-full max-w-[260px] shrink-0 items-center justify-center rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:h-32">
            {b.logo ? (
              <Image src={b.logo} alt={`${b.name} logo`} width={240} height={110} priority unoptimized={!b.logo.startsWith("/brand/")} className="h-auto max-h-full w-auto max-w-full object-contain" />
            ) : (
              <span className="skew-italic text-center font-display text-3xl uppercase leading-none tracking-wide text-[#14171a]">{b.name}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="skew-italic font-display text-4xl leading-[0.95] sm:text-5xl">{b.name} {noun}</h1>
            <p className="mt-3 max-w-2xl text-base text-muted">{copy.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {none
                ? <span className="rounded-full border border-line bg-surface px-3 py-1 text-fg">Not in stock right now — ask us</span>
                : <span className="rounded-full bg-volt/15 px-3 py-1 text-volt ring-1 ring-volt/30">{stats.total.toLocaleString()} {stats.total === 1 ? "product" : "products"}</span>}
              {stats.rims.length > 0 && (
                <span className="rounded-full border border-line bg-surface px-3 py-1 text-fg">{stats.rims.length > 1 ? `${stats.rims[0]}" – ${stats.rims[stats.rims.length - 1]}" rims` : `${stats.rims[0]}" rims`}</span>
              )}
              {stats.fromPrice != null && <span className="rounded-full border border-line bg-surface px-3 py-1 text-fg">From {formatPrice(stats.fromPrice)}</span>}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {none ? (<>
                {askUs}
                <Link href={wheels ? "/product-category/mag-wheel" : "/product-category/tyres"} className="btn btn-ghost h-12 px-6">Shop all {noun.toLowerCase()}</Link>
              </>) : (<>
                <a href="#shop" className="btn btn-volt h-12 px-6">Shop {b.name} {noun.toLowerCase()}</a>
                <Link href={listing} className="btn btn-ghost h-12 px-6">Filter by size</Link>
              </>)}
            </div>
          </div>
        </div>
      </div>

      {/* perks */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Truck, t: wheels ? "Delivered to your door" : "Free delivery on 2+ tyres", s: "Delivered anywhere in South Africa" },
          { icon: Bolt, t: "Buy now, pay later", s: "2 interest-free payments with HappyPay" },
          { icon: Shield, t: "Brand new, genuine stock", s: `Genuine ${b.name} ${noun.toLowerCase()}` },
        ].map((f) => (
          <div key={f.t} className="card flex items-start gap-3 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt ring-1 ring-line"><f.icon width={22} height={22} /></span>
            <div><div className="font-display text-lg text-fg">{f.t}</div><div className="text-xs text-muted">{f.s}</div></div>
          </div>
        ))}
      </div>

      {/* quick links: by type and rim size */}
      {(stats.categories.length > 1 || stats.rims.length > 1) && (
        <div className="mt-6 card p-5">
          {stats.categories.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-muted">Shop by type</span>
              {stats.categories.map((c) => (
                <Link key={c.slug} href={shopHref(new URLSearchParams({ category: c.slug, brand: b.name }))}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-fg hover:border-volt/50 hover:text-volt">
                  {c.name} <span className="text-muted">({c.count})</span>
                </Link>
              ))}
            </div>
          )}
          {stats.rims.length > 1 && (
            <div className={`flex flex-wrap items-center gap-2 ${stats.categories.length > 1 ? "mt-3" : ""}`}>
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-muted">Shop by rim size</span>
              {stats.rims.map((r) => (
                <Link key={r} href={`${listing}?rim=${r}`}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-fg hover:border-volt/50 hover:text-volt">
                  {r}&quot;
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* nothing in stock: say so, offer help and alternatives */}
      {none && (
        <section id="shop" className="scroll-mt-40">
          <div className="mt-10 card p-6 sm:p-8">
            <h2 className="font-display text-3xl">No {b.name} {noun.toLowerCase()} in stock right now</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">Tell us your size and we&apos;ll check availability and pricing for you — or choose from the popular {noun.toLowerCase()} below, all in stock and ready to ship.</p>
            <div className="mt-5">{askUs}</div>
          </div>
          {alternatives.length > 0 && (
            <>
              <h2 className="mt-10 font-display text-3xl">Popular {noun.toLowerCase()} in stock</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {alternatives.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            </>
          )}
        </section>
      )}

      {/* products */}
      {!none && <section id="shop" className="scroll-mt-40">
        <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Shop {b.name} {noun.toLowerCase()}</h2>
          <Link href={listing} className="text-sm font-bold text-volt hover:underline">Filter by size, price &amp; more →</Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {result.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
        {result.pages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
            {page > 1 && <Link href={pageHref(page - 1)} className="btn btn-dark px-3">Prev</Link>}
            {pageWindow(page, result.pages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-2 text-muted">…</span>
              ) : (
                <Link key={p} href={pageHref(p)}
                  className={`grid size-10 place-items-center rounded-lg text-sm font-bold ${p === page ? "bg-volt text-volt-ink" : "border border-line bg-surface text-muted hover:text-fg"}`}>
                  {p}
                </Link>
              )
            )}
            {page < result.pages && <Link href={pageHref(page + 1)} className="btn btn-dark px-3">Next</Link>}
          </div>
        )}
      </section>}

      {/* about the brand */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-3xl text-volt">About {b.name}</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-fg/90">
            {copy.about.map((para, i) => <p key={i}>{para}</p>)}
          </div>
          {copy.ranges && copy.ranges.length > 0 && (
            <>
              <h3 className="mt-8 font-display text-2xl">{b.name} ranges at The Tyre Mall</h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {copy.ranges.map((r) => (
                  <li key={r.name} className="rounded-xl border border-line bg-surface p-4">
                    <div className="font-semibold text-fg">{r.name}</div>
                    <div className="mt-1 text-sm text-muted">{r.text}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <aside className="card h-fit p-6">
          <h2 className="font-display text-2xl">Why buy {b.name} from The Tyre Mall?</h2>
          <ul className="mt-4 space-y-3 text-sm text-fg">
            {!none && <li className="flex items-start gap-2"><span className="text-volt">✓</span> <span>{stats.total.toLocaleString()} {b.name} {stats.total === 1 ? "product" : "products"} to choose from{stats.categories.length ? `, including ${listJoin(stats.categories.slice(0, 3).map((c) => c.name))}` : ""}</span></li>}
            {!wheels && <li className="flex items-start gap-2"><span className="text-volt">✓</span> <span>Free delivery anywhere in South Africa when you buy 2 or more tyres</span></li>}
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> <span>Buy now, pay later in 2 interest-free payments with <Link href="/how-to-apply-for-credit-online/" className="font-semibold text-volt hover:underline">HappyPay</Link></span></li>
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> <span>Secure checkout with card or instant EFT through PayFast</span></li>
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> <span>Not sure of your size? <Link href="/vehicle-search" className="font-semibold text-volt hover:underline">Search by vehicle</Link> or <Link href="/contact-us/" className="font-semibold text-volt hover:underline">ask our team</Link></span></li>
          </ul>
          {wheels && stats.pcds.length > 0 && (
            <p className="mt-4 text-xs text-muted">Stud patterns (PCD) in stock: {stats.pcds.slice(0, 12).join(", ")}{stats.pcds.length > 12 ? "…" : ""}</p>
          )}
          {none
            ? <Link href="/vehicle-search" className="btn btn-volt mt-6 h-11 w-full">Find tyres for my vehicle</Link>
            : <Link href={listing} className="btn btn-volt mt-6 h-11 w-full">Find my {b.name} size</Link>}
        </aside>
      </section>
    </div>
  );
}

function pageWindow(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const range = (a: number, b: number) => { for (let i = a; i <= b; i++) out.push(i); };
  if (total <= 7) { range(1, total); return out; }
  out.push(1);
  if (current > 4) out.push("…");
  range(Math.max(2, current - 1), Math.min(total - 1, current + 1));
  if (current < total - 3) out.push("…");
  out.push(total);
  return out;
}
