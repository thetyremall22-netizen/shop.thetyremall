import { NextResponse } from "next/server";
import { connection } from "next/server";
import { libsql } from "@/lib/db";

// Public flag the proxy uses to decide whether to show the "coming soon" gate.
// Read DIRECTLY from the DB (not the cached getSettings) and force dynamic —
// on the self-hosted standalone build, `"use cache"` getters and prerendered
// routes are frozen at build time, so a cached read would never reflect the
// admin toggle.
export async function GET() {
  await connection();
  let enabled = false;
  try {
    const r = await libsql.execute({ sql: "SELECT value FROM settings WHERE key = 'maintenance' LIMIT 1", args: [] });
    const raw = r.rows[0]?.value;
    if (raw) enabled = !!(JSON.parse(String(raw)) as { enabled?: boolean }).enabled;
  } catch { /* table/row missing — default off (fail open) */ }
  return NextResponse.json({ enabled }, { headers: { "Cache-Control": "no-store" } });
}
