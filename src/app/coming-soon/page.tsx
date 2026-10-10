import Link from "next/link";
import type { Metadata } from "next";
import { Bolt, Phone } from "@/components/icons";

export const metadata: Metadata = { title: "Coming soon" };
export const instant = false;

export default async function ComingSoon({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const sp = await searchParams;
  const label = sp.for ?? "This section";

  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <span className="badge badge-volt">COMING SOON</span>
        <h1 className="mt-4 font-display text-5xl">{label}</h1>
        <p className="mt-3 text-muted">
          We&apos;re stocking this up. In the meantime, our team can help you directly — give us a call and we&apos;ll sort you out.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="tel:0780088788" className="btn btn-volt">
            <Phone width={16} height={16} /> 078 0088 788
          </a>
          <Link href="/shop" className="btn btn-ghost">
            <Bolt width={16} height={16} /> Shop tyres & wheels
          </Link>
        </div>
      </div>
    </div>
  );
}
