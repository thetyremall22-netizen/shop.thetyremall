import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { saveTheme } from "@/lib/theme";

export async function PATCH(req: NextRequest) {
  if (!(await authorize("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  await saveTheme({
    volt: typeof b.volt === "string" ? b.volt : undefined,
    sale: typeof b.sale === "string" ? b.sale : undefined,
    pay: typeof b.pay === "string" ? b.pay : undefined,
    radiusCard: b.radiusCard !== undefined ? Number(b.radiusCard) : undefined,
  });
  return NextResponse.json({ ok: true });
}
