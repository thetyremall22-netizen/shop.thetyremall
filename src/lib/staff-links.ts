import "server-only";
import type { NextRequest } from "next/server";

/** Public base URL for links in staff emails (never the internal localhost). */
export function publicBase(req: NextRequest): string {
  const env = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
