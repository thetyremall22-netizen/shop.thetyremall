import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Maintenance / "coming soon" gate. When the admin toggles it on, public
// storefront pages are rewritten to /maintenance. Admin (/admin, /api) and
// static assets are never gated, and anyone with an admin session cookie
// bypasses it so they can preview the real site.
//
// The admin Settings save writes the flag to a plain file next to the DB
// (.data/maintenance.flag → "1"/"0"). In Next 16 the proxy runs in the Node.js
// runtime, so it reads that file straight off disk. We do NOT self-fetch
// /api/maintenance: behind Nginx Unit the worker has no localhost port to reach
// itself on, so that round-trip failed and — failing open — the gate never
// activated. A direct file read has no network, no SSL, and can't time out.

const ADMIN_COOKIE = "ttm_admin";
let cache = { on: false, at: 0 };
const TTL = 10_000; // ms — re-read the flag file at most this often per worker

function maintenanceFlagPath(): string {
  const raw = (process.env.DATABASE_URL || "file:.data/ttm.db").replace(/^file:/, "");
  if (raw === ":memory:" || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return path.join(process.cwd(), ".data", "maintenance.flag");
  }
  return path.join(path.dirname(raw) || ".", "maintenance.flag");
}

function maintenanceOn(): boolean {
  if (Date.now() - cache.at < TTL) return cache.on;
  let on = false;
  try {
    on = fs.readFileSync(maintenanceFlagPath(), "utf8").trim() === "1";
  } catch {
    on = false; // no flag file / unreadable → gate off (fail open, site stays up)
  }
  cache = { on, at: Date.now() };
  return on;
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

  // Admins preview the real site even while the gate is on. A small readable
  // cookie tells the storefront to show them a "Coming soon is ON" bar.
  if (req.cookies.get(ADMIN_COOKIE)) {
    const res = NextResponse.next();
    if (maintenanceOn()) res.cookies.set("ttm_gate_on", "1", { path: "/", sameSite: "lax", maxAge: 300 });
    else if (req.cookies.get("ttm_gate_on")) res.cookies.delete("ttm_gate_on");
    return res;
  }

  // Gate with a temporary REDIRECT, not a rewrite. When the server runs with
  // HOSTNAME=127.0.0.1 behind an HTTPS proxy, Next treats a rewrite as an
  // external URL and proxies it to itself over HTTPS, which fails with a 500.
  // A same-host redirect is relativized to "/maintenance" and always works.
  const on = maintenanceOn();
  const onGatePage = req.nextUrl.pathname === "/maintenance";
  if (on && !onGatePage) return redirectTo(req, "/maintenance");
  // Gate switched off: send anyone still sitting on the gate page home.
  if (!on && onGatePage) return redirectTo(req, "/");
  return NextResponse.next();
}

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url, 307);
  res.headers.set("cache-control", "no-store");
  return res;
}

// Gate page routes only — never /api, /_next, /admin, or any path with a file
// extension (static assets).
export const config = {
  matcher: ["/((?!api|_next|admin|.*\\..*).*)"],
};
