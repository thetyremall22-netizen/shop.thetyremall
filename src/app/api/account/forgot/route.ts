import { NextRequest, NextResponse } from "next/server";
import { getCustomerByEmail, createCustomerToken } from "@/lib/customers";
import { sendCustomerAccountEmail } from "@/lib/email";
import { countAttempt, limited, readJson, siteOrigin } from "@/lib/customer-routes";

const HOURS = 2;

// Always answers the same way, so it can't reveal which emails have accounts.
export async function POST(req: NextRequest) {
  const block = await limited(req, "mail");
  if (block) return block;
  const b = await readJson<{ email?: string }>(req);
  const c = b?.email ? await getCustomerByEmail(b.email) : null;
  if (c) {
    await countAttempt(req, "mail");
    const token = await createCustomerToken(c.id, "reset", HOURS * 3600_000);
    await sendCustomerAccountEmail("reset", c.email, c.firstName, `${siteOrigin(req)}/account/reset?token=${encodeURIComponent(token)}`, HOURS)
      .catch((e) => console.error("[account] reset email failed:", (e as Error).message));
  }
  return NextResponse.json({ ok: true });
}
