"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Shown only to logged-in staff while "Coming soon" is switched on, because
 *  staff still see the real site (visitors see the coming-soon page). */
export function AdminGateNotice() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(/(?:^|;\s*)ttm_gate_on=1/.test(document.cookie)); }, [pathname]);
  if (!on || pathname === "/maintenance") return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-400 px-3 py-1.5 text-center text-xs font-bold text-black shadow">
      <span>Coming soon is ON: visitors see the coming-soon page. You see the real site because you&apos;re logged in to the admin.</span>
      <Link href="/maintenance" className="rounded bg-black px-2 py-0.5 text-amber-300 hover:bg-black/80">See what visitors see</Link>
      <Link href="/admin/settings" className="underline">Turn off</Link>
    </div>
  );
}
