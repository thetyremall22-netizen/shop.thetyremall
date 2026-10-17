import { NextRequest, NextResponse } from "next/server";

// Maintenance / "coming soon" gate. When the admin toggles it on, public
// storefront pages are rewritten to /maintenance. Admin (/admin, /api) and
// static assets are never gated, and anyone with an admin session cookie
// bypasses it so they can preview the real site.
//
// The flag lives in the DB (admin-toggleable). Middleware can't read the DB
// directly, so it fetches the cached /api/maintenance flag and caches the
// result in-module for a few seconds to avoid a request per navigation.

const ADMIN_COOKIE = "ttm_admin";
let cache = { on: false, at: 0 };
const TTL = 15_000; // ms

async function maintenanceOn(origin: string): Promise<boolean> {
  if (Date.now() - cache.at < TTL) return cache.on;
  try {
    const res = await fetch(new URL("/api/maintenance", origin), { headers: { "x-ttm-mw": "1" } });
    const data = (await res.json()) as { enabled?: boolean };
    cache = { on: !!data.enabled, at: Date.now() };
  } catch {
    cache = { on: false, at: Date.now() }; // fail open
  }
  return cache.on;
}

// Legacy WordPress / WooCommerce paths — this is a Next.js app, there is no
// WP here. A stale Java integration polls /wp-json/wc/v3/products thousands of
// times a day; answer those (and other wp-* probes) with a cheap, cacheable
// 410 Gone before any DB read or page render, so the flood costs almost nothing
// and well-behaved clients stop retrying.
const LEGACY_WP = /^\/(wp-json|wp-admin|wp-includes|wp-content|wp-login|wp-cron|wp-config|wordpress|xmlrpc)/i;

export async function proxy(req: NextRequest) {
  if (LEGACY_WP.test(req.nextUrl.pathname) || req.nextUrl.pathname.startsWith("/wp-")) {
    return new NextResponse("Gone", { status: 410, headers: { "cache-control": "public, max-age=86400" } });
  }

  // Admins preview the real site even while the gate is on.
  if (req.cookies.get(ADMIN_COOKIE)) return NextResponse.next();

  if (await maintenanceOn(req.nextUrl.origin)) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

// Gate page routes only — never /api, /_next, /admin, the gate page itself,
// or any path with a file extension (static assets).
export const config = {
  matcher: ["/((?!api|_next|admin|maintenance|.*\\..*).*)"],
};
