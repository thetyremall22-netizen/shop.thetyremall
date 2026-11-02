import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { matchingProductSlugs, type AdminFilter } from "@/lib/db/queries";
import { setProductDeals, restoreProductDeals, productDealProblem, asDeal, type ProductDeal } from "@/lib/product-deals";
import { parseProductDeal } from "@/lib/product-deal-parse";
import { dealLabel } from "@/lib/deals";
import { addAudit, getAudit, actorName } from "@/lib/audit";

const FILTERS: AdminFilter[] = ["all", "instock", "low", "out", "sale"];

/** Bulk: set or remove a deal on selected products (or all matching a filter), or undo. */
export async function POST(req: NextRequest) {
  const actor = await authorize("products.bulk");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  if (b.scope === "undo") {
    const entry = await getAudit(Number(b.auditId));
    if (!entry || entry.entity !== "products" || entry.action !== "bulk-deal" || !Array.isArray(entry.before?.deals)) return NextResponse.json({ error: "That change can't be undone." }, { status: 400 });
    const n = await restoreProductDeals(entry.before.deals as { slug: string; deal: ProductDeal | null }[]);
    await addAudit({ entity: "products", entityId: "bulk", action: "undo", actor: actorName(actor), summary: `Undid bulk deal change #${entry.id} — ${n} products restored` });
    return NextResponse.json({ ok: true, restored: n });
  }

  let slugs: string[];
  if (b.scope === "filter") {
    const q = typeof b.q === "string" ? b.q : undefined;
    const filter = FILTERS.includes(b.filter as AdminFilter) ? (b.filter as AdminFilter) : undefined;
    const type = b.type === "tyre" || b.type === "wheel" || b.type === "other" ? b.type : undefined;
    slugs = await matchingProductSlugs({ q, filter, type });
  } else {
    slugs = Array.isArray(b.slugs) ? (b.slugs as unknown[]).map(String).filter(Boolean).slice(0, 10000) : [];
  }
  if (!slugs.length) return NextResponse.json({ error: "No products selected." }, { status: 400 });

  const remove = b.remove === true;
  const deal = remove ? null : parseProductDeal((b.deal ?? {}) as Record<string, unknown>);
  if (deal) { const problem = productDealProblem(deal); if (problem) return NextResponse.json({ error: problem }, { status: 400 }); }
  const before = await setProductDeals(slugs, deal);
  const what = deal ? (() => { const d = asDeal({ ...deal, slug: "x", updatedAt: 0 }); return `${d.name} — ${dealLabel(d)}`; })() : "removed deal";
  const auditId = await addAudit({ entity: "products", entityId: "bulk", action: "bulk-deal", actor: actorName(actor),
    summary: `Deal: ${what} on ${slugs.length} product${slugs.length === 1 ? "" : "s"}`, before: { deals: before } });
  return NextResponse.json({ ok: true, updated: slugs.length, auditId });
}
