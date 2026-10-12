import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Bolt, Truck } from "@/components/icons";

export const metadata: Metadata = {
  title: "Radar Protect — 12-Month Road Hazard Protection",
  description:
    "Selected Radar tyres from The Tyre Mall include Radar Protect: 12-month road hazard cover against nails, glass, potholes, cuts and impact breaks. See what's covered, eligible ranges and how to claim.",
  alternates: { canonical: "/radar-protect" },
};

const COVERED = ["Nails or screws", "Glass & sharp debris", "Potholes", "Cuts, snags, bruises & impact breaks"];
const RANGES = ["Dimax Sport", "Dimax R8 / R8+", "Dimax Sprint", "Dimax Touring", "RPX 800 / 800+", "Rivera Pro-2", "Renegade A/T-5", "Renegade A/T Sport", "Renegade R/T+"];
const YOU_PAY = ["Fitting & removal", "Wheel balancing", "Alignment", "Valve stems, consumables & disposal", "Shipping / call-out charges", "Applicable taxes"];
const EXCLUSIONS = [
  "Normal tread wear, or tyres worn more than 4 mm from original depth",
  "Tyres that can be safely repaired to recognised standards",
  "Damage from incorrect inflation, overloading or poor maintenance",
  "Damage from alignment, suspension or mechanical defects",
  "Racing, track, competition or off-road misuse",
  "Negligent/abusive driving — burnouts, spinning",
  "Accidents, collisions, vandalism, fire or chemical damage",
  "Commercial, fleet, emergency-service or competition tyres",
  "Tyres from unauthorised retailers, or moved to another vehicle",
];
const CLAIM_STEPS = [
  { t: "Contact us first", d: "Email shop@thetyremall.co.za with subject \"Radar Protect Claim – [Your Order Number]\"." },
  { t: "Prepare your documents", d: "Your original Tyre Mall invoice and a completed Radar Claim Form." },
  { t: "Take the required photos", d: "Barcode, DOT code, sidebar brand & pattern, the damage, tread pattern, full sidewall and remaining tread depth." },
  { t: "Email everything to us", d: "Send the claim form, invoice and photos to shop@thetyremall.co.za, or use our online form." },
  { t: "We submit to Radar", d: "We forward your claim to Radar's authorised distributor for technical review." },
  { t: "Outcome", d: "If approved, we arrange the replacement and advise any costs. If rejected, we share the distributor's reason." },
];

export default function RadarProtectPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      {/* hero */}
      <div className="rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-ink-2 to-ink-2 p-8 sm:p-12">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-volt/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-volt ring-1 ring-volt/30">
            <Shield width={14} height={14} /> 12-month road hazard cover
          </span>
          <h1 className="skew-italic mt-4 font-display text-4xl leading-[0.95] sm:text-6xl">
            <span className="text-chrome">RADAR</span> <span className="text-volt-grad">PROTECT</span>
          </h1>
          <p className="mt-4 text-base text-muted sm:text-lg">
            Selected Radar tyres from The Tyre Mall include Radar Protect — extra peace of mind if your eligible
            Radar tyre is damaged by everyday road hazards. Offered by Radar Tyres and their authorised distributors.
          </p>
          <Link href="/shop?q=radar" className="btn btn-volt mt-6 h-12 px-6">Shop Radar tyres</Link>
        </div>
      </div>

      {/* three pillars */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Shield, t: "Covers road hazards", s: "Non-repairable damage from nails, glass, potholes & impacts" },
          { icon: Bolt, t: "12 months / 4 mm", s: "Whichever comes first, from date of purchase" },
          { icon: Truck, t: "Equivalent replacement", s: "Same-range Radar tyre on approved claims" },
        ].map((f) => (
          <div key={f.t} className="card flex items-start gap-3 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt ring-1 ring-line">
              <f.icon width={22} height={22} />
            </span>
            <div>
              <div className="font-display text-lg text-fg">{f.t}</div>
              <div className="text-xs text-muted">{f.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* what's covered */}
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">What&apos;s covered</h2>
          <p className="mt-2 text-sm text-muted">Non-repairable damage to an eligible Radar tyre caused by:</p>
          <ul className="mt-3 space-y-2">
            {COVERED.map((c) => (
              <li key={c} className="flex items-center gap-2 text-sm text-fg">
                <span className="text-volt">✓</span> {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            If the damage can&apos;t be safely repaired and your claim is approved, the tyre is replaced with an
            equivalent Radar tyre.
          </p>
        </div>

        {/* coverage period */}
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Coverage period</h2>
          <p className="mt-2 text-sm text-muted">Your Radar Protect cover is valid until the earlier of:</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-4 text-center">
              <div className="font-display text-3xl text-volt">12</div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted">months from purchase</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 text-center">
              <div className="font-display text-3xl text-volt">4 mm</div>
              <div className="text-xs font-bold uppercase tracking-wide text-muted">of tread worn</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Applies in South Africa only, to tyres bought from authorised Radar retailers. Only tyres marked
            <span className="font-semibold text-fg"> &ldquo;Includes Radar Protect&rdquo;</span> on our site are covered.
          </p>
        </div>
      </div>

      {/* eligible ranges */}
      <div className="mt-6 card p-6">
        <h2 className="font-display text-2xl text-volt">Eligible Radar ranges</h2>
        <p className="mt-2 text-sm text-muted">Radar Protect applies only to selected ranges (where stocked):</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <span key={r} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-fg">{r}</span>
          ))}
        </div>
      </div>

      {/* claim process */}
      <h2 className="mt-12 font-display text-3xl">How to claim</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CLAIM_STEPS.map((s, i) => (
          <div key={s.t} className="card p-5">
            <div className="flex size-9 items-center justify-center rounded-full bg-volt font-display text-lg text-volt-ink">{i + 1}</div>
            <div className="mt-3 font-display text-lg text-fg">{s.t}</div>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">The final decision on all claims rests with Radar Tyres and/or its authorised distributor.</p>

      {/* costs + exclusions */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl text-fg">You&apos;re responsible for</h2>
          <p className="mt-2 text-sm text-muted">Even on an approved claim, these costs are for your account:</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {YOU_PAY.map((c) => (
              <li key={c} className="text-sm text-muted">• {c}</li>
            ))}
          </ul>
        </div>
        <div className="card border-sale/30 p-6">
          <h2 className="font-display text-2xl text-fg">What&apos;s not covered</h2>
          <ul className="mt-3 space-y-2">
            {EXCLUSIONS.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-muted">
                <span className="mt-0.5 text-sale">✕</span> {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-ink-2 p-8 text-center">
        <h2 className="font-display text-2xl sm:text-3xl">Questions about Radar Protect?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Our customer service team will happily guide you on eligibility and the claim process.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href="mailto:shop@thetyremall.co.za?subject=Radar%20Protect%20Query" className="btn btn-volt h-12 px-6">Email us</a>
          <Link href="/terms#s14" className="btn btn-ghost h-12 px-6">Full Radar Protect terms</Link>
        </div>
      </div>
    </div>
  );
}
