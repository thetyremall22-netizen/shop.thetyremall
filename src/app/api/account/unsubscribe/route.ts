import { NextRequest, NextResponse } from "next/server";
import { unsubscribeWishlist } from "@/lib/customers";
import { readJson } from "@/lib/customer-routes";

export async function POST(req: NextRequest) {
  const b = await readJson<{ c?: string | number; t?: string }>(req);
  const ok = b?.c && b.t ? await unsubscribeWishlist(Number(b.c), String(b.t)) : false;
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "This link isn't valid. You can switch wishlist emails off in your account instead." }, { status: 400 });
}
