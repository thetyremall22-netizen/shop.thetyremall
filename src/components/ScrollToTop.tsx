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
    const toTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };
    toTop();
    // Re-run after paint and a short tick so streamed / partially-prerendered
    // content (e.g. the checkout page) can't leave the view scrolled down.
    const raf = requestAnimationFrame(toTop);
    const t = setTimeout(toTop, 80);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [pathname]);
  return null;
}
