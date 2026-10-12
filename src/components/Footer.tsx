import Link from "next/link";
import Image from "next/image";
import { Logo } from "./Logo";
import { Truck, Shield, Bolt, Phone, Pin } from "./icons";
import { NAV_PRIMARY } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-ink-2">
      {/* trust strip */}
      <div className="border-b border-line">
        <div className="container-x grid grid-cols-2 gap-px lg:grid-cols-4">
          {[
            { icon: Truck, t: "Free Delivery", s: "On 2+ tyres, nationwide" },
            { icon: Bolt, t: "Pay Later", s: "0% with HappyPay & Mobicred" },
            { icon: Shield, t: "Road Hazard Cover", s: "Optional 12-month protection" },
            { icon: Pin, t: "JHB Fitment", s: "Book at a partner centre" },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-3 py-5">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-volt ring-1 ring-line">
                <f.icon width={22} height={22} />
              </div>
              <div>
                <div className="text-sm font-bold text-fg">{f.t}</div>
                <div className="text-xs text-muted">{f.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="container-x grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">
            South Africa's largest online tyre supplier. Quality tyres, mag wheels and expert service — delivered.
          </p>
          <a href="tel:0780088788" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-fg">
            <Phone width={16} height={16} className="text-volt" /> 078 0088 788
          </a>
          <Image src="/brand/springboks.png" alt="Proud supporters of the Springboks" width={300} height={120} className="mt-6 h-16 w-auto" />
        </div>

        <div>
          <h4 className="eyebrow mb-3">Shop</h4>
          <ul className="space-y-2 text-sm text-muted">
            {NAV_PRIMARY.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/shop?category=${c.slug}`} className="hover:text-volt">{c.label} Tyres</Link>
              </li>
            ))}
            <li><Link href="/shop?type=wheel" className="hover:text-volt">Mag Wheels</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-3">Help</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/faq" className="hover:text-volt">FAQ</Link></li>
            <li><Link href="/returns" className="hover:text-volt">Returns &amp; Refunds</Link></li>
            <li><Link href="/delivery-areas" className="hover:text-volt">Free delivery areas</Link></li>
            <li><Link href="/stores" className="hover:text-volt">Fitment centres</Link></li>
            <li><Link href="/radar-protect" className="hover:text-volt">Radar Protect</Link></li>
            <li><Link href="/compare" className="hover:text-volt">Compare tyres</Link></li>
            <li><Link href="/contact" className="hover:text-volt">Contact us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-3">Company</h4>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/about" className="hover:text-volt">About us</Link></li>
            <li><Link href="/about#team" className="hover:text-volt">Meet the team</Link></li>
            <li><Link href="/blog" className="hover:text-volt">Blog</Link></li>
            <li><Link href="/terms" className="hover:text-volt">Terms &amp; Conditions</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="eyebrow mb-3">Visit us</h4>
          <p className="text-sm text-muted">
            <Pin width={13} height={13} className="mr-1 inline text-volt" />
            31 Heronmere Road, Reuven, Johannesburg, 2091
          </p>
          <a href="mailto:shop@thetyremall.co.za" className="mt-3 block text-sm text-muted hover:text-volt">shop@thetyremall.co.za</a>
          <p className="mt-3 text-xs text-muted">Mon–Fri 8:00–17:00 · Sat 8:00–13:00</p>
        </div>
      </div>

      {/* accepted payments */}
      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center gap-3 py-6">
          <span className="eyebrow">Secure payment &amp; buy-now-pay-later</span>
          <div className="w-full max-w-3xl rounded-xl bg-white p-3">
            <Image src="/brand/payments.png" alt="We accept PayFast, Instant EFT, RCS, RMI, Zapper, Samsung Pay, Apple Pay, Mastercard, Visa and Mobicred" width={1920} height={120} className="h-auto w-full" />
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-faint sm:flex-row">
          <p>© {2026} The Tyre Mall. All rights reserved.</p>
          <p>Demo build — design preview. Prices & stock from live catalogue.</p>
        </div>
      </div>
    </footer>
  );
}
