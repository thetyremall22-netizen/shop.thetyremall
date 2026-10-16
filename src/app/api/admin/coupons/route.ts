import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { createCoupon, parseCouponInput } from "@/lib/coupons";

export async function POST(req: NextRequest) {
  if (!(await authorize("deals.manage"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const res = await createCoupon(parseCouponInput(b));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, id: res.id });
}
