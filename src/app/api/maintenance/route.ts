import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

// Lightweight public flag used by middleware to decide whether to show the
// "coming soon" gate. getSettings() is cached, so this is cheap.
export async function GET() {
  try {
    const s = await getSettings();
    return NextResponse.json({ enabled: !!s.maintenance.enabled }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Fail open: never hide the live store because of a transient read error.
    return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
