"use client";

import { useEffect } from "react";
import { trackContactClick } from "@/lib/ecommerce-tracking";

// Reports taps on phone numbers, WhatsApp links and email addresses anywhere on
// the site to Google Analytics / Ads (click_to_call, whatsapp_click, email_click).
export function ContactClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      const where = window.location.pathname;
      if (href.startsWith("tel:")) trackContactClick("phone", where);
      else if (/wa\.me|whatsapp\.com/i.test(href)) trackContactClick("whatsapp", where);
      else if (href.startsWith("mailto:")) trackContactClick("email", where);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
