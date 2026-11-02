import type { SpecialInput } from "@/lib/special-categories";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const count = (v: unknown) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 0; };
const when = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
const image = (v: unknown) => { const s = str(v, 500); return s && (/^\/(api\/media\/\d+|promo\/|brand\/|products\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };

export function parseSpecialBody(b: Record<string, unknown>): SpecialInput {
  return {
    kind: b.kind === "sale" ? "sale" : "special",
    name: str(b.name, 80), slug: str(b.slug, 80), description: str(b.description, 600), image: image(b.image),
    startAt: when(b.startAt), endAt: when(b.endAt), enabled: b.enabled !== false,
    dealType: b.dealType === "bxgy" || b.dealType === "percent" ? b.dealType : "none",
    dealBuy: count(b.dealBuy), dealGet: count(b.dealGet), dealPercent: count(b.dealPercent), dealLimit: count(b.dealLimit) || null,
  };
}
