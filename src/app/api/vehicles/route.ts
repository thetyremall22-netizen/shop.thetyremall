import { NextRequest, NextResponse } from "next/server";
import { getMakes, getModels, getVariants, tyreSearchHref, wheelSearchHref } from "@/lib/vehicles";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const make = sp.get("make");
  const model = sp.get("model");

  if (make && model) {
    const variants = getVariants(make, model).map((v) => ({
      gen: v.gen,
      trim: v.trim,
      yearFrom: v.yearFrom,
      yearTo: v.yearTo,
      label: v.label,
      tyres: v.tyres,
      rims: v.rims,
      pcd: v.pcd,
      bore: v.bore,
      image: v.image ? `/vehicles/${v.image}.webp` : null,
      tyreHref: v.tyres[0] ? tyreSearchHref(v.tyres[0]) : "/shop",
      wheelHref: v.rims[0] ? wheelSearchHref(v.rims[0], v.pcd) : "/shop?type=wheel",
    }));
    return NextResponse.json({ variants });
  }
  if (make) {
    return NextResponse.json({ models: getModels(make) });
  }
  return NextResponse.json({ makes: getMakes() });
}
