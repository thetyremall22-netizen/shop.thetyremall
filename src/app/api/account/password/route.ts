import { NextRequest, NextResponse } from "next/server";
import { getCustomer, changeCustomerPassword } from "@/lib/customers";
import { countAttempt, limited, readJson, signIn, PASSWORD_MIN } from "@/lib/customer-routes";

export async function POST(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const block = await limited(req, "login");
  if (block) return block;
  const b = await readJson<{ current?: string; next?: string }>(req);
  if ((b?.next ?? "").length < PASSWORD_MIN) return NextResponse.json({ error: `Use at least ${PASSWORD_MIN} characters for the new password.` }, { status: 400 });
  if (!(await changeCustomerPassword(c.id, b?.current ?? "", b!.next!))) {
    await countAttempt(req, "login");
    return NextResponse.json({ error: "Your current password isn't right." }, { status: 400 });
  }
  // Other devices are signed out; keep this one signed in with a fresh session.
  return signIn(NextResponse.json({ ok: true }), c.id);
}
