#!/usr/bin/env node
// Builds src/data/geo-allow.json — the addresses allowed to use the shop:
//   • South African IP ranges (DB-IP "IP to Country Lite", CC BY 4.0 —
//     https://db-ip.com — attribution is shown on the "South Africa only" page)
//   • verified search-engine / ads / AI crawlers, from the lists each company
//     publishes (so Google Ads, Merchant Center, Search, Bing, ChatGPT etc. can
//     still read the site).
// Run every month or two, then rebuild:   node scripts/update-geo.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data");
const OUT = path.join(DATA, "geo-allow.json");
// Countries that can be fully blocked from Admin → Settings (address data for
// these is shipped in src/data/geo-block.json). Keep in sync with
// BLOCKABLE_COUNTRIES in src/lib/geo-countries.ts.
const BLOCKABLE = ["CN", "HK", "JP", "TH", "RU", "NG", "ZW", "VN", "IN", "PK", "BD", "ID", "IR", "KP", "BY", "UA", "KH", "MM"];
const OUT_BLOCK = path.join(DATA, "geo-block.json");

const BOT_LISTS = {
  "Googlebot": "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  "Google special crawlers (AdsBot, Merchant/Storebot…)": "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json",
  "Google user-triggered fetchers": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json",
  "Google user-triggered fetchers (Google)": "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
  "Bingbot": "https://www.bing.com/toolbox/bingbot.json",
  "OpenAI search": "https://openai.com/searchbot.json",
  "ChatGPT user": "https://openai.com/chatgpt-user.json",
  "GPTBot": "https://openai.com/gptbot.json",
  "PerplexityBot": "https://www.perplexity.com/perplexitybot.json",
  "Applebot": "https://search.developer.apple.com/applebot.json",
};

// ---- address helpers: IPv4 → number, IPv6 → 32-char hex (compares as text) ----
const v4 = (ip) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
function v6hex(ip) {
  let [head, tail] = ip.includes("::") ? ip.split("::") : [ip, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  // IPv4-mapped tail (::ffff:1.2.3.4)
  const last = (t.length ? t : h)[(t.length ? t : h).length - 1];
  if (last && last.includes(".")) {
    const n = v4(last); const arr = t.length ? t : h;
    arr.splice(arr.length - 1, 1, (n >>> 16).toString(16), (n & 0xffff).toString(16));
  }
  const fill = tail === null ? [] : Array(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((g) => g.padStart(4, "0")).join("").toLowerCase();
}
// IPv6 is stored as its 64-bit network prefix (first 16 hex digits): every
// country/crawler range is at least that wide, and it halves the data size.
const p64 = (hex) => hex.slice(0, 16);
function cidr(prefix) {
  const [ip, bitsS] = prefix.split("/"); const bits = Number(bitsS);
  if (ip.includes(":")) {
    const hex = v6hex(ip); let bin = [...hex].map((c) => parseInt(c, 16).toString(2).padStart(4, "0")).join("");
    const lo = bin.slice(0, bits).padEnd(128, "0"), hi = bin.slice(0, bits).padEnd(128, "1");
    const toHex = (b) => b.match(/.{4}/g).map((x) => parseInt(x, 2).toString(16)).join("");
    return { v: 6, s: p64(toHex(lo)), e: p64(toHex(hi)) };
  }
  const n = v4(ip), size = 2 ** (32 - bits), s = Math.floor(n / size) * size;
  return { v: 4, s, e: s + size - 1 };
}
// Sort + merge overlapping/adjacent ranges.
function merge(list, v) {
  const next = (x) => (v === 4 ? x + 1 : (BigInt("0x" + x) + 1n).toString(16).padStart(16, "0"));
  const sorted = [...list].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && (r[0] <= last[1] || r[0] === next(last[1]))) { if (r[1] > last[1]) last[1] = r[1]; }
    else out.push([r[0], r[1]]);
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "TheTyreMall-geo-update/1.0" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

async function main() {
  // DB-IP country lite: this month's file, or last month's early in a month.
  const now = new Date();
  const months = [0, 1].map((back) => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)); return d.toISOString().slice(0, 7); });
  let csv = null, month = null;
  for (const m of months) {
    try { csv = zlib.gunzipSync(Buffer.from(await (await get(`https://download.db-ip.com/free/dbip-country-lite-${m}.csv.gz`)).arrayBuffer())).toString("utf8"); month = m; break; } catch { /* try older */ }
  }
  if (!csv) throw new Error("Couldn't download the DB-IP country file.");
  const za4 = [], za6 = [];
  const blk = Object.fromEntries(BLOCKABLE.map((c) => [c, { v4: [], v6: [] }]));
  for (const line of csv.split("\n")) {
    const [a, b, cc] = line.trim().split(",");
    if (cc === "ZA") {
      if (a.includes(":")) za6.push([p64(v6hex(a)), p64(v6hex(b))]); else za4.push([v4(a), v4(b)]);
    } else if (blk[cc]) {
      if (a.includes(":")) blk[cc].v6.push([p64(v6hex(a)), p64(v6hex(b))]); else blk[cc].v4.push([v4(a), v4(b)]);
    }
  }
  const bot4 = [], bot6 = [], sources = {};
  for (const [name, url] of Object.entries(BOT_LISTS)) {
    try {
      const j = await (await get(url)).json();
      let n = 0;
      for (const p of j.prefixes ?? []) {
        const pref = p.ipv4Prefix || p.ipv6Prefix; if (!pref) continue;
        const r = cidr(pref); (r.v === 4 ? bot4 : bot6).push([r.s, r.e]); n++;
      }
      sources[name] = { url, ranges: n, updated: j.creationTime ?? null };
    } catch (e) {
      console.warn(`! ${name}: ${e.message} (keeping the site usable; re-run later)`);
    }
  }
  const data = {
    generated: new Date().toISOString(),
    countryData: `DB-IP IP to Country Lite ${month} (CC BY 4.0, https://db-ip.com)`,
    sources,
    za: { v4: merge(za4, 4), v6: merge(za6, 6) },
    bots: { v4: merge(bot4, 4), v6: merge(bot6, 6) },
  };
  fs.writeFileSync(OUT, JSON.stringify(data));
  const block = { generated: data.generated, countryData: data.countryData, countries: Object.fromEntries(Object.entries(blk).map(([c, r]) => [c, { v4: merge(r.v4, 4), v6: merge(r.v6, 6) }])) };
  fs.writeFileSync(OUT_BLOCK, JSON.stringify(block));
  console.log(`Wrote ${path.relative(process.cwd(), OUT_BLOCK)}: ${Object.entries(block.countries).map(([c, r]) => `${c} ${r.v4.length + r.v6.length}`).join(", ")} (${(fs.statSync(OUT_BLOCK).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ZA ${data.za.v4.length} IPv4 + ${data.za.v6.length} IPv6 ranges; bots ${data.bots.v4.length} IPv4 + ${data.bots.v6.length} IPv6 (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
