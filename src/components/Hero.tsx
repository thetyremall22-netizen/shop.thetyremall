"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Truck, Arrow, Flame } from "./icons";

export function Hero() {
  // Scene 1 = big "CHEAPEST TYRES" (image 1). Scene 2 = title shrinks and the
  // Biggest Brands / Widest Range / Best Prices line flies in beneath it
  // (image 2). SOUTH AFRICA'S and WITH FREE DELIVERY are shared — they enter
  // once in scene 1 and simply stay put through scene 2.
  const [scene, setScene] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setScene(2), 2200);
    return () => clearTimeout(t);
  }, []);

  const titleSize =
    scene >= 2 ? "text-5xl sm:text-7xl lg:text-8xl" : "text-7xl sm:text-8xl lg:text-9xl";
  const titleCls = `ct-pop block ${titleSize} transition-[font-size] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]`;

  return (
    <section className="relative flex min-h-[560px] items-center overflow-hidden bg-ink lg:min-h-[660px]">
      {/* full-bleed cinematic background */}
      <Image
        src="/brand/hero-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="z-0 object-cover object-center"
        aria-hidden
      />
      {/* legibility gradient (dark on the left where the text sits) */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0a0b0d_0%,rgba(10,11,13,0.85)_26%,rgba(10,11,13,0.4)_52%,transparent_78%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      {/* rain motion */}
      <div className="rain" />
      <div className="rain slow" />

      {/* copy */}
      <div className="container-x relative z-10 py-14">
        <div className="rise max-w-xl">
          {/* 1 — small line (shared, stays through both scenes) */}
          <p className="sa-line font-display text-base tracking-[0.42em] text-fg/90 drop-shadow sm:text-lg">SOUTH AFRICA&apos;S</p>
          {/* 2 — title zone. An invisible sizer reserves the scene-1 (large)
               title footprint so this zone's height never changes — everything
               above (SOUTH AFRICA'S) and below (WITH FREE DELIVERY, the blurb,
               the buttons) stays pinned in the exact same place across scenes.
               The real, animated title + Biggest Brands row are overlaid on top
               (absolutely positioned), so only they move: the title shrinks and
               the Biggest Brands row slots into the space it frees. */}
          <div className="relative mt-1">
            {/* invisible sizer — reserves the large title's height */}
            <div aria-hidden className="invisible skew-italic font-display leading-[0.82] tracking-tight">
              <span className="block text-7xl sm:text-8xl lg:text-9xl">CHEAPEST</span>
              <span className="block text-7xl sm:text-8xl lg:text-9xl">TYRES</span>
            </div>
            {/* real animated content — overlaid, does not affect layout */}
            <div className="absolute inset-x-0 top-0">
              <h1 className="skew-italic font-display leading-[0.82] tracking-tight">
                <span className={`${titleCls} text-chrome`} style={{ animationDelay: "0.5s" }}>CHEAPEST</span>
                <span className={`${titleCls} text-volt-grad`} style={{ animationDelay: "0.64s" }}>TYRES</span>
              </h1>
              {/* scene 2 only: Biggest Brands · Widest Range · Best Prices rise up
                   one after another into the space freed by the shrinking title. */}
              <div className={`grid transition-all duration-500 ${scene >= 2 ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                <div className="overflow-hidden">
                  <div className="skew-italic flex flex-wrap items-center gap-x-2 gap-y-0.5 font-display text-base uppercase tracking-tight drop-shadow sm:text-xl lg:text-2xl">
                    <span className={scene >= 2 ? "hero-line" : "opacity-0"} style={{ animationDelay: "0.1s" }}><span className="text-volt-grad">Biggest</span> <span className="text-chrome">Brands</span></span>
                    <span className={scene >= 2 ? "hero-line" : "opacity-0"} style={{ animationDelay: "0.25s" }}><span className="text-volt">•</span> <span className="text-volt-grad">Widest</span> <span className="text-chrome">Range</span></span>
                    <span className={scene >= 2 ? "hero-line" : "opacity-0"} style={{ animationDelay: "0.4s" }}><span className="text-volt">•</span> <span className="text-volt-grad">Best</span> <span className="text-chrome">Prices</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* 3 — shared: comes in big in scene 1 and stays big (no re-animation) */}
          <div className="fd-pop mt-3 flex items-center gap-3" style={{ animationDelay: "1.2s" }}>
            <span className="grid size-12 shrink-0 place-items-center rounded-xl text-volt ring-1 ring-volt/40 backdrop-blur-sm">
              <Truck width={24} height={24} />
            </span>
            <div className="leading-[0.95]">
              <div className="skew-italic text-volt-grad font-display text-4xl tracking-tight sm:text-6xl">WITH FREE DELIVERY</div>
              <div className="mt-1 text-sm tracking-wide text-muted">ON 2 OR MORE TYRES · NATIONWIDE</div>
            </div>
          </div>

          <p className="mt-5 max-w-md text-base font-semibold text-fg drop-shadow sm:text-lg">
            7,000+ tyres &amp; mags, priced to move. <span className="text-volt">Nobody beats The Tyre Mall.</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/shop" className="btn btn-volt-outline px-8 py-4 text-base font-extrabold">
              SHOP NOW <Arrow width={18} height={18} />
            </Link>
            <Link href="/shop?onSale=1" className="deal-fire" aria-label="Red hot dealz on wheelz">
              <span className="relative z-10 inline-flex items-center gap-2">
                <Flame width={18} height={18} /> RED HOT DEALZ ON WHEELZ
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
