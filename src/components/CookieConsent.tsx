"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_ENABLED } from "@/lib/analytics";

const STORAGE_KEY = "ttm-consent";

type Choice = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function applyConsent(choice: Choice) {
  const v = choice === "granted" ? "granted" : "denied";
  // Fall back to a raw dataLayer push if the gtag shim isn't ready yet.
  const push = (args: unknown[]) => {
    if (typeof window.gtag === "function") window.gtag(...args);
    else (window.dataLayer = window.dataLayer || []).push(args);
  };
  push([
    "consent",
    "update",
    {
      ad_storage: v,
      ad_user_data: v,
      ad_personalization: v,
      analytics_storage: v,
      functionality_storage: v,
      personalization_storage: v,
      security_storage: v,
    },
  ]);
}

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function choose(choice: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      /* private mode — honour the choice for this page view regardless */
    }
    applyConsent(choice);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[9998] px-4 pb-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-surface-2/95 p-5 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-muted">
          We use cookies to run The Tyre Mall, understand how the site is used and
          to improve your experience and our advertising. You can accept all
          cookies or keep only the ones the store needs to work.{" "}
          <a href="/terms" className="font-semibold text-volt underline-offset-2 hover:underline">
            Terms &amp; privacy
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => choose("denied")}
            className="btn btn-ghost px-5 text-sm"
          >
            Only necessary
          </button>
          <button
            onClick={() => choose("granted")}
            className="btn btn-volt px-5 text-sm"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
