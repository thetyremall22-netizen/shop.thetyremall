import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Arrow, Truck, Bolt } from "@/components/icons";

export const metadata: Metadata = {
  title: "The Wheel Shop — Mag Wheels",
  description: "Shop mag wheels at The Tyre Mall — 15\" to 20\", bakkie & replica designs, nationwide delivery and fitment.",
};

const SIZES = ["15\"", "16\"", "17\"", "18\"", "20\""];
const STYLES = [
  { name: "Bakkie & 4×4", blurb: "6×139.7 fitments, load-rated for SUVs and bakkies." },
  { name: "Replica designs", blurb: "BBS, Volk Racing, Vossen & M-style replicas." },
  { name: "Concave & deep-dish", blurb: "Aggressive offsets that fill the arch." },
  { name: "OEM fitment", blurb: "Factory-correct PCDs and offsets." },
];
const PCDS = ["4×100", "5×112", "5×114.3", "5×120", "5×150", "6×139.7"];

export default function WheelShopPage() {
  return (
    <div>
      {/* hero */}
      <section className="relative flex min-h-[340px] items-center overflow-hidden bg-ink">
        <Image src="/brand/tile-wheels.webp" alt="" fill priority sizes="100vw" className="object-cover object-center opacity-70" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0a0b0d_0%,rgba(10,11,13,0.8)_38%,rgba(10,11,13,0.25)_72%,transparent_100%)]" />
        <div className="container-x relative z-10 py-14">
          <span className="eyebrow">The Wheel Shop</span>
          <h1 className="skew-italic mt-1 font-display text-6xl leading-[0.85] sm:text-8xl">
            <span className="text-chrome">MAG</span> <span className="text-volt-grad">WHEELS</span>
          </h1>
          <p className="mt-4 max-w-md text-base font-semibold text-fg drop-shadow sm:text-lg">
            15&quot; to 20&quot; · bakkie, 4×4 &amp; replica designs. Turn heads on every street.
          </p>
          <Link href="/contact?reason=wheels" className="btn btn-volt mt-6 px-7 py-3.5 text-base">
            Request a wheel quote <Arrow width={18} height={18} />
          </Link>
        </div>
      </section>

      <div className="container-x space-y-12 py-12">
        {/* by size */}
        <section>
          <h2 className="skew-italic font-display text-3xl sm:text-4xl"><span className="text-chrome">SHOP BY</span> <span className="text-volt-grad">SIZE</span></h2>
          <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5">
            {SIZES.map((s) => (
              <Link key={s} href="/contact?reason=wheels" className="glow-hover grid aspect-square place-items-center rounded-2xl border border-line bg-surface text-center transition-transform hover:scale-[1.03]">
                <div>
                  <div className="font-display text-4xl text-volt">{s}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-muted">Mag wheels</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* styles */}
        <section>
          <h2 className="skew-italic font-display text-3xl sm:text-4xl"><span className="text-chrome">POPULAR</span> <span className="text-volt-grad">STYLES</span></h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STYLES.map((s) => (
              <div key={s.name} className="card glow-hover p-5">
                <div className="font-display text-xl text-fg">{s.name}</div>
                <p className="mt-1.5 text-sm text-muted">{s.blurb}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {PCDS.map((p) => (
              <span key={p} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-muted">{p}</span>
            ))}
          </div>
        </section>

        {/* CTA band */}
        <section className="relative overflow-hidden rounded-2xl border border-line bg-ink-2 p-8 text-center sm:p-12">
          <h2 className="skew-italic font-display text-4xl leading-none sm:text-5xl">
            <span className="text-chrome">CAN&apos;T FIND</span> <span className="text-volt-grad">YOUR FITMENT?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Tell us your vehicle and the look you&apos;re after — we&apos;ll match you to the perfect set of mags,
            with nationwide delivery and fitment at our Johannesburg partners.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact?reason=wheels" className="btn btn-volt px-7 py-3.5 text-base"><Bolt width={18} height={18} /> Request a quote</Link>
            <a href="https://wa.link/k33vfb" target="_blank" rel="noopener noreferrer" className="btn btn-ghost px-7 py-3.5 text-base">WhatsApp us</a>
          </div>
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-muted"><Truck width={15} height={15} className="text-volt" /> Free nationwide delivery on qualifying orders</div>
        </section>
      </div>
    </div>
  );
}
