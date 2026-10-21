// "South Africa only": is this visitor's address allowed to use the shop?
// Allowed = a South African IP, a verified search/ads/AI crawler (Google,
// Bing, ChatGPT…), or a private/local address. Data: src/data/geo-allow.json,
// refreshed with `node scripts/update-geo.mjs` (country data: DB-IP, CC BY 4.0).
import data from "@/data/geo-allow.json";

type R4 = [number, number];
type R6 = [string, string];
const ZA4 = data.za.v4 as R4[];
const ZA6 = data.za.v6 as R6[];
const BOT4 = data.bots.v4 as R4[];
const BOT6 = data.bots.v6 as R6[];

function v4(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) { const v = Number(x); if (!/^\d{1,3}$/.test(x) || v > 255) return null; n = n * 256 + v; }
  return n;
}
/** IPv6 → 32-char lowercase hex (fixed length, so text comparison = numeric). */
function v6(ip: string): string | null {
  if (!/^[0-9a-f:.]+$/i.test(ip) || (ip.match(/::/g)?.length ?? 0) > 1) return null;
  const [head, tail] = ip.includes("::") ? ip.split("::") : [ip, null];
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const arr = t.length ? t : h;
  const last = arr[arr.length - 1];
  if (last && last.includes(".")) { const n = v4(last); if (n === null) return null; arr.splice(arr.length - 1, 1, (n >>> 16).toString(16), (n & 0xffff).toString(16)); }
  const missing = 8 - h.length - t.length;
  if (tail === null ? h.length !== 8 : missing < 0) return null;
  const groups = [...h, ...(tail === null ? [] : Array(missing).fill("0")), ...t];
  if (groups.some((g) => g.length > 4)) return null;
  return groups.map((g) => g.padStart(4, "0")).join("").toLowerCase();
}

function inRanges<T extends number | string>(x: T, list: [T, T][]): boolean {
  let lo = 0, hi = list.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = list[mid];
    if (x < s) hi = mid - 1; else if (x > e) lo = mid + 1; else return true;
  }
  return false;
}

function isPrivate4(n: number): boolean {
  return (n >= 0x0a000000 && n <= 0x0affffff) // 10/8
    || (n >= 0x7f000000 && n <= 0x7fffffff)    // 127/8
    || (n >= 0xac100000 && n <= 0xac1fffff)    // 172.16/12
    || (n >= 0xc0a80000 && n <= 0xc0a8ffff)    // 192.168/16
    || (n >= 0xa9fe0000 && n <= 0xa9feffff)    // 169.254/16
    || (n >= 0x64400000 && n <= 0x647fffff);   // 100.64/10 (carrier NAT)
}

export type GeoVerdict = "za" | "bot" | "local" | "blocked";

/** Classify one visitor address. Anything we can't read is allowed (fail open,
 *  so a header problem never locks real customers out). */
export function geoVerdict(ip: string | null | undefined): GeoVerdict {
  const raw = (ip ?? "").trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!raw) return "local";
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → plain IPv4
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw);
  const s = mapped ? mapped[1] : raw;
  if (s.includes(".") && !s.includes(":")) {
    const n = v4(s);
    if (n === null) return "local";
    if (isPrivate4(n)) return "local";
    if (inRanges(n, ZA4)) return "za";
    if (inRanges(n, BOT4)) return "bot";
    return "blocked";
  }
  const h = v6(s);
  if (h === null) return "local";
  if (h === "00000000000000000000000000000001" || h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb") || h.startsWith("fc") || h.startsWith("fd")) return "local";
  if (inRanges(h, ZA6)) return "za";
  if (inRanges(h, BOT6)) return "bot";
  return "blocked";
}

/** The visitor's real address. nginx sets X-Real-IP to the connecting address
 *  (a visitor can't fake it); X-Forwarded-For's LAST entry is the fallback
 *  (earlier entries can be typed in by the visitor). */
export function visitorIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const xff = headers.get("x-forwarded-for");
  if (xff) { const parts = xff.split(",").map((p) => p.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return "";
}
