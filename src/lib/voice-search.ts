// Normalise spoken (and loosely-typed) tyre searches so voice input works.
//
//   "two oh five fifty-five R sixteen"  -> "205/55R16"
//   "205 55 16" / "2055516" / "205/55r16" -> "205/55R16"
//   "tyres for a Toyota Hilux 2021"     -> "toyota hilux 2021" (filler stripped)
//
// Pure functions, safe on client and server. The mic transcript and the search
// box both run through cleanVoiceQuery() so voice and typing behave the same.

import metaData from "@/data/meta.json";

// ---- phonetic brand correction ----------------------------------------------
// Speech recognition often mishears brand names ("bridge stone", "breadstone",
// "mishlin"). correctBrands() maps those back to the real catalogue brand so the
// search actually finds products.

const BRAND_NAMES: string[] = (((metaData as { brands?: { name: string }[] }).brands) ?? [])
  .map((b) => b.name)
  .filter((n) => n && n.toLowerCase() !== "tyre mall");

const CANON = new Map(BRAND_NAMES.map((n) => [n.toLowerCase(), n]));
const BRAND_BY_KEY = new Map(BRAND_NAMES.map((n) => [n.toLowerCase().replace(/[^a-z0-9]/g, ""), n]));

// High-confidence common mishears → canonical brand (only applied if the brand
// is actually in the catalogue).
const BRAND_ALIASES: Record<string, string> = {
  bridgestone: "Bridgestone", bridgstone: "Bridgestone", breadstone: "Bridgestone", bridgeston: "Bridgestone", bridgston: "Bridgestone",
  michelin: "Michelin", mishlin: "Michelin", mitchelin: "Michelin", michelan: "Michelin", mishelin: "Michelin", mishleen: "Michelin",
  pirelli: "Pirelli", perelli: "Pirelli", pirrelli: "Pirelli", pirell: "Pirelli", pireli: "Pirelli",
  goodyear: "Goodyear", goodyr: "Goodyear", goodear: "Goodyear",
  dunlop: "Dunlop", dunlap: "Dunlop", dunlopp: "Dunlop", donlop: "Dunlop",
  continental: "Continental", conti: "Continental", contintal: "Continental", continetal: "Continental",
  yokohama: "Yokohama", yokahama: "Yokohama", yokohoma: "Yokohama", yocohama: "Yokohama",
  firestone: "Firestone", firstone: "Firestone", fireston: "Firestone",
  bfgoodrich: "BFGoodrich", goodrich: "BFGoodrich", beefgoodrich: "BFGoodrich",
  sumitomo: "Sumitomo", sumitimo: "Sumitomo",
  landsail: "Landsail", landsale: "Landsail", windforce: "Windforce", windforс: "Windforce",
  tracmax: "Tracmax", trackmax: "Tracmax", radar: "Radar", sava: "Sava", ceat: "CEAT", seat: "CEAT",
};

// Words that must never be treated as a (single-word) brand guess.
const BRAND_STOP = new Set([
  "tyre", "tyres", "tire", "tires", "wheel", "wheels", "mag", "mags", "rim", "rims",
  "alloy", "alloys", "size", "sizes", "price", "prices", "cheap", "cheapest", "best",
  "good", "year", "need", "want", "have", "looking", "please", "some", "new", "the",
  "for", "and", "you", "set", "front", "rear", "about", "store", "with",
]);

/** Loose phonetic key: drop non-leading vowels, collapse doubles, fold y→i. */
function phonKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/(.)\1+/g, "$1")
    .replace(/(?!^)[aeiou]/g, "")
    .replace(/y/g, "i");
}

const BRAND_PHON = BRAND_NAMES.map((n) => ({ name: n, key: phonKey(n.replace(/\s+/g, "")) }));

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Map misheard / approximate brand words in a query to real catalogue brands.
 *  Tries 2-word then 1-word windows (so "bridge stone"/"good year" join up). */
export function correctBrands(query: string): string {
  if (!query) return query;
  const words = query.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    let hit: { name: string; take: number } | null = null;
    for (const take of [2, 1]) {
      if (i + take > words.length) continue;
      const cand = words.slice(i, i + take).join("").toLowerCase().replace(/[^a-z]/g, "");
      if (cand.length < 4) continue;
      if (take === 1 && BRAND_STOP.has(cand)) continue;
      // 1) explicit alias
      const alias = BRAND_ALIASES[cand];
      if (alias && CANON.has(alias.toLowerCase())) { hit = { name: CANON.get(alias.toLowerCase())!, take }; break; }
      // 2) exact brand (spaces removed)
      const exact = BRAND_BY_KEY.get(cand);
      if (exact) { hit = { name: exact, take }; break; }
      // 3) nearest phonetic brand within a small edit distance
      const ck = phonKey(cand);
      if (ck.length < 3) continue;
      let best: { name: string; d: number } | null = null;
      for (const b of BRAND_PHON) { const d = lev(ck, b.key); if (!best || d < best.d) best = { name: b.name, d }; }
      if (best && best.d <= (ck.length <= 4 ? 0 : 1)) { hit = { name: best.name, take }; break; }
    }
    if (hit) { out.push(hit.name); i += hit.take - 1; }
    else out.push(words[i]);
  }
  return out.join(" ");
}

const ONES: Record<string, string> = {
  zero: "0", oh: "0", o: "0", nought: "0",
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
};
const TEENS: Record<string, string> = {
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
};
const TENS: Record<string, string> = {
  twenty: "20", thirty: "30", forty: "40", fifty: "50",
  sixty: "60", seventy: "70", eighty: "80", ninety: "90",
};

const FILLERS = [
  "tyres for", "tyre for", "tires for", "tire for", "tyres", "tires",
  "i need", "i want", "i'm looking for", "im looking for", "looking for",
  "search for", "find me", "do you have", "show me", "get me", "please",
  "a set of", "set of",
];

/** Convert number words to digits, merging "fifty five" -> 55, "double five" -> 55. */
function wordsToDigits(text: string): string {
  const raw = text.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const next = raw[i + 1];

    if ((w === "double" || w === "triple") && (next in ONES || next in TEENS || /^\d$/.test(next))) {
      const d = next in ONES ? ONES[next] : next in TEENS ? TEENS[next] : next;
      out.push(d.repeat(w === "double" ? 2 : 3));
      i++;
      continue;
    }
    if (w in TENS) {
      if (next in ONES && ONES[next] !== "0") {
        out.push(String(parseInt(TENS[w], 10) + parseInt(ONES[next], 10)));
        i++;
      } else {
        out.push(TENS[w]);
      }
      continue;
    }
    if (w in TEENS) { out.push(TEENS[w]); continue; }
    if (w in ONES) { out.push(ONES[w]); continue; }
    out.push(w);
  }

  // Join consecutive single digits (from "two oh five" -> "205"); keep words spaced.
  let res = "";
  for (let i = 0; i < out.length; i++) {
    const tok = out[i];
    const prev = out[i - 1];
    const glue = /^\d$/.test(tok) && prev !== undefined && /^\d$/.test(prev);
    res += (res && !glue ? " " : "") + tok;
  }
  return res.trim();
}

/** If the string contains a tyre size, return it formatted as 205/55R16. */
export function detectTyreSize(s: string): string | null {
  const t = s.toLowerCase();
  // 205/55R16, 205 55 16, 205/55 16, 205-55-16
  let m = t.match(/\b(\d{3})\s*[\/x\-\s]\s*(\d{2})\s*(?:r|z\s*r|zr)?\s*[\/\-\s]?\s*(\d{2})\b/);
  if (m) return `${m[1]}/${m[2]}R${m[3]}`;
  // runflats / bare "205 55 r 16"
  m = t.match(/\b(\d{3})\s*(\d{2})\s*r?\s*(\d{2})\b/);
  if (m) return `${m[1]}/${m[2]}R${m[3]}`;
  // 2055516 -> 205/55/16
  m = t.match(/\b(\d{3})(\d{2})(\d{2})\b/);
  if (m) return `${m[1]}/${m[2]}R${m[3]}`;
  // "two sixty five sixty R eighteen" -> "2 65 60 r 18": width is a lone digit
  // (hundreds) + a two-digit tens group => 2·100 + 65 = 265.
  m = t.match(/\b([1-3])\s+(\d{2})\s+(\d{2})\s*r?\s*(\d{2})\b/);
  if (m) return `${parseInt(m[1], 10) * 100 + parseInt(m[2], 10)}/${m[3]}R${m[4]}`;
  return null;
}

/**
 * Clean a raw transcript / query into something the search understands.
 * Returns the best search string: a tyre size when detected, otherwise the
 * filler-stripped text (with number words turned into digits).
 */
export function cleanVoiceQuery(raw: string): string {
  if (!raw) return "";
  let s = wordsToDigits(raw);

  const size = detectTyreSize(s);
  if (size) return size;

  s = ` ${s.toLowerCase()} `;
  for (const f of FILLERS) s = s.replace(new RegExp(`\\s${f}\\s`, "g"), " ");
  s = s.replace(/\b(a|an|my|the|some|for|of)\b/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  // Fix misheard brand names ("bridge stone" -> "Bridgestone").
  s = correctBrands(s);
  return s || raw.trim();
}
