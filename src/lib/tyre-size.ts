// Shared tyre-size parser used by /api/vehicles, /vehicle-search, the homepage
// vehicle box, Tyrone and /shop. Turns a raw size string from the fitment data
// (or a search box) into width/profile/rim, or flags it as non-standard so it
// routes through a text search instead of being mangled into a metric size.

export type ParsedSize = {
  width?: string;
  profile?: string;
  rim?: string;
  q?: string;
  nonStandard?: boolean;
};

/** Parse a tyre size. Handles, in order: inch-flotation and racing/sidewall-
 *  diameter formats (non-standard → text search), service-letter prefixes
 *  (LT/P/ST), ZR→R, metric `NNN/NN R NN` with trailing load/speed tokens, and
 *  the profile-less `NNN R NN` (incl. `…C`). Anything else → `{ q }`. */
export function parseSize(raw: string): ParsedSize {
  const original = (raw ?? "").trim();
  if (!original) return { q: "" };
  let s = original.toUpperCase().replace(/\s+/g, " ").trim();

  // Inch flotation, e.g. 31x10.5R15 / 31X10.5 R15 — non-standard.
  if (/^\d{2}\s*X\s*\d+(\.\d+)?\s*Z?R?\s*\d{2}\b/.test(s)) return { q: original, nonStandard: true };

  // Racing / sidewall-diameter: NNN/NNN R NN (three-digit overall diameter),
  // e.g. Audi RS3 270/650 R18 — never a metric width/profile/rim.
  if (/^\d{3}\s*\/\s*\d{3}\s*Z?R\s*\d{2}\b/.test(s)) return { q: original, nonStandard: true };

  // Strip service-type letters and fold ZR → R.
  s = s.replace(/^(LT|P|ST)\s*/, "").replace(/ZR/g, "R");

  // Metric: NNN/NN R NN (+ optional trailing load index / speed rating / XL).
  let m = s.match(/^(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2})\b/);
  if (m) return { width: m[1], profile: m[2], rim: m[3] };

  // Profile-less: NNN R NN, optionally trailing C (e.g. 185R14, 185R14C).
  m = s.match(/^(\d{3})\s*R\s*(\d{2})\s*C?\b/);
  if (m) return { width: m[1], rim: m[2] };

  return { q: original };
}

/** Canonical catalogue size key (matches Product.specs.size), e.g. "265/60R18".
 *  Returns null for non-standard / unparseable sizes. */
export function canonicalSize(raw: string): string | null {
  const p = parseSize(raw);
  if (p.nonStandard || !p.width || !p.profile || !p.rim) return null;
  return `${p.width}/${p.profile}R${p.rim}`;
}

/** Build a /shop link for a size: structured width/profile/rim when parsed,
 *  otherwise a text (`q`) search — never dropping tokens. */
export function sizeToShopHref(raw: string, extra: Record<string, string> = {}): string {
  const p = parseSize(raw);
  const u = new URLSearchParams({ type: "tyre", ...extra });
  if (!p.nonStandard && p.width && p.rim) {
    u.set("width", p.width);
    if (p.profile) u.set("profile", p.profile);
    u.set("rim", p.rim);
  } else {
    u.set("q", p.q ?? raw.trim());
  }
  return `/shop?${u.toString()}`;
}
