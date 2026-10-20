import Image from "next/image";
import type { Metadata } from "next";
import { getSettings, currentYear } from "@/lib/settings";
import { Phone } from "@/components/icons";
import { WhatsAppGateButton } from "@/components/WhatsAppGate";

export const metadata: Metadata = {
  title: "Coming soon — The Tyre Mall",
  robots: { index: false, follow: false },
};
export const instant = false;

export default async function Maintenance() {
  const [s, year] = await Promise.all([getSettings(), currentYear()]);
  const phoneTel = s.contact.phoneTel || "0780088788";
  const phoneDisplay = s.contact.phoneDisplay || "078 0088 788";

  return (
    // Fixed, opaque, top of the stack — covers the site chrome entirely.
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-auto bg-ink px-6 py-12 text-center">
      <div className="max-w-lg">
        <Image src="/brand/logo-real.webp" alt="The Tyre Mall" width={260} height={78} className="mx-auto h-auto w-[220px]" priority />
        <span className="mt-8 inline-block badge badge-volt">COMING SOON</span>
        <h1 className="mt-4 font-display text-4xl sm:text-5xl">{s.maintenance.heading}</h1>
        <p className="mt-4 text-pretty text-muted">{s.maintenance.message}</p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={`tel:${phoneTel}`} className="btn btn-volt">
            <Phone width={16} height={16} /> {phoneDisplay}
          </a>
          <WhatsAppGateButton message="Hi The Tyre Mall! I'd like some help with tyres." lead={{ source: "whatsapp-chat" }} className="btn btn-ghost">
            WhatsApp us
          </WhatsAppGateButton>
        </div>

        <p className="mt-10 text-xs text-faint">© {year} The Tyre Mall · SA&apos;s Largest Online Tyre Supplier</p>
      </div>
    </div>
  );
}
