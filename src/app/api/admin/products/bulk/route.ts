import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { bulkUpdateProducts, type BulkOp, type AdminFilter } from "@/lib/db/queries";

const FILTERS: AdminFilter[] = ["all", "low", "out", "sale"];

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
  if (!(await authorize("products.bulk"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const op = parseOp(body.op);
  if (!op) return NextResponse.json({ error: "Invalid or missing operation." }, { status: 400 });

  const scope = body.scope === "filter" ? "filter" : "selected";
  try {
    let res;
    if (scope === "filter") {
      const q = typeof body.q === "string" ? body.q : undefined;
      const filter = FILTERS.includes(body.filter as AdminFilter) ? (body.filter as AdminFilter) : undefined;
      res = await bulkUpdateProducts({ q, filter, op });
    } else {
      const slugs = Array.isArray(body.slugs) ? (body.slugs as unknown[]).map(String).filter(Boolean) : [];
      if (!slugs.length) return NextResponse.json({ error: "No products selected." }, { status: 400 });
      res = await bulkUpdateProducts({ slugs, op });
    }
    return NextResponse.json({ ok: true, updated: res.updated });
  } catch (e) {
    return NextResponse.json({ error: `Bulk update failed: ${(e as Error).message}` }, { status: 500 });
  }
}
