import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Pin, Bolt } from "@/components/icons";

export const metadata: Metadata = {
  title: "Free Delivery Areas — Nationwide Across South Africa",
  description:
    "The Tyre Mall delivers tyres and mag wheels free on 2+ tyres to every province in South Africa — Gauteng, Western Cape, KwaZulu-Natal, Eastern Cape and more. See the towns and cities we cover.",
};

const REGIONS: { province: string; hubs: string[] }[] = [
  {
    province: "Gauteng",
    hubs: ["Johannesburg", "Pretoria", "Sandton", "Midrand", "Soweto", "Randburg", "Roodepoort", "Centurion", "Boksburg", "Benoni", "Kempton Park", "Germiston", "Krugersdorp", "Vereeniging", "Vanderbijlpark", "Springs", "Alberton", "Edenvale"],
  },
  {
    province: "Western Cape",
    hubs: ["Cape Town", "Bellville", "Stellenbosch", "Paarl", "Somerset West", "George", "Mossel Bay", "Worcester", "Hermanus", "Knysna", "Oudtshoorn", "Vredenburg", "Malmesbury"],
  },
  {
    province: "KwaZulu-Natal",
    hubs: ["Durban", "Pietermaritzburg", "Umhlanga", "Ballito", "Richards Bay", "Newcastle", "Pinetown", "Port Shepstone", "Ladysmith", "Empangeni", "Margate"],
  },
  {
    province: "Eastern Cape",
    hubs: ["Gqeberha (Port Elizabeth)", "East London", "Mthatha", "Queenstown (Komani)", "Uitenhage (Kariega)", "Grahamstown (Makhanda)", "King William's Town", "Jeffreys Bay"],
  },
  {
    province: "Free State",
    hubs: ["Bloemfontein", "Welkom", "Bethlehem", "Sasolburg", "Kroonstad", "Parys", "Harrismith", "Phuthaditjhaba"],
  },
  {
    province: "Mpumalanga",
    hubs: ["Nelspruit (Mbombela)", "Witbank (eMalahleni)", "Secunda", "Middelburg", "Ermelo", "Standerton", "Barberton", "White River"],
  },
  {
    province: "Limpopo",
    hubs: ["Polokwane", "Tzaneen", "Mokopane", "Bela-Bela", "Thohoyandou", "Lephalale", "Musina", "Phalaborwa"],
  },
  {
    province: "North West",
    hubs: ["Rustenburg", "Potchefstroom", "Klerksdorp", "Mahikeng", "Brits", "Lichtenburg", "Vryburg"],
  },
  {
    province: "Northern Cape",
    hubs: ["Kimberley", "Upington", "Springbok", "Kuruman", "De Aar", "Kathu"],
  },
];

export default function DeliveryAreasPage() {
  return (
    <div className="container-x py-10 lg:py-14">
      <div className="max-w-2xl">
        <span className="eyebrow">Nationwide — every province</span>
        <h1 className="skew-italic mt-1 font-display text-5xl leading-[0.9] sm:text-7xl">
          <span className="text-chrome">FREE DELIVERY</span> <span className="text-volt-grad">AREAS</span>
        </h1>
        <p className="mt-4 text-base text-muted sm:text-lg">
          We deliver tyres and mag wheels to <strong className="text-fg">every corner of South Africa</strong>.
          Order 2 or more tyres and delivery is <strong className="text-fg">free</strong> — straight to your
          door or to a partner fitment centre near you.
        </p>
      </div>

      {/* highlights */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Truck, t: "Free on 2+ tyres", s: "To any address in SA" },
          { icon: Bolt, t: "Fast dispatch", s: "Most orders ship in 24–48h" },
          { icon: Pin, t: "Fitment option", s: "Deliver to a partner centre" },
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

      {/* regions */}
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {REGIONS.map((r) => (
          <div key={r.province} className="card p-5">
            <div className="flex items-center gap-2">
              <Pin width={16} height={16} className="text-volt" />
              <h2 className="font-display text-xl text-fg">{r.province}</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.hubs.map((h) => (
                <span key={h} className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                  {h}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 max-w-3xl text-sm text-muted">
        Don&apos;t see your town? We still deliver there. Our courier network reaches small towns, farms and
        rural addresses nationwide — if a road can get there, so can your tyres. Delivery timelines to
        outlying areas may be a day or two longer.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/shop" className="btn btn-volt h-12 px-6">Shop tyres now</Link>
        <Link href="/contact" className="btn btn-ghost h-12 px-6">Ask about your area</Link>
      </div>
    </div>
  );
}
