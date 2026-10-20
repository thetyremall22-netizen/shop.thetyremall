import type { SpecialInput } from "@/lib/special-categories";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const when = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
const image = (v: unknown) => { const s = str(v, 500); return s && (/^\/(api\/media\/\d+|promo\/|brand\/|products\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };

export function parseSpecialBody(b: Record<string, unknown>): SpecialInput {
  return {
    name: str(b.name, 80), slug: str(b.slug, 80), description: str(b.description, 600), image: image(b.image),
    startAt: when(b.startAt), endAt: when(b.endAt), enabled: b.enabled !== false,
  };
}
