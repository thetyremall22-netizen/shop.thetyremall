import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { rollbackDealImport } from "@/lib/deal-import";
import { addAudit, actorName } from "@/lib/audit";

/** Undo a deal-product import. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("products.import");
  if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let batchId: string | undefined;
  try { ({ batchId } = (await req.json()) as { batchId?: string }); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  if (!batchId) return NextResponse.json({ error: "Missing batch id." }, { status: 400 });
  const res = await rollbackDealImport(batchId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  await addAudit({ entity: "special", entityId: Number((await params).id), action: "undo", actor: actorName(actor), summary: `Undid a deal-product import (${res.deleted} removed, ${res.restored} restored)` });
  return NextResponse.json({ ok: true, restored: res.restored, deleted: res.deleted });
}
