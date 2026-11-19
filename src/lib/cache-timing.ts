import "server-only";
import { cacheLife } from "next/cache";
import { libsql } from "./db";

// Cache lifetimes for data that changes at scheduled times (specials, sales and
// product deals with a start / end date).
//
// These used to be cached for one minute so a deal started or ended on time.
// But the header menu lists live specials, so that one minute flowed into EVERY
// pre-built page: each page was rebuilt every minute whenever it was visited,
// which kept the server busy and made visitors wait. Now the data refreshes
// hourly, or right at the next start / end time if that comes sooner, so timing
// stays exact while pages are rebuilt far less often. Edits in Admin still
// refresh everything straight away (cache tags).

/** Call inside a "use cache" function: refresh hourly, or just after the next
 *  of these times (ms since epoch) if that is sooner. Minimum one minute. */
export function cacheUntilNextChange(times: Array<number | null | undefined>, now = Date.now()): void {
  let next = Infinity;
  for (const t of times) if (t && t > now && t < next) next = t;
  const secs = next === Infinity ? 3600 : Math.ceil((next - now) / 1000) + 5;
  const revalidate = Math.max(60, Math.min(3600, secs));
  cacheLife({ stale: 300, revalidate, expire: 86400 });
}

/** Start / end times of every enabled special or sale. */
export async function specialTimes(): Promise<number[]> {
  try {
    const r = await libsql.execute("SELECT start_at, end_at FROM special_categories WHERE enabled = 1");
    return (r.rows as Record<string, unknown>[]).flatMap((x) => [Number(x.start_at) || 0, Number(x.end_at) || 0]).filter((t) => t > 0);
  } catch { return []; } // table not created yet
}

/** Start / end times of every product deal. */
export async function productDealTimes(): Promise<number[]> {
  try {
    const r = await libsql.execute("SELECT start_at, end_at FROM product_deals");
    return (r.rows as Record<string, unknown>[]).flatMap((x) => [Number(x.start_at) || 0, Number(x.end_at) || 0]).filter((t) => t > 0);
  } catch { return []; } // table not created yet
}
