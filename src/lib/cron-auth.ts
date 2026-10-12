import type { NextRequest } from "next/server";

/** Allow Vercel Cron (Authorization: Bearer $CRON_SECRET) or a ?key= match.
 *  When CRON_SECRET is unset, allow (so it runs before configured) but warn. */
export function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET not set — endpoint is unprotected");
    return true;
  }
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.nextUrl.searchParams.get("key") === secret) return true;
  return false;
}
