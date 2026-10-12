import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { pendingRecoveries, markEmailed } from "@/lib/abandoned";
import { sendAbandonedCartEmail } from "@/lib/email";

export const maxDuration = 60;

/** Abandoned-cart recovery (item 45): email shoppers who left a cart ≥ 1h ago
 *  and haven't completed or been emailed yet. Runs on a daily cron. */
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const pending = await pendingRecoveries(3600_000);
  let sent = 0;
  for (const c of pending) {
    try {
      await sendAbandonedCartEmail(c.email, c.items, c.total);
      await markEmailed(c.email);
      sent++;
    } catch (e) {
      console.error("[recover] failed for", c.email, e);
    }
  }
  return NextResponse.json({ ok: true, pending: pending.length, sent });
}
