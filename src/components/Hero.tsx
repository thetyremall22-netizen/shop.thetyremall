import Link from "next/link";
import Image from "next/image";
import { Truck, Arrow, Flame } from "./icons";
import { RotatingHeadline } from "./RotatingHeadline";

export function Hero() {
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
          {/* 1 — small line */}
          <p className="sa-line font-display text-base tracking-[0.42em] text-fg/90 drop-shadow sm:text-lg">SOUTH AFRICA&apos;S</p>
          {/* 2 — the big title rotates: CHEAPEST TYRES ⇄ BIGGEST BRANDS / WIDEST RANGE / BEST PRICES */}
          <RotatingHeadline />
          {/* 3 — comes in big and stays big */}
          <div className="fd-pop mt-3 flex items-center gap-3">
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
