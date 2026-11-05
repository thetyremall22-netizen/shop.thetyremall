import { NextRequest, NextResponse, connection } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { linkCategoryToPage } from "@/lib/landing-pages";
import { addAudit, actorName } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

// Admin → Specials: show a special / sale category's products on a landing page.
export async function POST(req: NextRequest, { params }: Ctx) {
  await connection();
  const u = await authorize("pages.manage");
  if (!u) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const id = Number((await params).id);
  const b = (await req.json().catch(() => ({}))) as { category?: string; name?: string };
  const r = await linkCategoryToPage(id, String(b.category ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  if (r.added) await addAudit({ entity: "landing_page", entityId: id, action: "updated", actor: actorName(u), summary: `Linked “${String(b.name ?? b.category)}” to landing page “${r.page.title}” (shows its products)` }).catch(() => {});
  return NextResponse.json({ page: r.page });
}
