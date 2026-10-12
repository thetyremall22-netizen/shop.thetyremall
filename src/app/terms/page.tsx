import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/data/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The Tyre Mall Terms & Conditions — website use, product availability, pricing, orders & payment, delivery, fitment, returns, warranty, Radar Protect, privacy (POPIA) and governing law.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      <div className="max-w-2xl">
        <span className="eyebrow">Effective date: {LEGAL.effectiveDate}</span>
        <h1 className="skew-italic mt-1 font-display text-4xl leading-[0.95] sm:text-6xl">
          <span className="text-chrome">TERMS &amp;</span> <span className="text-volt-grad">CONDITIONS</span>
        </h1>
        {LEGAL.intro.map((p, i) => (
          <p key={i} className="mt-4 text-sm leading-relaxed text-muted">{p}</p>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        {/* contents */}
        <nav className="hidden lg:block">
          <div className="sticky top-28">
            <div className="eyebrow mb-3">Contents</div>
            <ul className="space-y-1.5 text-sm">
              {LEGAL.sections.map((s, i) => (
                <li key={i}>
                  <a href={`#s${i + 1}`} className="text-muted transition-colors hover:text-volt">{s.heading}</a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="max-w-3xl space-y-8">
          {LEGAL.sections.map((s, i) => (
            <section key={i} id={`s${i + 1}`} className="scroll-mt-28">
              <h2 className="font-display text-xl text-fg sm:text-2xl">{s.heading}</h2>
              <div className="mt-3 space-y-2.5">
                {s.paras.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-muted">{p}</p>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-xl border border-line bg-ink-2 p-5 text-sm text-muted">
            See also our <Link href="/returns" className="font-semibold text-volt hover:underline">Returns &amp; Refunds</Link> summary
            and <Link href="/radar-protect" className="font-semibold text-volt hover:underline">Radar Protect</Link> page.
          </div>
        </div>
      </div>
    </div>
  );
}
