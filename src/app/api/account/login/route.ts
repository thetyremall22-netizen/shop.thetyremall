import { NextRequest, NextResponse } from "next/server";
import { checkCustomerLogin } from "@/lib/customers";
import { countAttempt, limited, readJson, signIn } from "@/lib/customer-routes";

export async function POST(req: NextRequest) {
  const block = await limited(req, "login");
  if (block) return block;
  const b = await readJson<{ email?: string; password?: string }>(req);
  if (!b?.email || !b.password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const r = await checkCustomerLogin(b.email, b.password);
  if (!r.ok) {
    if (r.unverified) return NextResponse.json({ error: "Please confirm your email address first — check your inbox (and spam folder) for our email.", unverified: true }, { status: 403 });
    await countAttempt(req, "login");
    return NextResponse.json({ error: "That email and password don't match. Try again or use “Forgot password”." }, { status: 401 });
  }
  await countAttempt(req, "login", true);
  return signIn(NextResponse.json({ ok: true }), r.customer.id);
}
