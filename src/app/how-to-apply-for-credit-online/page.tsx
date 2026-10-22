import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, PageExtras } from "@/components/PageContent";
import { pageMetadata } from "@/lib/page-content";
import { Bolt, Shield, Truck } from "@/components/icons";
import { SHOP_EMAIL, SHOP_PHONE_DISPLAY, SHOP_PHONE_TEL } from "@/lib/shop-config";

// How to apply for instant credit (buy now, pay later) with HappyPay at The
// Tyre Mall. Facts from happypay.co.za (shopper FAQ + terms), October 2026.
// Same address as the old site: /how-to-apply-for-credit-online/

const BASE_META: Metadata = {
  title: "How to Apply for Credit Online — Buy Now, Pay Later with HappyPay",
  description:
    "Buy tyres and mag wheels now and pay later with HappyPay at The Tyre Mall: split your order into 2 interest-free payments over your next two paydays, no deposit. Who can apply, how to apply at checkout, and how repayments work.",
  alternates: { canonical: "/how-to-apply-for-credit-online/" },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("how-to-apply-for-credit-online", BASE_META);
}

const REQUIREMENTS = [
  "18 years or older",
  "A South African citizen or permanent resident (you'll need your SA ID number)",
  "Permanently employed or self-employed in South Africa",
  "A debit or credit card from a South African bank, in your own name",
  "Not under debt review, administration or sequestration",
];

const STEPS = [
  { t: "Choose your tyres or wheels", d: "Find your size, add the tyres or mag wheels you want to your cart, and pick delivery or fitment." },
  { t: "Go to checkout", d: "Fill in your details and a South African delivery address (or choose fitment at our JHB partner centre)." },
  { t: "Choose HappyPay", d: "Under \"Payment method\", select HappyPay — Pay over 2 months, then place your order. You'll be taken to HappyPay's secure page." },
  { t: "Sign up or log in to HappyPay", d: "First time? Complete HappyPay's short sign-up with your basic details, SA ID number and bank card. Already have an account? Just log in — it takes about two clicks." },
  { t: "Get an instant decision", d: "HappyPay checks your application straight away and gives you a spending limit. If your order fits your limit, approve the payment plan." },
  { t: "Done — we get your order moving", d: "You're brought back to The Tyre Mall, your order is confirmed and you get a confirmation email. We pack and deliver your tyres (free delivery on 2 or more tyres) or book your fitment." },
];

const FAQS: { q: string; a: string }[] = [
  { q: "What is HappyPay?", a: "HappyPay is a South African buy now, pay later service. At The Tyre Mall you can use it to buy tyres and mag wheels now and spread the cost over your next two paydays — no deposit and no interest if you pay on time." },
  { q: "How do the payments work?", a: "Your order is split into two equal payments: 50% on your first payday after you buy, and the other 50% on your next payday. HappyPay collects each payment from the bank card you registered. You can also pay early by logging in to HappyPay and clicking \"Pay Now\" next to the transaction." },
  { q: "Is there interest or a deposit?", a: "No. There's no deposit, and if you pay on time you pay no interest." },
  { q: "What if I miss a payment?", a: "HappyPay will let you know if a payment fails and will try again. A late fee of R100 per week applies (for up to three weeks, so up to R300 per missed payment), so make sure there's enough money in your account on your payday." },
  { q: "How long does approval take?", a: "It's instant — HappyPay assesses your application during sign-up and gives you a spending limit straight away." },
  { q: "Why might I be declined?", a: "HappyPay assesses your credit record and affordability, so approval isn't guaranteed. Applications with a poor credit history, or no credit history yet, may be declined. If that happens you can still pay by card or instant EFT with PayFast." },
  { q: "How much can I spend?", a: "HappyPay sets your spending limit based on your financial health and payment behaviour. When you first sign up you can make one purchase; paying on time can increase your limit over time." },
  { q: "What about returns and refunds?", a: "Returns are handled by The Tyre Mall under our returns policy. If a refund is approved, we instruct HappyPay to refund your payments. If it hasn't reached you within five working days of the confirmation email, contact HappyPay at support@happypay.co.za." },
  { q: "Who do I contact for help?", a: "For your order, tyres or delivery, contact The Tyre Mall. For your HappyPay account, payments or limit, contact HappyPay: support@happypay.co.za or WhatsApp 064 865 1831." },
];

export default function HowToApplyForCredit() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <div className="container-x py-10 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* hero */}
      <div className="rounded-3xl border border-volt/30 bg-gradient-to-br from-volt/10 via-ink-2 to-ink-2 p-8 sm:p-12">
        <PageHeader page="how-to-apply-for-credit-online" silver="BUY NOW," green="PAY LATER"
          h1Class="skew-italic mt-4 font-display text-4xl leading-[0.95] sm:text-6xl"
          eyebrowNode={<span className="inline-flex items-center gap-2 rounded-full bg-volt/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-volt ring-1 ring-volt/30">
            <Bolt width={14} height={14} /> How to apply for credit online with HappyPay
          </span>}
          intro={<>Get your tyres and mag wheels today and pay in <b className="text-fg">two interest-free payments</b> over your next two paydays — no deposit, and an instant decision at checkout with HappyPay.</>}>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/product-category/tyres" className="btn btn-volt h-12 px-6">Shop tyres</Link>
            <Link href="/product-category/mag-wheel" className="btn btn-ghost h-12 px-6">Shop mag wheels</Link>
          </div>
        </PageHeader>
      </div>
      <PageExtras page="how-to-apply-for-credit-online" position="top" />

      {/* three pillars */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Bolt, t: "2 payments, 0% interest", s: "Half on your next payday, half on the one after" },
          { icon: Shield, t: "No deposit", s: "Nothing to pay upfront — instant credit decision" },
          { icon: Truck, t: "Your tyres now", s: "We ship as soon as HappyPay approves your order" },
        ].map((f) => (
          <div key={f.t} className="card flex items-start gap-3 p-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt ring-1 ring-line"><f.icon width={22} height={22} /></span>
            <div><div className="font-display text-lg text-fg">{f.t}</div><div className="text-xs text-muted">{f.s}</div></div>
          </div>
        ))}
      </div>

      {/* example */}
      <div className="mt-6 card p-6">
        <h2 className="font-display text-2xl text-volt">How it adds up</h2>
        <p className="mt-2 text-sm text-muted">Example: a set of four tyres for <b className="text-fg">R8 000</b> with free delivery.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-muted">Today</div><div className="font-display text-3xl text-volt">R0</div><div className="text-xs text-muted">no deposit</div></div>
          <div className="rounded-xl border border-line bg-surface p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-muted">Next payday</div><div className="font-display text-3xl text-volt">R4 000</div><div className="text-xs text-muted">50%</div></div>
          <div className="rounded-xl border border-line bg-surface p-4 text-center"><div className="text-xs font-bold uppercase tracking-wide text-muted">Following payday</div><div className="font-display text-3xl text-volt">R4 000</div><div className="text-xs text-muted">50%</div></div>
        </div>
        <p className="mt-3 text-xs text-muted">Pay on time and you pay no interest — the total stays R8 000.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* who can apply */}
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Who can apply?</h2>
          <p className="mt-2 text-sm text-muted">To use HappyPay you need to be:</p>
          <ul className="mt-3 space-y-2">
            {REQUIREMENTS.map((r) => (<li key={r} className="flex items-start gap-2 text-sm text-fg"><span className="text-volt">✓</span> {r}</li>))}
          </ul>
          <p className="mt-4 text-xs text-muted">HappyPay checks your credit record and affordability when you sign up, so approval isn&apos;t guaranteed.</p>
        </div>
        {/* what you need */}
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">What you&apos;ll need</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> Your South African ID number</li>
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> Your basic contact details (email and mobile)</li>
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> A debit or credit card from a South African bank in your name</li>
            <li className="flex items-start gap-2"><span className="text-volt">✓</span> A South African delivery address (or choose fitment at our JHB partner)</li>
          </ul>
          <p className="mt-4 text-xs text-muted">Already have a HappyPay account? You just log in at checkout.</p>
        </div>
      </div>

      {/* steps */}
      <h2 className="mt-12 font-display text-3xl">How to apply at The Tyre Mall</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.t} className="card p-5">
            <div className="flex size-9 items-center justify-center rounded-full bg-volt font-display text-lg text-volt-ink">{i + 1}</div>
            <div className="mt-3 font-display text-lg text-fg">{s.t}</div>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      {/* repayments */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Paying it back</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            <li className="flex items-start gap-2"><span className="text-volt">•</span> 50% is taken on your first payday after you buy, and 50% on the next payday.</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> Payments come off the bank card you registered with HappyPay.</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> Want to settle early? Log in to HappyPay and tap &quot;Pay Now&quot; next to your purchase.</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> You can update your card under &quot;Bank Cards&quot; in your HappyPay dashboard.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-2xl text-volt">Good to know</h2>
          <ul className="mt-3 space-y-2 text-sm text-fg">
            <li className="flex items-start gap-2"><span className="text-volt">•</span> No interest and no deposit when you pay on time.</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> Missed payments: HappyPay retries and charges a late fee of R100 per week (up to R300 per missed payment).</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> Your first purchase uses your starting limit; paying on time can grow it.</li>
            <li className="flex items-start gap-2"><span className="text-volt">•</span> Returns follow our <Link href="/returns" className="font-semibold text-volt hover:underline">returns policy</Link> — approved refunds are paid back via HappyPay.</li>
          </ul>
        </div>
      </div>

      {/* FAQ */}
      <h2 className="mt-12 font-display text-3xl">HappyPay questions</h2>
      <div className="mt-5 space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-fg">
              {f.q}<span className="text-volt transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted">{f.a}</p>
          </details>
        ))}
      </div>

      {/* help */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-display text-xl">Questions about your order?</h2>
          <p className="mt-2 text-sm text-muted">Call <a href={`tel:${SHOP_PHONE_TEL}`} className="font-semibold text-volt">{SHOP_PHONE_DISPLAY}</a> or email <a href={`mailto:${SHOP_EMAIL}`} className="font-semibold text-volt">{SHOP_EMAIL}</a> (Mon–Fri 8:00–17:00, Sat 8:00–13:00).</p>
        </div>
        <div className="card p-6">
          <h2 className="font-display text-xl">Questions about your HappyPay account?</h2>
          <p className="mt-2 text-sm text-muted">Email <a href="mailto:support@happypay.co.za" className="font-semibold text-volt">support@happypay.co.za</a> or <a href="https://wa.me/27648651831" target="_blank" rel="noopener" className="font-semibold text-volt">WhatsApp HappyPay</a>. More at <a href="https://happypay.co.za/faqs" target="_blank" rel="noopener" className="font-semibold text-volt">happypay.co.za</a>.</p>
        </div>
      </div>

      <PageExtras page="how-to-apply-for-credit-online" position="bottom" />

      <p className="mt-8 text-xs text-faint">HappyPay is a credit service provided by Happy Pay, subject to its own terms, credit checks and affordability assessment. Information on this page is a summary of HappyPay&apos;s published terms and FAQs and may change — see happypay.co.za for the latest.</p>
    </div>
  );
}
