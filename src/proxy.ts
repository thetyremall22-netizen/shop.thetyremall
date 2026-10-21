import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { geoVerdict, visitorIp, blockedCountryOf } from "@/lib/geo";
import { DEFAULT_BLOCKED } from "@/lib/geo-countries";
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

// Visitor country rules (Admin → Settings → Visitors outside South Africa),
// mirrored to .data/geo.json by the Settings save. Defaults when that file
// doesn't exist yet: only South Africans can buy; spam countries fully blocked.
type GeoCfg = { saOnly: boolean; block: string[] };
let geoCache: { cfg: GeoCfg; at: number } = { cfg: { saOnly: true, block: DEFAULT_BLOCKED }, at: 0 };
function geoConfig(): GeoCfg {
  if (Date.now() - geoCache.at < TTL) return geoCache.cfg;
  let cfg: GeoCfg = { saOnly: true, block: DEFAULT_BLOCKED };
  try {
    const j = JSON.parse(fs.readFileSync(flagPath("geo.json"), "utf8")) as Partial<GeoCfg>;
    cfg = { saOnly: j.saOnly !== false, block: Array.isArray(j.block) ? j.block.map(String) : DEFAULT_BLOCKED };
  } catch { /* no file yet → defaults */ }
  geoCache = { cfg, at: Date.now() };
  return cfg;
}
/** Buying requests refused for visitors outside South Africa. */
const PURCHASE_API = /^\/api\/checkout(\/|$)/;
/** Enquiries (WhatsApp/quote leads, contact form, Tyrone/call logging) refused too. */
const ENQUIRY_API = /^\/api\/(lead|contact|enquiry)(\/|$)/;
const GEO_COOKIE = "ttm_geo"; // readable: "out" = browse only; "near" = neighbouring country (SA delivery only)

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

/** Checkout refused for someone outside South Africa (they can still browse). */
function purchaseRefused(): NextResponse {
  return NextResponse.json(
    { error: "Sorry, you're not able to purchase from your country. The Tyre Mall only sells and delivers within South Africa." },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

/** Enquiry refused for someone outside South Africa. */
function enquiryRefused(): NextResponse {
  return NextResponse.json(
    { error: "Sorry, we do not take enquiries from outside South Africa. The Tyre Mall only sells and delivers within South Africa." },
    { status: 403, headers: { "cache-control": "no-store" } },
  );
}

/** Fully blocked country (spam). Crawlers are never sent here. */
function blockedResponse(api: boolean): NextResponse {
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex" };
  if (api) return NextResponse.json({ error: "Sorry, we do not allow you to purchase our products as we don't sell to your country." }, { status: 403, headers });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Not available in your country — The Tyre Mall</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#e7e9ec;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:24px}main{max-width:460px}img{height:56px;width:auto}h1{font-size:28px;margin:22px 0 10px;letter-spacing:.3px}p{color:#a3a9b1;line-height:1.6;margin:0 0 12px}a{color:#8ac53f;font-weight:700;text-decoration:none}small{display:block;margin-top:28px;color:#5d646d;font-size:11px}small a{color:#5d646d;font-weight:400}</style></head>
<body><main><img src="/brand/logo.png" alt="The Tyre Mall"><h1>&#9888; Not available in your country</h1>
<p>Sorry, we do not allow you to purchase our products as we don't sell to your country. The Tyre Mall only sells and delivers tyres and mag wheels within South Africa.</p>
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

  // Visitor country rules. Crawlers (Google, Bing, AI), South Africa, local
  // addresses and signed-in staff are never limited.
  const p = req.nextUrl.pathname;
  const api = p.startsWith("/api/");
  let mark: "za" | "near" | "out" = "za";
  if (!GEO_EXEMPT.test(p) && !isStaffSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    const ip = visitorIp(req.headers);
    const verdict = geoVerdict(ip);
    if (verdict === "near") mark = "near"; // neighbouring country: can buy, SA delivery only
    if (verdict === "blocked") {
      const cfg = geoConfig();
      if (blockedCountryOf(ip, cfg.block)) return blockedResponse(api); // spam countries: nothing at all
      if (cfg.saOnly) {
        if (api && PURCHASE_API.test(p)) return purchaseRefused();
        if (api && ENQUIRY_API.test(p)) return enquiryRefused();
        mark = "out"; // can browse, can't buy
      }
    }
  }
  // The coming-soon gate below is for pages only.
  if (api) return NextResponse.next();
  return markVisitor(req, pageGate(req), mark);
}

/** Tell the storefront whether this visitor can buy (only sends the cookie when it changes). */
function markVisitor(req: NextRequest, res: NextResponse, mark: "za" | "near" | "out"): NextResponse {
  if (mark !== "za" && req.cookies.get(GEO_COOKIE)?.value !== mark) res.cookies.set(GEO_COOKIE, mark, { path: "/", sameSite: "lax", maxAge: 3600 });
  else if (mark === "za" && req.cookies.get(GEO_COOKIE)) res.cookies.delete(GEO_COOKIE);
  return res;
}

function pageGate(req: NextRequest): NextResponse {
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
