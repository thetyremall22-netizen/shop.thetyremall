import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getSpecial, productsInSpecial, setProductsInSpecial, specialMembers } from "@/lib/special-categories";
import { listProducts, matchingProductSlugs, type AdminFilter } from "@/lib/db/queries";
import { addAudit, actorName } from "@/lib/audit";

const FILTERS: AdminFilter[] = ["all", "instock", "low", "out", "sale"];

/** The special's products, plus product search results to add from. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("products.view"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await getSpecial(Number((await params).id));
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") ?? "";
  const filter = FILTERS.includes(sp.get("filter") as AdminFilter) ? (sp.get("filter") as AdminFilter) : undefined;
  const type = ["tyre", "wheel", "other"].includes(sp.get("type") ?? "") ? sp.get("type")! : undefined;
  const memberSlugs = new Set(await productsInSpecial(s.slug));
  const results = q || filter || type ? await listProducts({ q, filter, type, perPage: 30, sort: "stock_desc" }) : { rows: [], total: 0 };
  const memberRows = await specialMembers(s.slug);
  return NextResponse.json({
    members: memberRows,
    results: results.rows.map((p) => ({ slug: p.slug, name: p.name, sku: p.sku, price: p.price, stockQty: p.stockQty, inSpecial: memberSlugs.has(p.slug) })),
    total: results.total,
  });
}

/** Add/remove products: { action: "add"|"remove", slugs?: string[], match?: { q, filter, type } } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("products.edit");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const s = await getSpecial(Number((await params).id));
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const action = b.action === "remove" ? "remove" : "add";
  let slugs: string[] = Array.isArray(b.slugs) ? (b.slugs as unknown[]).map(String).filter(Boolean).slice(0, 10000) : [];
  if (!slugs.length && b.match && typeof b.match === "object") {
    const m = b.match as Record<string, unknown>;
    const filter = FILTERS.includes(m.filter as AdminFilter) ? (m.filter as AdminFilter) : undefined;
    const type = ["tyre", "wheel", "other"].includes(String(m.type)) ? String(m.type) : undefined;
    const q = typeof m.q === "string" ? m.q : undefined;
    if (!q && !filter && !type) return NextResponse.json({ error: "Search or filter first, so you don't add the whole catalogue by mistake." }, { status: 400 });
    slugs = await matchingProductSlugs({ q, filter, type });
  }
  if (!slugs.length) return NextResponse.json({ error: "No products selected." }, { status: 400 });
  const changed = await setProductsInSpecial(s.slug, slugs, action);
  await addAudit({ entity: "special", entityId: s.id, action: b.undo ? "undo" : action, actor: actorName(actor),
    summary: `${b.undo ? "Undid: " : ""}${action === "add" ? "Added" : "Removed"} ${changed} product(s) ${action === "add" ? "to" : "from"} “${s.name}”`,
    after: { slugs: slugs.slice(0, 2000) } });
  return NextResponse.json({ ok: true, changed, slugs });
}
