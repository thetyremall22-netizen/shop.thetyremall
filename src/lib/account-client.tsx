"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// Client zone state for the storefront: who's signed in and their wishlist.
// Only asks the server when the readable "ttm_cz" flag cookie is present, so
// visitors who never signed in don't make an extra request on every page.

export interface AccountInfo {
  firstName: string; lastName: string; email: string; phone: string;
  address: { street: string; suburb: string; city: string; province: string; postalCode: string };
}

interface AccountContextValue {
  ready: boolean;
  signedIn: boolean;
  customer: AccountInfo | null;
  wishlist: string[];
  has: (slug: string) => boolean;
  /** Add/remove; when signed out, goes to the sign-in page and saves it after. */
  toggle: (slug: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

const flagged = () => typeof document !== "undefined" && /(?:^|;\s*)ttm_cz=1/.test(document.cookie);

export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [customer, setCustomer] = useState<AccountInfo | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!flagged()) { setCustomer(null); setWishlist([]); setReady(true); return; }
    try {
      const d = await fetch("/api/account/me", { cache: "no-store" }).then((r) => r.json());
      setCustomer(d.signedIn ? d.customer : null);
      setWishlist(d.signedIn ? d.wishlist ?? [] : []);
    } catch { /* keep what we had */ }
    setReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  const toggle = useCallback(async (slug: string) => {
    // Signed out (no flag cookie): sign in first. If the flag is there but the
    // account hasn't loaded yet, just try — a 401 sends them to sign in.
    if (!customer && !flagged()) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/account?next=${encodeURIComponent(next)}&wish=${encodeURIComponent(slug)}`);
      return;
    }
    const adding = !wishlist.includes(slug);
    setWishlist((w) => (adding ? [slug, ...w] : w.filter((s) => s !== slug))); // optimistic
    try {
      const res = await fetch("/api/account/wishlist", { method: adding ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.wishlist)) setWishlist(d.wishlist);
      else {
        setWishlist((w) => (adding ? w.filter((s) => s !== slug) : [slug, ...w]));
        if (res.status === 401) { setCustomer(null); router.push(`/account?wish=${encodeURIComponent(slug)}`); }
        else if (d.error) alert(d.error);
      }
    } catch {
      setWishlist((w) => (adding ? w.filter((s) => s !== slug) : [slug, ...w]));
    }
  }, [customer, wishlist, router]);

  return (
    <AccountContext.Provider value={{ ready, signedIn: !!customer, customer, wishlist, has: (s) => wishlist.includes(s), toggle, refresh }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
