import { NextRequest, NextResponse, connection } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sendWeeklyDigest } from "@/lib/weekly-digest";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Request-time only: without this, the build ran it once (sending an email)
  // and served that saved answer afterwards, so the real digest never ran.
  await connection();
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await sendWeeklyDigest()) });
}
