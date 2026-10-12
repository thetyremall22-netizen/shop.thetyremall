import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { syncFromWoo } from "@/lib/woo-sync";

export const maxDuration = 300;

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await syncFromWoo();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[sync-woo]", e);
    return NextResponse.json({ error: "Sync failed — check the WooCommerce site is reachable." }, { status: 502 });
  }
}
