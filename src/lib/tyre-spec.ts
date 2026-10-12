// Derive a full, display-ready tyre spec from a product (name + categories).
// Tyre names follow the trade convention, e.g.
//   "GOODYEAR 225/35R19 88Y EAGLE F1 ASYMMETRIC 5 XL FP"
//    brand    size      load+speed  pattern            flags
// We parse load index, speed rating, run-flat and extra-load, map load/speed
// to real-world figures, and guess the brand's quality tier.

import type { Product } from "./types";

const LOAD_KG: Record<number, number> = {
  60:250,61:257,62:265,63:272,64:280,65:290,66:300,67:307,68:315,69:325,
  70:335,71:345,72:355,73:365,74:375,75:387,76:400,77:412,78:425,79:437,
  80:450,81:462,82:475,83:487,84:500,85:515,86:530,87:545,88:560,89:580,
  90:600,91:615,92:630,93:650,94:670,95:690,96:710,97:730,98:750,99:775,
  100:800,101:825,102:850,103:875,104:900,105:925,106:950,107:975,108:1000,
  109:1030,110:1060,111:1090,112:1120,113:1150,114:1180,115:1215,116:1250,
  117:1285,118:1320,119:1360,120:1400,121:1450,122:1500,123:1550,124:1600,
  125:1650,126:1700,127:1750,128:1800,129:1850,130:1900,
};

const SPEED_KMH: Record<string, string> = {
  L:"120", M:"130", N:"140", P:"150", Q:"160", R:"170", S:"180", T:"190",
  U:"200", H:"210", V:"240", W:"270", Y:"300", Z:"240+", ZR:"240+",
};

const PREMIUM = new Set(["michelin","continental","pirelli","goodyear","bridgestone","dunlop"]);
const MID = new Set(["firestone","yokohama","falken","bfgoodrich","bfg","general","sumitomo","sava","hankook","gt radial","ceat","triangle"]);

const RUNFLAT_RE = /\b(ROF|RFT|RUN[\s-]?FLAT|SSR|ZPS?|DSST|EMT|RSC|HRS)\b/i;
const XL_RE = /\b(XL|EXTRA[\s-]?LOAD|REINF(?:ORCED)?)\b/i;
// flags/markers to strip when isolating the pattern name
const FLAG_RE = /^(XL|FP|MFS|RF|ROF|RFT|SSR|ZPS?|DSST|EMT|RSC|HRS|TL|TT|TUBELESS|MIT|FR|MO|MO1|MOE|AO|N0|N1|N2|N3|RO1|J|LR|B|C|\*|M\+S|3PMSF|OWL|BSW|RWL|VSB|DOT)$/i;

export interface TyreSpec {
  width?: string;
  profile?: string;
  rim?: string;
  size?: string;
  loadIndex?: string;
  loadKg?: number;
  speed?: string;
  speedKmh?: string;
  runFlat: boolean;
  extraLoad: boolean;
  pattern?: string;
  range: "Premium" | "Mid-range" | "Budget";
}

function tier(brand: string): TyreSpec["range"] {
  const b = brand.toLowerCase();
  if (PREMIUM.has(b)) return "Premium";
  if (MID.has(b)) return "Mid-range";
  return "Budget";
}

export function parseTyreSpec(p: Product): TyreSpec {
  const name = (p.name || "").toUpperCase();
  const s = p.specs || {};

  // load + speed, e.g. "88Y", "97W", "107/105S"
  let loadIndex: string | undefined;
  let speed: string | undefined;
  const ls = name.match(/\b(\d{2,3}(?:\/\d{2,3})?)([A-Z]{1,2})\b/);
  if (ls) {
    loadIndex = ls[1];
    if (SPEED_KMH[ls[2]]) speed = ls[2];
  }
  // speed embedded in the size (…VR16 / …ZR19)
  if (!speed) {
    const zr = name.match(/\d{2,3}\/\d{1,3}\s*([A-Z])R\d{2}/);
    if (zr && SPEED_KMH[zr[1]]) speed = zr[1];
  }

  const runFlat = RUNFLAT_RE.test(name) || p.categories.includes("runflat-tyres");
  const extraLoad = XL_RE.test(name);

  // pattern = name minus brand, size, load/speed, ply rating and flags
  let toks = name.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  const brandToks = new Set([...p.brand.toUpperCase().split(/\s+/), "BFG"]);
  toks = toks.filter((t) => {
    if (brandToks.has(t)) return false;
    if (/^\d{2,3}[\/X]/.test(t) || /R\d{2}C?$/.test(t)) return false; // size
    if (/^\d{2,3}(\/\d{2,3})?[A-Z]{1,2}$/.test(t)) return false;      // load+speed
    if (/^\d+PR$/.test(t)) return false;                              // ply rating
    if (FLAG_RE.test(t)) return false;                                // markers
    return true;
  });

  // Speed came from the size (…VR16) and the load index is left as a bare
  // trailing number (e.g. "PRIMACY 3 91") — pull it out of the pattern tokens.
  if (!loadIndex) {
    const idx = toks.findIndex((t) => /^\d{2,3}$/.test(t) && +t >= 60 && +t <= 130);
    if (idx >= 0) { loadIndex = toks[idx]; toks.splice(idx, 1); }
  }
  const pattern = toks.join(" ").replace(/\s+/g, " ").trim() || undefined;

  const loadNum = loadIndex ? parseInt(loadIndex, 10) : NaN;
  const loadKg = Number.isFinite(loadNum) ? LOAD_KG[loadNum] : undefined;
  const speedKmh = speed ? SPEED_KMH[speed] : undefined;

  return {
    width: s.width, profile: s.profile, rim: s.rim, size: s.size,
    loadIndex, loadKg, speed, speedKmh, runFlat, extraLoad,
    pattern, range: tier(p.brand),
  };
}

/** Short bullet "key features" derived from the parsed spec + category. */
export function keyFeatures(p: Product, spec: TyreSpec): string[] {
  const out: string[] = [];
  const cat = p.categories;
  if (cat.includes("uhp-tyres")) out.push("Ultra-high-performance — built for grip and high-speed stability");
  else if (cat.includes("4x4-tyres")) out.push("4×4 / off-road — tough casing for gravel and rough terrain");
  else if (cat.includes("suv-tyres")) out.push("SUV-rated — reinforced for extra vehicle weight");
  else if (cat.includes("commercial-tyres") || cat.includes("truck-bus-tyres")) out.push("Commercial-grade — high load capacity for work and fleet use");
  else if (cat.includes("passenger-tyres")) out.push("Passenger comfort — quiet, efficient everyday driving");
  if (spec.speed && spec.speedKmh) out.push(`${spec.speed}-rated — approved up to ${spec.speedKmh === "240+" ? "240+" : spec.speedKmh} km/h`);
  if (spec.loadIndex && spec.loadKg) out.push(`Load index ${spec.loadIndex} — up to ${spec.loadKg} kg per tyre`);
  if (spec.runFlat) out.push("Run-flat — keep driving safely after a puncture");
  if (spec.extraLoad) out.push("Extra load (XL) — reinforced for heavier loads");
  out.push("New stock with full manufacturer warranty");
  return out.slice(0, 6);
}
