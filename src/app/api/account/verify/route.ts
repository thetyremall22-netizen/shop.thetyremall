import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerEmail } from "@/lib/customers";
import { readJson, signIn } from "@/lib/customer-routes";

// The emailed link opens /account/verify, which POSTs here when the client
// presses "Confirm" (so email scanners that open links can't use it up).
export async function POST(req: NextRequest) {
  const b = await readJson<{ token?: string }>(req);
  const c = b?.token ? await verifyCustomerEmail(b.token) : null;
  if (!c) return NextResponse.json({ error: "This confirmation link has expired or was already used. Sign in, or ask for a new link." }, { status: 400 });
  return signIn(NextResponse.json({ ok: true }), c.id);
}
