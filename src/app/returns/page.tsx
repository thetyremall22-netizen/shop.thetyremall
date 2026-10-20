import type { Metadata } from "next";
import { PageHeader, PageExtras } from "@/components/PageContent";
import { pageMetadata } from "@/lib/page-content";
import Link from "next/link";
import { LEGAL } from "@/data/legal";
import { Truck, Shield, Bolt } from "@/components/icons";

const BASE_META: Metadata = {
  title: "Returns & Refunds Policy",
  description:
    "The Tyre Mall returns & refunds policy — 7 business day cooling-off period on unfitted tyres in original packaging, defective-goods process under the CPA, delivery and warranty terms.",
  alternates: { canonical: "/returns" },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("returns", BASE_META);
}

// Pull the relevant clauses from the single source-of-truth legal document.
const pick = (prefix: string) => LEGAL.sections.find((s) => s.heading.startsWith(prefix));
const delivery = pick("5.");
const returns = pick("7.");
const warranty = pick("8.");

const HIGHLIGHTS = [
  { icon: Bolt, t: "7 business days", s: "Cooling-off period to cancel online purchases" },
  { icon: Shield, t: "Full product refund", s: "Unfitted, unused tyres in original packaging" },
  { icon: Truck, t: "Delivered in 3–5 days", s: "Nationwide, free on 2+ tyres" },
];

export default function ReturnsPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      <PageHeader page="returns" eyebrow="Your rights under the CPA" silver="RETURNS &" green="REFUNDS"
        h1Class="skew-italic mt-1 font-display text-4xl leading-[0.95] sm:text-6xl"
        intro={<>Changed your mind or received a faulty tyre? Here&apos;s exactly how returns, cancellations and
          refunds work — always <Link href="/contact" className="font-semibold text-volt hover:underline">contact us first</Link> so
          we can guide you through it.</>} />
      <PageExtras page="returns" position="top" />

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {HIGHLIGHTS.map((h) => (
          <div key={h.t} className="card flex items-center gap-3 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt ring-1 ring-line">
              <h.icon width={22} height={22} />
            </span>
            <div>
              <div className="font-display text-lg text-fg">{h.t}</div>
              <div className="text-xs text-muted">{h.s}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 max-w-3xl space-y-8">
        {[returns, delivery, warranty].filter(Boolean).map((s) => (
          <section key={s!.heading}>
            <h2 className="font-display text-xl text-volt sm:text-2xl">
              {s!.heading.replace(/^\d+\.\s*/, "")}
            </h2>
            <div className="mt-3 space-y-2.5">
              {s!.paras.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted">{p}</p>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-xl border border-line bg-ink-2 p-5 text-sm text-muted">
          This is a summary of the most-used clauses. The full legal text lives in our{" "}
          <Link href="/terms" className="font-semibold text-volt hover:underline">Terms &amp; Conditions</Link>.
          Road-hazard damage isn&apos;t a manufacturing fault — see{" "}
          <Link href="/radar-protect" className="font-semibold text-volt hover:underline">Radar Protect</Link> for cover.
        </div>
      </div>
      <PageExtras page="returns" position="bottom" className="mt-10" />
    </div>
  );
}
