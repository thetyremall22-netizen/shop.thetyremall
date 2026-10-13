import Image from "next/image";
import Link from "next/link";
import {
  meta,
  bestSellers,
  dealProducts,
  wheelProducts,
} from "@/lib/catalogue";
import { ProductCard, ProductRailCard } from "@/components/ProductCard";
import { TyreWheelSearch } from "@/components/TyreWheelSearch";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { AnimatedRating } from "@/components/AnimatedRating";
import { RotatingReviews } from "@/components/RotatingReviews";
import { AboutTeam } from "@/components/AboutTeam";
import { BrandTile } from "@/components/BrandTile";
import { BRANDS } from "@/lib/brands";
import { Arrow } from "@/components/icons";
import { HappyPayLogo } from "@/components/HappyPayLogo";
import { PromoBanner } from "@/components/PromoBanner";
import { DragScroll } from "@/components/DragScroll";


export default async function Home() {
  const [sellers, deals, mags] = await Promise.all([bestSellers(10), dealProducts(8), wheelProducts(10)]);

  return (
    <>
      <Hero />

      {/* ============ DUAL SEARCH ============ */}
      <section className="container-x relative z-10 -mt-4 py-8">
        <Reveal>
          <TyreWheelSearch
            widths={meta.widths}
            profiles={meta.profiles}
            rims={meta.rims}
            wheelRims={meta.wheelRims}
            wheelWidths={meta.wheelWidths}
            pcds={meta.pcds}
            tyreBrands={meta.brands.map((b) => b.name)}
            wheelBrands={meta.wheelBrands}
          />
        </Reveal>
      </section>

      {/* ============ PROMO BANNER (monthly sale) ============ */}
      <section className="container-x pb-10">
        <Reveal variant="zoom">
          <PromoBanner
            src="/promo/radar-renegade-outdoorfest.webp"
            href="/shop?q=Renegade"
            alt="Radar Renegade Outdoor Fest — buy a set of 4 Renegades and stand a chance to win a braai. 4 weeks, 4 winners."
          />
        </Reveal>
      </section>

      {/* ============ FEATURE TILES ============ */}
      <section className="container-x grid gap-4 pb-10 sm:grid-cols-2">
        <Reveal variant="left">
          <FeatureTile title="TYRES" tags={["Passenger", "SUV & 4×4", "Light Truck", "Truck & Bus"]} href="/shop?type=tyre" cta="Shop Tyres" image="/brand/tile-tyres.webp" />
        </Reveal>
        <Reveal variant="zoom" delay={80}>
          <FeatureTile title="WHEELS" tags={["Alloy", "Steel", "Off-Road", "OEM Fitment"]} href="/shop?type=wheel" cta="Shop Wheels" image="/brand/tile-wheels.webp" />
        </Reveal>
      </section>

      {/* ============ SOCIAL PROOF (moved up) ============ */}
      <section className="container-x py-12">
        <Reveal>
          <SectionHead eyebrow="4.8★ loved across Mzansi" silver="HAPPY" green="CUSTOMERS" />
        </Reveal>
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          <Reveal variant="left"><AnimatedRating /></Reveal>
          <RotatingReviews />
        </div>
      </section>

      {/* ============ BEST SELLERS ============ */}
      <section className="container-x pb-12">
        <Reveal><SectionHead eyebrow="Flying out the door" silver="FAN" green="FAVOURITES" href="/shop" /></Reveal>
        <DragScroll className="no-scrollbar -mx-4 mt-4 flex gap-4 overflow-x-auto px-4 py-6">
          {sellers.map((p, i) => (
            <Reveal key={p.id} delay={i * 50} className="shrink-0"><ProductRailCard p={p} /></Reveal>
          ))}
        </DragScroll>
      </section>

      {/* ============ PAY LATER — HappyPay (yellow / black) ============ */}
      <section className="container-x pb-12">
        <Reveal variant="zoom">
          <div className="relative overflow-hidden rounded-2xl bg-[#FFD400] p-6 sm:p-10">
            {/* faint black checker texture */}
            <div className="checker pointer-events-none absolute right-0 top-0 h-full w-28 opacity-10" />
            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {/* Official HappyPay wordmark */}
                <HappyPayLogo className="h-9 w-auto text-black sm:h-11" />
                <h3 className="skew-italic mt-4 font-display text-5xl font-black leading-[0.82] tracking-tight text-black sm:text-7xl">
                  BUY NOW
                  <br />
                  AND PAY LATER
                </h3>
                <p className="mt-4 max-w-lg text-base font-bold text-black/80 sm:text-lg">
                  See if you qualify for credit! Drive now and pay in easy monthly
                  instalments — instant approval at checkout, no paperwork, no fuss.
                </p>
              </div>
              <Link
                href="/shop"
                className="shrink-0 whitespace-nowrap rounded-xl bg-black px-8 py-4 text-base font-extrabold text-[#FFD400] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.04]"
              >
                Check if you qualify →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============ DEALS ============ */}
      <section className="container-x pb-12">
        <Reveal>
          <div className="mb-6 flex items-end justify-between gap-4 border-l-4 border-sale pl-4">
            <div>
              <span className="eyebrow !text-sale">🔥 Limited time only</span>
              <h2 className="skew-italic mt-1 font-display text-4xl leading-none sm:text-5xl">
                <span className="text-chrome">MASSIVE</span> <span className="text-volt-grad">SAVINGS</span>
              </h2>
            </div>
            <Link href="/shop?onSale=1" className="btn btn-ghost shrink-0">All deals</Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {deals.map((p, i) => (
            <Reveal key={p.id} delay={(i % 4) * 70}><ProductCard p={p} /></Reveal>
          ))}
        </div>
      </section>

      {/* ============ MAG WHEELS ============ */}
      {mags.length > 0 && (
        <section className="container-x pb-12">
          <Reveal><SectionHead eyebrow="Turn heads on every street" silver="FRESH" green="MAGS" href="/shop?type=wheel" /></Reveal>
          <DragScroll className="no-scrollbar -mx-4 mt-4 flex gap-4 overflow-x-auto px-4 py-6">
            {mags.map((p, i) => (
              <Reveal key={p.id} delay={i * 50} className="shrink-0"><ProductRailCard p={p} /></Reveal>
            ))}
          </DragScroll>
        </section>
      )}

      {/* ============ ABOUT / OUR STORY + TEAM ============ */}
      <AboutTeam />

      {/* ============ BRAND WALL ============ */}
      <section className="border-y border-line bg-ink-2">
        <div className="container-x py-10">
          <Reveal>
            <div className="mb-6 text-center">
              <span className="eyebrow">Stocked &amp; ready to ship</span>
              <h2 className="skew-italic mt-1 font-display text-3xl leading-none sm:text-4xl">
                <span className="text-chrome">SHOP BY</span> <span className="text-volt-grad">BRAND</span>
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {BRANDS.map((b, i) => (
              <Reveal key={b} delay={(i % 8) * 35}>
                <BrandTile brand={b} />
              </Reveal>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-bold tracking-wide text-volt hover:brightness-125">
              VIEW ALL BRANDS <Arrow width={14} height={14} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function FeatureTile({ title, tags, href, cta, image }: { title: string; tags: string[]; href: string; cta: string; image: string }) {
  return (
    <Link href={href} className="glow-hover group relative block aspect-[16/9] overflow-hidden rounded-2xl border border-line sm:aspect-[16/7]">
      <Image
        src={image}
        alt={title}
        fill
        sizes="(max-width:1024px) 100vw, 640px"
        className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.06]"
      />
      {/* legibility gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0a0b0d_0%,rgba(10,11,13,0.72)_32%,rgba(10,11,13,0.18)_64%,transparent_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(0deg,rgba(10,11,13,0.6),transparent)]" />
      {/* copy — large text overlay */}
      <div className="absolute inset-0 flex flex-col justify-center p-6 sm:p-9">
        <h3 className="skew-italic text-chrome font-display text-7xl leading-[0.82] drop-shadow-[0_4px_18px_rgba(0,0,0,0.7)] sm:text-8xl">{title}</h3>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-fg/90 drop-shadow sm:text-xs">{tags.join("  |  ")}</p>
        <span className="btn btn-volt-outline mt-5 w-fit px-6 py-2.5 text-sm">
          {cta} <Arrow width={15} height={15} />
        </span>
      </div>
    </Link>
  );
}

function SectionHead({ eyebrow, silver, green, href }: { eyebrow: string; silver: string; green: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="skew-italic mt-1 font-display text-4xl leading-none sm:text-5xl">
          <span className="text-chrome">{silver}</span> <span className="text-volt-grad">{green}</span>
        </h2>
      </div>
      {href && <Link href={href} className="btn btn-ghost shrink-0">View all</Link>}
    </div>
  );
}
