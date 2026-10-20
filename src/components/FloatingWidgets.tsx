"use client";

import { usePathname } from "next/navigation";
import { CompareBar } from "./CompareBar";
import { Tyrone } from "./Tyrone";
import { ExitIntentPopup } from "./ExitIntentPopup";

// The compare bar, WhatsApp launcher and "AI Tyre Guy" launcher are storefront
// marketing widgets — they should never appear on the admin panel. Hide them on
// /admin (and its sub-routes) and show them everywhere else.
export function FloatingWidgets() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <>
      <CompareBar />
      <Tyrone />
      <ExitIntentPopup />
    </>
  );
}
