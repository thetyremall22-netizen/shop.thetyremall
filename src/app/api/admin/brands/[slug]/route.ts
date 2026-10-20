import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { listBrandsAdmin, saveBrand, renameBrand, deleteBrand } from "@/lib/brand-registry";
import { addAudit, actorName } from "@/lib/audit";

const logoOk = (v: unknown) => { const s = typeof v === "string" ? v.trim() : ""; return !s || /^\/(api\/media\/\d+|brand\/)/.test(s) || /^https:\/\//i.test(s) ? s : null; };

/** Edit a brand: { logo?, showInMenu?, name? (rename — updates its products) } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const slug = (await params).slug;
  const cur = (await listBrandsAdmin()).find((x) => x.slug === slug);
  if (!cur) return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const notes: string[] = [];
  let currentSlug = slug, currentName = cur.name;
  if (typeof b.name === "string" && b.name.trim() && b.name.trim() !== cur.name) {
    const r = await renameBrand(slug, b.name);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    notes.push(`Renamed ${cur.name} → ${b.name.trim()} (${r.products} products updated)`);
    currentName = b.name.trim();
    currentSlug = (await listBrandsAdmin()).find((x) => x.name === currentName)?.slug ?? slug;
  }
  const logo = "logo" in b ? logoOk(b.logo) : cur.uploadedLogo;
  if (logo === null) return NextResponse.json({ error: "The logo must be an uploaded image or an https link." }, { status: 400 });
  const show = typeof b.showInMenu === "boolean" ? b.showInMenu : cur.showInMenu;
  if (logo !== cur.uploadedLogo) notes.push(logo ? "Logo updated" : "Logo removed");
  if (show !== cur.showInMenu) notes.push(show ? "Shown in menus" : "Hidden from menus");
  await saveBrand({ name: currentName, logo, showInMenu: show });
  if (notes.length) await addAudit({ entity: "brand", entityId: currentSlug, action: b.undo ? "undo" : "edit", actor: actorName(actor), summary: `${b.undo ? "Undid: " : ""}${currentName}: ${notes.join(" · ")}` });
  return NextResponse.json({ ok: true, slug: currentSlug, previous: { name: cur.name, logo: cur.uploadedLogo, showInMenu: cur.showInMenu } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await authorize("products.delete");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const slug = (await params).slug;
  const r = await deleteBrand(slug);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await addAudit({ entity: "brand", entityId: slug, action: "delete", actor: actorName(actor), summary: `Removed brand ${slug}` });
  return NextResponse.json({ ok: true });
}
