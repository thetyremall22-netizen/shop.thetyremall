import type { Metadata } from "next";
import Link from "next/link";
import { FITMENT_STORES, WHATSAPP_LINK, SHOP_PHONE_DISPLAY } from "@/lib/shop-config";
import { StoreCallLink } from "@/components/StoreCallLink";
import { Pin, Truck, Bolt } from "@/components/icons";

export const metadata: Metadata = {
  title: "Our Stores & Fitment Centres",
  description:
    "The Tyre Mall partner fitment centres across Johannesburg — Supa Quick, Dunlop Zone and Hi-Q. Addresses and phone numbers for Randburg, Selby, Boksburg, Midrand, Booysens and the CBD.",
  alternates: { canonical: "/stores" },
};

export default function StoresPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      <div className="max-w-2xl">
        <span className="eyebrow">Buy online · fit in Joburg</span>
        <h1 className="skew-italic mt-1 font-display text-5xl leading-[0.9] sm:text-7xl">
          <span className="text-chrome">OUR</span> <span className="text-volt-grad">STORES</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          Order online and have your tyres fitted at one of our trusted partner centres across Johannesburg.
          Each centre sets and charges its own fitment price. Phone ahead to book.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FITMENT_STORES.map((s) => (
          <div key={s.id} className="card glow-hover flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-xl text-fg">{s.name}</h2>
              <span className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-bold text-muted">{s.area}</span>
            </div>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <Pin width={16} height={16} className="mt-0.5 shrink-0 text-volt" /> {s.address}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
              <StoreCallLink storeId={s.id} storeName={s.name} phone={s.phone} phoneTel={s.phoneTel} />
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(s.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-volt hover:underline"
              >
                Directions →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* help strip */}
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Truck, t: "Free delivery", s: "On 2+ tyres, nationwide" },
          { icon: Bolt, t: "Pay later", s: "0% with HappyPay & Mobicred" },
          { icon: Pin, t: "Expert fitment", s: "At the centre nearest you" },
        ].map((f) => (
          <div key={f.t} className="card flex items-center gap-3 p-5">
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

      <div className="mt-10 rounded-2xl border border-line bg-ink-2 p-8 text-center">
        <h2 className="font-display text-2xl sm:text-3xl">Not sure which centre is best?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Call us on {SHOP_PHONE_DISPLAY} (Mon–Fri 8am–5pm) or WhatsApp us and we&apos;ll point you to the closest fitment partner.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="btn h-12 border border-[#25D366]/60 bg-[#25D366]/10 px-6 text-[#25D366] hover:bg-[#25D366]/20">
            WhatsApp us
          </a>
          <Link href="/shop" className="btn btn-volt h-12 px-6">Shop tyres</Link>
        </div>
      </div>
    </div>
  );
}
