import { NextResponse, connection } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { categories } from "@/lib/catalogue";
import { listSpecials, specialStatus } from "@/lib/special-categories";

// Every category a product can be put in (for the category pickers in Admin):
// the shop's built-in categories plus the special and sale categories.
export async function GET() {
  await connection();
  if (!(await authorize("products.view"))) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const now = Date.now();
  const specials = (await listSpecials()).map((s) => ({ slug: s.slug, name: s.name, group: s.kind === "sale" ? "Sale categories" : "Special categories", status: specialStatus(s, now) }));
  const builtIn = categories.map((c) => ({ slug: c.slug, name: c.name, group: c.primary ? "Main categories" : "Other categories", status: "live" }));
  return NextResponse.json({ categories: [...specials, ...builtIn] });
}
