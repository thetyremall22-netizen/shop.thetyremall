import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getProductRow } from "@/lib/db/queries";
import { getProductDeal, setProductDeals, productDealProblem, productDealStatus, asDeal } from "@/lib/product-deals";
import { parseProductDeal } from "@/lib/product-deal-parse";
import { listSpecials, specialStatus, dealOf } from "@/lib/special-categories";
import { dealLabel } from "@/lib/deals";
import { addAudit, actorName } from "@/lib/audit";

type Ctx = { params: Promise<{ slug: string }> };

/** This product's own deal, plus the sale / special category deals it's in. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await authorize("products.view"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const slug = (await params).slug;
  const p = await getProductRow(slug);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let cats: string[] = [];
  try { cats = JSON.parse(p.categories || "[]"); } catch { /* none */ }
  const now = Date.now();
  const categoryDeals = (await listSpecials()).filter((s) => cats.includes(s.slug) && dealOf(s))
    .map((s) => ({ id: s.id, kind: s.kind, name: s.name, slug: s.slug, label: dealLabel(dealOf(s)!), status: specialStatus(s, now) }));
  const deal = await getProductDeal(slug);
  return NextResponse.json({ deal, status: deal ? productDealStatus(deal, now) : null, categoryDeals });
}

/** Set this product's own deal. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit products." }, { status: 403 });
  const slug = (await params).slug;
  const p = await getProductRow(slug);
  if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const deal = parseProductDeal(b);
  const problem = productDealProblem(deal);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const [before] = await setProductDeals([slug], deal);
  const d = asDeal({ ...deal, slug, updatedAt: Date.now() });
  await addAudit({ entity: "product", entityId: slug, action: "deal", actor: actorName(actor),
    summary: `Deal set: ${d.name} — ${dealLabel(d)}${deal.startAt || deal.endAt ? " (with dates)" : ""}`, before: { deal: before.deal }, after: { deal } });
  return NextResponse.json({ ok: true, deal: await getProductDeal(slug) });
}

/** Remove this product's own deal. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit products." }, { status: 403 });
  const slug = (await params).slug;
  const [before] = await setProductDeals([slug], null);
  if (before.deal) await addAudit({ entity: "product", entityId: slug, action: "deal", actor: actorName(actor), summary: "Deal removed", before: { deal: before.deal } });
  return NextResponse.json({ ok: true });
}
