import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Shield, Bolt, Phone, Pin } from "@/components/icons";

export const metadata: Metadata = {
  title: "About Us — The Tyre Mall",
  description:
    "The Tyre Mall is one of South Africa's largest online tyre suppliers, backed by the Trump Tyre Group (B-BBEE Level 1). Quality tyres & mag wheels, expert advice and nationwide delivery.",
};

const VALUES = [
  { icon: Shield, t: "Quality you can trust", s: "We source from reputable brands and ensure every product meets performance standards." },
  { icon: Bolt, t: "Exceptional service", s: "Speedy responses, reliable delivery and expert support on every order." },
  { icon: Truck, t: "Integrity & transparency", s: "Backed by the Trump Tyre Group and held to industry best practice." },
  { icon: Pin, t: "Customer-centric", s: "Private owner, workshop pro or fleet operator — we put you first." },
];

const TEAM = [
  { name: "Sales & Advice", role: "Tyre & fitment experts", blurb: "Help choosing the right size, brand and spec for your vehicle or fleet." },
  { name: "Customer Support", role: "Orders & aftercare", blurb: "Order tracking, warranty questions and anything you need after the sale." },
  { name: "Logistics", role: "Nationwide dispatch", blurb: "Getting your tyres to your door or fitment centre, fast and in one piece." },
  { name: "Fitment Partners", role: "Johannesburg & national", blurb: "Trusted centres ready to fit and balance your new tyres and wheels." },
];

export default function AboutPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      {/* hero */}
      <div className="max-w-3xl">
        <span className="eyebrow">Backed by the Trump Tyre Group · B-BBEE Level 1</span>
        <h1 className="skew-italic mt-1 font-display text-5xl leading-[0.9] sm:text-7xl">
          <span className="text-chrome">ABOUT</span> <span className="text-volt-grad">THE TYRE MALL</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          Your premier online destination for tyres and wheels in South Africa. Backed by the heritage of the
          Trump Tyre Group, we&apos;ve built our reputation on quality, value and service.
        </p>
      </div>

      {/* who we are */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Who we are</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Founded to meet the needs of drivers, fleets and trade professionals alike, The Tyre Mall offers a
            vast selection of premium and mid-tier passenger, SUV, 4×4, commercial and run-flat tyres. As one of
            the largest online tyre suppliers in South Africa, we combine expert advice, national delivery and
            outstanding value.
          </p>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Our commitment</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Tyres are the critical link between your vehicle and the road — or the job-site — and we take that
            responsibility seriously. Whether you&apos;re heading into the city, across rough terrain, or logging
            commercial kilometres, The Tyre Mall is here to equip you with the right solutions.
          </p>
        </div>
      </div>

      {/* what we do */}
      <h2 className="mt-12 font-display text-3xl">What we do</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Extensive range", s: "From everyday passenger tyres to high-performance, off-road and commercial solutions." },
          { t: "Nationwide delivery", s: "The right tyre when you need it, wherever you are in South Africa." },
          { t: "Trade & fleet support", s: "Bulk ordering and fast turnaround for workshops and fleet operators." },
          { t: "Knowledge & assistance", s: "Experts ready to help with size, fitment and specification." },
        ].map((c) => (
          <div key={c.t} className="card p-5">
            <div className="font-display text-lg text-fg">{c.t}</div>
            <p className="mt-1.5 text-sm text-muted">{c.s}</p>
          </div>
        ))}
      </div>

      {/* values */}
      <h2 className="mt-12 font-display text-3xl">Our values</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {VALUES.map((v) => (
          <div key={v.t} className="card flex items-start gap-4 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt ring-1 ring-line">
              <v.icon width={22} height={22} />
            </span>
            <div>
              <div className="font-display text-lg text-fg">{v.t}</div>
              <p className="mt-1 text-sm text-muted">{v.s}</p>
            </div>
          </div>
        ))}
      </div>

      {/* meet the team */}
      <div id="team" className="mt-14 scroll-mt-24">
        <span className="eyebrow">The people behind the Mall</span>
        <h2 className="skew-italic mt-1 font-display text-4xl sm:text-5xl">
          <span className="text-chrome">MEET THE</span> <span className="text-volt-grad">TEAM</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Real people who know tyres. From first question to final fitment, our team keeps South Africa rolling.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => (
            <div key={m.name} className="card glow-hover p-5 text-center">
              <div className="mx-auto grid size-20 place-items-center rounded-full bg-gradient-to-br from-volt/30 to-surface-2 font-display text-3xl text-volt ring-1 ring-line">
                {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
              </div>
              <div className="mt-3 font-display text-lg text-fg">{m.name}</div>
              <div className="text-xs font-bold uppercase tracking-wide text-volt">{m.role}</div>
              <p className="mt-2 text-xs text-muted">{m.blurb}</p>
            </div>
          ))}
        </div>
      </div>

      {/* cta */}
      <div className="mt-14 rounded-2xl border border-line bg-ink-2 p-8 text-center">
        <h2 className="font-display text-2xl sm:text-3xl">Let us help you keep moving forward</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Thank you for choosing The Tyre Mall. Browse the range, or talk to our team about the right fit for your
          vehicle or fleet.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn btn-volt h-12 px-6">Shop tyres & wheels</Link>
          <a href="tel:0780088788" className="btn btn-ghost h-12 px-6">
            <Phone width={16} height={16} /> 078 0088 788
          </a>
        </div>
      </div>
    </div>
  );
}
