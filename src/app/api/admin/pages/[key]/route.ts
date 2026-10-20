import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { PAGE_KEYS, PAGES, readPageRaw, savePageContent, type PageOverride } from "@/lib/page-content";
import { addAudit, actorName, diffFields, describeChanges } from "@/lib/audit";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const link = (v: unknown) => { const s = str(v, 500); return s && (/^\/(?!\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };
const image = (v: unknown) => { const s = str(v, 500); return s && (/^\/(api\/media\/\d+|promo\/|brand\/)/.test(s) || /^https:\/\//i.test(s)) ? s : ""; };

/** Save one landing page's editable content. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const actor = await authorize("content.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit content." }, { status: 403 });
  const { key } = await params;
  if (!PAGE_KEYS.includes(key)) return NextResponse.json({ error: "Unknown page." }, { status: 404 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const bn = (b.banner ?? {}) as Record<string, unknown>;
  const next: PageOverride = {
    eyebrow: str(b.eyebrow, 120), silver: str(b.silver, 40), green: str(b.green, 40), intro: str(b.intro, 1500),
    banner: { src: image(bn.src), href: link(bn.href), alt: str(bn.alt, 200) },
    extraHeading: str(b.extraHeading, 120), extraBody: str(b.extraBody, 8000), extraPosition: b.extraPosition === "top" ? "top" : "bottom",
    seoTitle: str(b.seoTitle, 70), seoDescription: str(b.seoDescription, 170),
  };
  const before = await readPageRaw(key);
  await savePageContent(key, next);
  const flat = (o: PageOverride) => ({ ...o, banner: `${o.banner.src} ${o.banner.href} ${o.banner.alt}`.trim() });
  const changes = diffFields(flat(before), flat(next));
  if (Object.keys(changes).length) {
    await addAudit({
      entity: "content", entityId: `page:${key}`, action: b.undo ? "undo" : "edit", actor: actorName(actor),
      summary: `${PAGES.find((p) => p.key === key)?.label ?? key}: ${describeChanges(changes, {
        eyebrow: "Small line", silver: "Heading (silver)", green: "Heading (green)", intro: "Intro", banner: "Banner",
        extraHeading: "Extra heading", extraBody: "Extra content", extraPosition: "Extra position", seoTitle: "Google title", seoDescription: "Google description",
      })}`,
      before: before as unknown as Record<string, unknown>, after: next as unknown as Record<string, unknown>,
    });
  }
  return NextResponse.json({ ok: true, content: next });
}
