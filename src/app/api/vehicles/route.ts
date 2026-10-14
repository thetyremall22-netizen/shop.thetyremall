import { NextRequest, NextResponse } from "next/server";
import { getMakes, getModels, getYears, getRecords } from "@/lib/vehicles";

// GET /api/vehicles                                  -> { makes }
// GET /api/vehicles?make=Toyota                       -> { models }
// GET /api/vehicles?make=Toyota&model=Hilux           -> { years }   (discrete, newest first)
// GET /api/vehicles?make=Toyota&model=Hilux&year=2021 -> { records } (exact-year match)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const make = sp.get("make");
  const model = sp.get("model");
  const year = sp.get("year");

  if (make && model && year && /^\d{4}$/.test(year)) {
    return NextResponse.json({ records: getRecords(make, model, Number(year)) });
  }
  if (make && model) {
    return NextResponse.json({ years: getYears(make, model) });
  }
  if (make) {
    return NextResponse.json({ models: getModels(make) });
  }
  return NextResponse.json({ makes: getMakes() });
}
