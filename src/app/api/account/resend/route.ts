import { NextRequest, NextResponse } from "next/server";
import { getCustomerByEmail, createCustomerToken } from "@/lib/customers";
import { sendCustomerAccountEmail } from "@/lib/email";
import { countAttempt, limited, readJson, siteOrigin } from "@/lib/customer-routes";

// Resend the "confirm your email" link. Always answers the same way, so it
// can't be used to find out which emails have accounts.
export async function POST(req: NextRequest) {
  const block = await limited(req, "mail");
  if (block) return block;
  const b = await readJson<{ email?: string }>(req);
  const c = b?.email ? await getCustomerByEmail(b.email) : null;
  if (c && !c.verified) {
    await countAttempt(req, "mail");
    const token = await createCustomerToken(c.id, "verify", 48 * 3600_000);
    await sendCustomerAccountEmail("verify", c.email, c.firstName, `${siteOrigin(req)}/account/verify?token=${encodeURIComponent(token)}`, 48).catch((e) => console.error("[account] resend failed:", (e as Error).message));
  }
  return NextResponse.json({ ok: true });
}
