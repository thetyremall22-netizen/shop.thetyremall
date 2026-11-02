import { NextRequest, NextResponse, connection } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { listLandingPages, saveLandingPage, type LandingInput } from "@/lib/landing-pages";
import { addAudit, actorName } from "@/lib/audit";

// Admin → Pages: landing pages (super admins).
export async function GET() {
  await connection();
  if (!(await authorize("pages.manage"))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ pages: await listLandingPages() });
}

export async function POST(req: NextRequest) {
  await connection();
  const u = await authorize("pages.manage");
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Partial<LandingInput>;
  const r = await saveLandingPage(null, { slug: String(b.slug ?? ""), title: String(b.title ?? ""), subtitle: b.subtitle, menu: "none", published: false, sections: [] });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await addAudit({ entity: "landing_page", entityId: r.page.id, action: "created", actor: actorName(u), summary: `Created landing page “${r.page.title}” (/${r.page.slug}) — not published yet` }).catch(() => {});
  return NextResponse.json({ page: r.page });
}
