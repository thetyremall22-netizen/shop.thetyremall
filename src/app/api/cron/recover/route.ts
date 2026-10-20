import { NextRequest, NextResponse, connection } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runRecovery } from "@/lib/cart-recovery-email";

export const maxDuration = 60;

/** Manual / external trigger for one Cart Recovery pass. The site also runs
 *  this itself every 5 minutes (see lib/cart-recovery-scheduler). */
export async function GET(req: NextRequest) {
  await connection(); // request-time only — never run while building
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runRecovery()) });
}
