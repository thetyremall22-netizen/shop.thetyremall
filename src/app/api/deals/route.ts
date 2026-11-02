import { NextRequest, NextResponse } from "next/server";
import { dealsForSlugs } from "@/lib/special-categories";

// Live special / sale deals for the products in a cart (for showing the
// saving). Checkout recomputes everything on the server.
export async function POST(req: NextRequest) {
  let slugs: string[] = [];
  try {
    const b = (await req.json()) as { slugs?: unknown };
    if (Array.isArray(b.slugs)) slugs = b.slugs.map(String).filter((s) => /^[\w-]{1,200}$/.test(s)).slice(0, 100);
  } catch { /* empty */ }
  const deals = slugs.length ? await dealsForSlugs(slugs).catch(() => ({})) : {};
  return NextResponse.json({ deals }, { headers: { "cache-control": "no-store" } });
}
