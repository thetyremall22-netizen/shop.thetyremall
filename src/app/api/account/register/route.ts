import { NextRequest, NextResponse } from "next/server";
import { registerCustomer, createCustomerToken } from "@/lib/customers";
import { sendCustomerAccountEmail } from "@/lib/email";
import { checkEmail, checkName, checkPhone, cleanEmail, cleanName, normalizePhone } from "@/lib/validate";
import { isAdmin } from "@/lib/admin-auth";
import { countAttempt, limited, readJson, siteOrigin, PASSWORD_MIN } from "@/lib/customer-routes";

const VERIFY_HOURS = 48;

export async function POST(req: NextRequest) {
  const block = await limited(req, "mail");
  if (block) return block;
  const b = await readJson<{ firstName?: string; lastName?: string; email?: string; phone?: string; password?: string; wishlistEmails?: boolean; next?: string }>(req);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const errors: Record<string, string> = {};
  const fe = checkName(b.firstName ?? ""); if (fe) errors.firstName = fe.replace("your name", "your first name");
  const le = checkName(b.lastName ?? ""); if (le) errors.lastName = le.replace("your name", "your surname");
  const ee = checkEmail(b.email ?? ""); if (ee) errors.email = ee;
  const pe = checkPhone(b.phone ?? ""); if (pe) errors.phone = pe;
  if ((b.password ?? "").length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if ((b.password ?? "").length > 200) errors.password = "That password is too long.";
  if (Object.keys(errors).length) return NextResponse.json({ error: "Please fix the highlighted fields.", errors }, { status: 400 });

  const r = await registerCustomer({
    firstName: cleanName(b.firstName!), lastName: cleanName(b.lastName!), email: cleanEmail(b.email!),
    phone: normalizePhone(b.phone!) ?? b.phone!.trim(), password: b.password!, wishlistEmails: b.wishlistEmails !== false,
    test: await isAdmin(),
  });
  if (!r.ok) return NextResponse.json({ error: r.error, exists: r.exists }, { status: 409 });

  await countAttempt(req, "mail");
  const token = await createCustomerToken(r.customer.id, "verify", VERIFY_HOURS * 3600_000);
  const next = typeof b.next === "string" && b.next.startsWith("/") && !b.next.startsWith("//") ? `&next=${encodeURIComponent(b.next)}` : "";
  const link = `${siteOrigin(req)}/account/verify?token=${encodeURIComponent(token)}${next}`;
  try {
    await sendCustomerAccountEmail("verify", r.customer.email, r.customer.firstName, link, VERIFY_HOURS);
  } catch (e) {
    console.error("[account] verify email failed:", (e as Error).message);
    return NextResponse.json({ error: "Your account was created, but we couldn't send the confirmation email. Please try “Resend confirmation email” in a minute." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email: r.customer.email });
}
