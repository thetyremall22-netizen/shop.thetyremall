import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { attributionFromBody } from "@/lib/attribution";
import { recordVisit } from "@/lib/visit-sources";

// The browser reports the start of each visit and where it came from
// (see components/AttributionTracker). Staff signed in to the admin aren't counted.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = JSON.parse((await req.text()).slice(0, 4000)); } catch { return new NextResponse(null, { status: 204 }); }
  const a = attributionFromBody({ touch: body.touch, sessionPages: 1, visits: 1 }, req.headers.get("user-agent") ?? "");
  if (a && !(await isAdmin())) await recordVisit(a, body.first === true);
  return new NextResponse(null, { status: 204 });
}
