"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Resets scroll to the top whenever the route (pathname) changes. Works around
 * cases where the App Router's streamed/partial-prerendered pages keep the
 * previous page's scroll position on client-side navigation.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}
