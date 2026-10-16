import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { rollbackBatch } from "@/lib/product-import";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!(await authorize("products.import"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let batchId: string | undefined;
  try {
    ({ batchId } = (await req.json()) as { batchId?: string });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!batchId) return NextResponse.json({ error: "Missing batch id." }, { status: 400 });

  const res = await rollbackBatch(batchId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, restored: res.restored, deleted: res.deleted });
}
