import { NextRequest, NextResponse, connection } from "next/server";
import { revalidateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/site-content";
import { HOME_TAG } from "@/lib/home-content";
import { PAGE_CONTENT_TAG } from "@/lib/page-content";
import { STRINGS_TAG } from "@/lib/strings";
import { THEME_TAG } from "@/lib/theme";
import { REVIEWS_TAG } from "@/lib/reviews";
import { SETTINGS_TAG } from "@/lib/settings";
import { BRANDS_TAG } from "@/lib/brand-registry";
import { SPECIALS_TAG } from "@/lib/special-categories";
import { PRODUCTS_TAG } from "@/lib/catalogue-cache";

// Called once by the server itself right after it starts (see
// lib/startup-refresh). A new build carries copies of the shop's content made
// while building — from a local copy of the site, not the live database — so
// without this the home page team/stats/story, page text, wording, theme,
// reviews, brands and prices could show the build's copy until someone saved
// something in the admin. This marks them all out of date, so every page
// rebuilds from the live database on its next visit.
const TAGS = [CONTENT_TAG, HOME_TAG, PAGE_CONTENT_TAG, STRINGS_TAG, THEME_TAG, REVIEWS_TAG, SETTINGS_TAG, BRANDS_TAG, SPECIALS_TAG, PRODUCTS_TAG];

export async function POST(req: NextRequest) {
  await connection();
  const token = process.env.TTM_STARTUP_TOKEN;
  if (!token || req.headers.get("x-ttm-startup") !== token) return NextResponse.json({ error: "not allowed" }, { status: 403 });
  for (const t of TAGS) revalidateTag(t, { expire: 0 });
  return NextResponse.json({ ok: true, tags: TAGS.length });
}
