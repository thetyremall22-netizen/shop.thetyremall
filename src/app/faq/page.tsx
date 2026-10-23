import type { Metadata } from "next";
import { PageHeader, PageExtras } from "@/components/PageContent";
import { pageMetadata } from "@/lib/page-content";
import Link from "next/link";
import { FaqAccordion } from "@/components/FaqAccordion";
import { FAQ_SECTIONS } from "@/data/faq";

const BASE_META: Metadata = {
  title: "Tyre FAQ — Buying, Fitting & Caring for Tyres",
  description:
    "Answers to the most common tyre questions — how to read a tyre size, when to replace tyres, tread depth law in South Africa, delivery, payment, returns and warranty.",
  alternates: { canonical: "/faq" },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("faq", BASE_META);
}

const SITE = "https://thetyremall.co.za";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function FaqPage() {
  // FAQPage structured data (schema.org) — helps Google rich results and gives
  // LLMs / AI answer engines clean, machine-readable Q&A.
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_SECTIONS.flatMap((s) =>
      s.items.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: i.a },
      }))
    ),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "FAQ", item: `${SITE}/faq` },
    ],
  };

  const total = FAQ_SECTIONS.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="container-x py-10 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <PageHeader page="faq" eyebrow={`${total} answers · tyres, fitment & orders`} silver="TYRE" green="FAQ"
        intro={<>Everything you need to know about buying, fitting and caring for your tyres. Can&apos;t find your
          answer? <Link href="/contact-us/" className="font-semibold text-volt hover:underline">Ask our team</Link>.</>} />
      <PageExtras page="faq" position="top" />

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* jump nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-28">
            <div className="eyebrow mb-3">Jump to</div>
            <ul className="space-y-2 text-sm">
              {FAQ_SECTIONS.map((s) => (
                <li key={s.section}>
                  <a href={`#${slugify(s.section)}`} className="text-muted transition-colors hover:text-volt">
                    {s.section}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <FaqAccordion sections={FAQ_SECTIONS} />
      </div>

      <div className="mt-12 rounded-2xl border border-line bg-ink-2 p-8 text-center">
        <h2 className="font-display text-2xl sm:text-3xl">Still have a question?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Send us your vehicle details or a photo of your tyre sidewall and we&apos;ll confirm the right fit.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/contact-us/" className="btn btn-volt h-12 px-6">Contact us</Link>
          <Link href="/shop" className="btn btn-ghost h-12 px-6">Shop tyres</Link>
        </div>
      </div>
      <PageExtras page="faq" position="bottom" className="mt-10" />
    </div>
  );
}
