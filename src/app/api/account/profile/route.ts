import { NextRequest, NextResponse } from "next/server";
import { getCustomer, updateCustomerProfile, type CustomerAddress } from "@/lib/customers";
import { checkName, checkPhone, cleanName, normalizePhone } from "@/lib/validate";
import { readJson } from "@/lib/customer-routes";

const s = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function PATCH(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const b = await readJson<{ firstName?: string; lastName?: string; phone?: string; address?: Partial<CustomerAddress>; wishlistEmails?: boolean }>(req);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const errors: Record<string, string> = {};
  if (b.firstName !== undefined) { const e = checkName(b.firstName); if (e) errors.firstName = e; }
  if (b.lastName !== undefined) { const e = checkName(b.lastName); if (e) errors.lastName = e; }
  if (b.phone !== undefined) { const e = checkPhone(b.phone); if (e) errors.phone = e; }
  if (Object.keys(errors).length) return NextResponse.json({ error: "Please fix the highlighted fields.", errors }, { status: 400 });
  const updated = await updateCustomerProfile(c.id, {
    firstName: b.firstName !== undefined ? cleanName(b.firstName) : undefined,
    lastName: b.lastName !== undefined ? cleanName(b.lastName) : undefined,
    phone: b.phone !== undefined ? normalizePhone(b.phone) ?? b.phone.trim() : undefined,
    address: b.address ? { street: s(b.address.street, 200), suburb: s(b.address.suburb), city: s(b.address.city), province: s(b.address.province, 60), postalCode: s(b.address.postalCode, 10) } : undefined,
    wishlistEmails: typeof b.wishlistEmails === "boolean" ? b.wishlistEmails : undefined,
  });
  return NextResponse.json({ ok: true, customer: updated });
}
