import { NextRequest, NextResponse, connection } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getLandingPage, saveLandingPage, deleteLandingPage, type LandingInput } from "@/lib/landing-pages";
import { addAudit, actorName } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  await connection();
  if (!(await authorize("pages.manage"))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const page = await getLandingPage(Number((await params).id));
  return page ? NextResponse.json({ page }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  await connection();
  const u = await authorize("pages.manage");
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const id = Number((await params).id);
  const before = await getLandingPage(id);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Partial<LandingInput>;
  const r = await saveLandingPage(id, {
    slug: String(b.slug ?? before.slug), title: String(b.title ?? before.title), subtitle: b.subtitle, heroImage: b.heroImage,
    menu: b.menu, menuLabel: b.menuLabel, menuOrder: b.menuOrder, published: !!b.published,
    seoTitle: b.seoTitle, seoDescription: b.seoDescription, sections: b.sections,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const changes = [
    before.published !== r.page.published ? (r.page.published ? "published" : "unpublished") : "",
    before.slug !== r.page.slug ? `address /${before.slug} → /${r.page.slug}` : "",
    before.menu !== r.page.menu ? `menu: ${r.page.menu}` : "",
  ].filter(Boolean).join(", ");
  await addAudit({ entity: "landing_page", entityId: id, action: "updated", actor: actorName(u), summary: `Saved landing page “${r.page.title}”${changes ? ` (${changes})` : ""}` }).catch(() => {});
  return NextResponse.json({ page: r.page });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await connection();
  const u = await authorize("pages.manage");
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const id = Number((await params).id);
  const before = await getLandingPage(id);
  if (!before) return NextResponse.json({ ok: true });
  await deleteLandingPage(id);
  await addAudit({ entity: "landing_page", entityId: id, action: "deleted", actor: actorName(u), summary: `Deleted landing page “${before.title}” (/${before.slug})` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
