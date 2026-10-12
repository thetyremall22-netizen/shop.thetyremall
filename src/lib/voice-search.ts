// Normalise spoken (and loosely-typed) tyre searches so voice input works.
//
//   "two oh five fifty-five R sixteen"  -> "205/55R16"
//   "205 55 16" / "2055516" / "205/55r16" -> "205/55R16"
//   "tyres for a Toyota Hilux 2021"     -> "toyota hilux 2021" (filler stripped)
//
// Pure functions, safe on client and server. The mic transcript and the search
// box both run through cleanVoiceQuery() so voice and typing behave the same.

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
  return s || raw.trim();
}
