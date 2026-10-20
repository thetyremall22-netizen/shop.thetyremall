import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { bulkUpdateProducts, restoreProducts, type BulkOp, type AdminFilter, type BulkTarget } from "@/lib/db/queries";
import { addAudit, getAudit, actorName } from "@/lib/audit";

const FILTERS: AdminFilter[] = ["all", "instock", "low", "out", "sale"];

function parseOp(raw: unknown): BulkOp | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v));
  if (o.kind === "price") {
    const modes = ["pct_down", "pct_up", "rand_down", "rand_up", "set"];
    if (!modes.includes(String(o.mode))) return null;
    const value = num(o.value);
    if (!isFinite(value) || value < 0) return null;
    if (String(o.mode).startsWith("pct") && value > 95) return null;
    const rounding = ["none", "r99", "r10", "r50"].includes(String(o.rounding)) ? (o.rounding as "none") : "none";
    return { kind: "price", mode: o.mode as "set", value, rounding };
  }
  if (o.kind === "stock") {
    if (!["set", "inc", "dec"].includes(String(o.mode))) return null;
    const value = Math.max(0, Math.round(num(o.value)));
    if (!isFinite(value)) return null;
    return { kind: "stock", mode: o.mode as "set", value };
  }
  if (o.kind === "status") {
    return { kind: "status", visible: Boolean(o.visible) };
  }
  if (o.kind === "sale") {
    if (o.mode === "remove") return { kind: "sale", mode: "remove" };
    const pct = num(o.pct);
    if (!isFinite(pct) || pct <= 0 || pct > 95) return null;
    return { kind: "sale", mode: "set", pct };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const actor = await authorize("products.bulk");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Undo a previous bulk edit: restore the values saved in its history entry.
  if (body.scope === "undo") {
    const entry = await getAudit(Number(body.auditId));
    if (!entry || entry.entity !== "products" || entry.action !== "bulk" || !Array.isArray(entry.before?.items)) {
      return NextResponse.json({ error: "That change can't be undone." }, { status: 400 });
    }
    const n = await restoreProducts(entry.before.items as BulkTarget[]);
    await addAudit({ entity: "products", entityId: "bulk", action: "undo", actor: actorName(actor), summary: `Undid bulk edit #${entry.id} (${entry.summary}) — ${n} products restored` });
    return NextResponse.json({ ok: true, restored: n });
  }

  const op = parseOp(body.op);
  if (!op) return NextResponse.json({ error: "Invalid or missing operation." }, { status: 400 });

  const scope = body.scope === "filter" ? "filter" : "selected";
  try {
    let res;
    if (scope === "filter") {
      const q = typeof body.q === "string" ? body.q : undefined;
      const filter = FILTERS.includes(body.filter as AdminFilter) ? (body.filter as AdminFilter) : undefined;
      const type = body.type === "tyre" || body.type === "wheel" || body.type === "other" ? body.type : undefined;
      res = await bulkUpdateProducts({ q, filter, type, op });
    } else {
      const slugs = Array.isArray(body.slugs) ? (body.slugs as unknown[]).map(String).filter(Boolean) : [];
      if (!slugs.length) return NextResponse.json({ error: "No products selected." }, { status: 400 });
      res = await bulkUpdateProducts({ slugs, op });
    }
    const auditId = res.updated
      ? await addAudit({
          entity: "products", entityId: "bulk", action: "bulk", actor: actorName(actor),
          summary: `${typeof body.label === "string" ? body.label.slice(0, 120) : op.kind} on ${res.updated} product${res.updated === 1 ? "" : "s"}`,
          before: { items: res.before },
        })
      : null;
    return NextResponse.json({ ok: true, updated: res.updated, auditId });
  } catch (e) {
    return NextResponse.json({ error: `Bulk update failed: ${(e as Error).message}` }, { status: 500 });
  }
}
