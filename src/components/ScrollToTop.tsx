"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Resets scroll to the top whenever the route (pathname) changes.
 *
 * The site sets `html { scroll-behavior: smooth }` (nice for in-page anchor
 * links), which turns every programmatic `scrollTo` into an *animated* scroll.
 * On a route change that animation competes with the App Router streaming the
 * new page in, so pages like /checkout could end up showing scrolled down.
 * Here we force an INSTANT jump by briefly disabling smooth behaviour, and
 * repeat after paint so late-streamed content can't leave the view scrolled.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    const toTop = () => {
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto"; // override CSS smooth → instant jump
      window.scrollTo(0, 0);
      html.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      html.style.scrollBehavior = prev;
    };
    toTop();
    // Re-run after paint and a couple of ticks so streamed / partially
    // prerendered content can't leave the view scrolled down.
    const raf = requestAnimationFrame(toTop);
    const t1 = setTimeout(toTop, 60);
    const t2 = setTimeout(toTop, 180);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);
  return null;
}
