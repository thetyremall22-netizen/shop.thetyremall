import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { saveBrand, listBrandsAdmin } from "@/lib/brand-registry";
import { brandSlug } from "@/lib/brands";
import { addAudit, actorName } from "@/lib/audit";

const logoOk = (v: unknown) => { const s = typeof v === "string" ? v.trim() : ""; return !s || /^\/(api\/media\/\d+|brand\/)/.test(s) || /^https:\/\//i.test(s) ? s : null; };

/** Add a brand (before its products arrive), or set its logo. */
export async function POST(req: NextRequest) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit products." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const name = typeof b.name === "string" ? b.name : "";
  const logo = logoOk(b.logo);
  if (logo === null) return NextResponse.json({ error: "The logo must be an uploaded image or an https link." }, { status: 400 });
  if ((await listBrandsAdmin()).some((x) => x.slug === brandSlug(name) && x.registered)) return NextResponse.json({ error: `${name.trim()} already exists — edit it below.` }, { status: 400 });
  const r = await saveBrand({ name, logo, showInMenu: b.showInMenu !== false });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await addAudit({ entity: "brand", entityId: r.slug, action: "created", actor: actorName(actor), summary: `Added brand ${name.trim()}${logo ? " with a logo" : ""}` });
  return NextResponse.json({ ok: true, slug: r.slug });
}
