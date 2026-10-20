import { NextRequest, NextResponse } from "next/server";
import { resetCustomerPassword } from "@/lib/customers";
import { readJson, signIn, PASSWORD_MIN } from "@/lib/customer-routes";

export async function POST(req: NextRequest) {
  const b = await readJson<{ token?: string; password?: string }>(req);
  if (!b?.token) return NextResponse.json({ error: "This link is incomplete." }, { status: 400 });
  if ((b.password ?? "").length < PASSWORD_MIN) return NextResponse.json({ error: `Use at least ${PASSWORD_MIN} characters.` }, { status: 400 });
  const c = await resetCustomerPassword(b.token, b.password!);
  if (!c) return NextResponse.json({ error: "This reset link has expired or was already used. Please ask for a new one." }, { status: 400 });
  return signIn(NextResponse.json({ ok: true }), c.id);
}
