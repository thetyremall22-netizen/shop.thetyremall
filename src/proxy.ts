import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { geoVerdict, visitorIp } from "@/lib/geo";
import { SHOP_EMAIL, SHOP_PHONE_DISPLAY, SHOP_PHONE_TEL } from "@/lib/shop-config";

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

function flagPath(name: string): string {
  const raw = (process.env.DATABASE_URL || "file:.data/ttm.db").replace(/^file:/, "");
  if (raw === ":memory:" || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return path.join(process.cwd(), ".data", name);
  }
  return path.join(path.dirname(raw) || ".", name);
}
const maintenanceFlagPath = () => flagPath("maintenance.flag");

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

// "South Africa only" (Admin → Settings). ON unless the flag file says "0", so
// the protection is in place from the first start after deploying.
let saCache = { on: true, at: 0 };
function saOnlyOn(): boolean {
  if (Date.now() - saCache.at < TTL) return saCache.on;
  let on = true;
  try { on = fs.readFileSync(flagPath("sa-only.flag"), "utf8").trim() !== "0"; } catch { on = true; }
  saCache = { on, at: Date.now() };
  return on;
}

// Never country-blocked: payment confirmations (PayFast/HappyPay servers),
// scheduled jobs, and the admin API (it has its own sign-in).
const GEO_EXEMPT = /^\/api\/(payfast|happypay|cron|admin)(\/|$)/;

/** A real (signed, unexpired) staff session — not just a cookie with the right
 *  name, which a visitor could set to get round the country block. */
function isStaffSession(tok: string | undefined): boolean {
  const secret = process.env.SESSION_SECRET;
  if (!tok || !secret) return false;
  const parts = tok.split(".");
  if (parts.length !== 3) return false;
  const [sub, expS, mac] = parts;
  const exp = Number(expS);
  if (!sub || !exp || exp < Date.now() || !mac) return false;
  const expected = crypto.createHmac("sha256", secret).update(`admin.${sub}.${exp}`).digest("hex");
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

function blockedResponse(api: boolean): NextResponse {
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex" };
  if (api) return NextResponse.json({ error: "Sorry — The Tyre Mall only sells and delivers within South Africa." }, { status: 403, headers });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>South Africa only — The Tyre Mall</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#e7e9ec;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:24px}main{max-width:460px}img{height:56px;width:auto}h1{font-size:28px;margin:22px 0 10px;letter-spacing:.3px}p{color:#a3a9b1;line-height:1.6;margin:0 0 12px}a{color:#8ac53f;font-weight:700;text-decoration:none}small{display:block;margin-top:28px;color:#5d646d;font-size:11px}small a{color:#5d646d;font-weight:400}</style></head>
<body><main><img src="/brand/logo.png" alt="The Tyre Mall"><h1>We only sell in South Africa</h1>
<p>The Tyre Mall sells and delivers tyres and mag wheels within South Africa only, so our online shop isn't available in your country.</p>
<p>In South Africa but seeing this? Please switch off any VPN or proxy and try again, or contact us on <a href="tel:${SHOP_PHONE_TEL}">${SHOP_PHONE_DISPLAY}</a> or <a href="mailto:${SHOP_EMAIL}">${SHOP_EMAIL}</a>.</p>
<small><a href="https://db-ip.com" rel="noopener">IP Geolocation by DB-IP</a></small></main></body></html>`;
  return new NextResponse(html, { status: 403, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
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

  // South Africa only: everyone else gets a short "we only sell in SA" page
  // (Google/Bing/AI crawlers and signed-in staff are let through).
  const p = req.nextUrl.pathname;
  const api = p.startsWith("/api/");
  if (!GEO_EXEMPT.test(p) && saOnlyOn() && geoVerdict(visitorIp(req.headers)) === "blocked" && !isStaffSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return blockedResponse(api);
  }
  // The coming-soon gate below is for pages only.
  if (api) return NextResponse.next();

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

// Pages and /api (for the country check). Never /_next, /admin, or any path
// with a file extension (static assets such as product images).
export const config = {
  matcher: ["/((?!_next|admin|.*\\..*).*)"],
};
