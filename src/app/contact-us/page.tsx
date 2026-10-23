import type { Metadata } from "next";
import { PageHeader, PageExtras } from "@/components/PageContent";
import { pageMetadata } from "@/lib/page-content";
import { ContactForm } from "@/components/ContactForm";
import { Pin, Truck } from "@/components/icons";

const BASE_META: Metadata = {
  title: "Contact us",
  description: "Get in touch with The Tyre Mall — call, WhatsApp or email. Nationwide delivery and Johannesburg fitment.",
  // Same address as the old site (Google Ads link here); /contact forwards here.
  alternates: { canonical: "/contact-us/" },
};

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("contact", BASE_META);
}

const SOCIALS = [
  { label: "Facebook", href: "https://facebook.com/theetyremall" },
  { label: "Instagram", href: "https://instagram.com/thetyremall.co.za" },
  { label: "LinkedIn", href: "https://linkedin.com/company/the-tyre-mall" },
  { label: "YouTube", href: "https://youtube.com/@thetyremall" },
  { label: "TikTok", href: "https://tiktok.com/@thetyremallsa" },
];

export default function ContactPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      {/* header */}
      <PageHeader page="contact" eyebrow="We're here to help" silver="GET IN" green="TOUCH"
        intro={<>Questions about tyres, fitment, delivery or an existing order? Our team answers fast —
          call, WhatsApp, email or drop us a message below.</>} />
      <PageExtras page="contact" position="top" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* left: details */}
        <div className="space-y-4">
          <InfoCard icon={<Phone />} title="Call us" lines={["078 0088 788"]} note="Mon–Fri 8:00–17:00 · Sat 8:00–13:00" href="tel:0780088788" />
          <InfoCard icon={<Whatsapp />} title="WhatsApp" lines={["Chat to us instantly"]} note="Tap to open WhatsApp" href="https://wa.link/k33vfb" accent />
          <InfoCard icon={<Mail />} title="Email" lines={["shop@thetyremall.co.za"]} note="We reply within 1 business day" href="mailto:shop@thetyremall.co.za" />
          <InfoCard icon={<Pin width={22} height={22} />} title="Visit / collect" lines={["31 Heronmere Road", "Reuven, Johannesburg, 2091"]} href="https://maps.google.com/?q=31+Heronmere+Road+Reuven+Johannesburg" />

          <div className="card p-5">
            <div className="flex items-center gap-2 text-volt"><Truck width={18} height={18} /><span className="font-display text-lg text-fg">FREE delivery nationwide</span></div>
            <p className="mt-1.5 text-sm text-muted">On 2 or more tyres, anywhere in South Africa. Optional fitment at our Johannesburg partner centres.</p>
          </div>

          <div className="card p-5">
            <span className="eyebrow">Follow The Tyre Mall</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:border-volt hover:text-volt">
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* right: form + map */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-display text-2xl">Send us a message</h2>
            <p className="mt-1 text-sm text-muted">Fill this in and we&apos;ll get right back to you.</p>
            <div className="mt-5"><ContactForm /></div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <iframe
              title="The Tyre Mall location"
              src="https://www.google.com/maps?q=31%20Heronmere%20Road%2C%20Reuven%2C%20Johannesburg%2C%202091&output=embed"
              className="h-64 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
      <PageExtras page="contact" position="bottom" className="mt-10" />
    </div>
  );
}

function InfoCard({ icon, title, lines, note, href, accent }: { icon: React.ReactNode; title: string; lines: string[]; note?: string; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`glow-hover flex items-start gap-4 rounded-2xl border p-5 transition-colors ${accent ? "border-pay/40 bg-pay/5" : "border-line bg-surface"}`}>
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${accent ? "bg-pay/15 text-pay" : "bg-volt/10 text-volt"}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">{title}</div>
        {lines.map((l) => <div key={l} className="font-semibold text-fg">{l}</div>)}
        {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
      </div>
    </div>
  );
  return href ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="block">{inner}</a> : inner;
}

function Phone() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function Mail() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>;
}
function Whatsapp() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.12-2.9-6.99A9.82 9.82 0 0 0 12.04 2zm5.8 14.17c-.25.69-1.44 1.32-1.98 1.36-.53.04-.53.42-3.34-.7-2.81-1.12-4.6-3.98-4.74-4.17-.14-.19-1.13-1.5-1.13-2.87 0-1.36.71-2.03.96-2.31.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.25.6.85 2.07.92 2.22.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.3.37-.42.5-.14.14-.29.29-.12.57.17.28.74 1.22 1.59 1.98 1.1.98 2.02 1.28 2.3 1.42.28.14.44.12.6-.07.17-.19.69-.8.87-1.08.18-.28.37-.23.62-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.32.07.12.07.65-.18 1.34z"/></svg>;
}
