import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { updateCoupon, deleteCoupon, parseCouponInput } from "@/lib/coupons";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("deals.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const res = await updateCoupon(cid, parseCouponInput(b));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize("deals.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteCoupon(cid);
  return NextResponse.json({ ok: true });
}
