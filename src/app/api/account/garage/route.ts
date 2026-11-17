import { NextRequest, NextResponse } from "next/server";
import { getCustomer } from "@/lib/customers";
import { getGarage, saveGarage } from "@/lib/garage";
import { readJson } from "@/lib/customer-routes";

// My Garage for signed-in clients (GET = their saved vehicles, PUT = replace the list).
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ signedIn: false }, { headers: noStore });
  return NextResponse.json({ signedIn: true, vehicles: await getGarage(c.id) }, { headers: noStore });
}

export async function PUT(req: NextRequest) {
  const c = await getCustomer();
  if (!c) return NextResponse.json({ error: "Please sign in again.", signedIn: false }, { status: 401, headers: noStore });
  const b = await readJson<{ vehicles?: unknown }>(req);
  if (!b || !Array.isArray(b.vehicles)) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: noStore });
  return NextResponse.json({ ok: true, vehicles: await saveGarage(c.id, b.vehicles as never) }, { headers: noStore });
}
