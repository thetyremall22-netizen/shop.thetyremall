import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { syncFromWoo } from "@/lib/woo-sync";

export const maxDuration = 300;

export async function POST() {
  if (!(await authorize("products.import"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const result = await syncFromWoo();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[sync-woo]", e);
    return NextResponse.json({ error: "Sync failed — check the WooCommerce site is reachable." }, { status: 502 });
  }
}
