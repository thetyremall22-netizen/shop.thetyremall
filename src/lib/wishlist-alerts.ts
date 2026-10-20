import "server-only";
import { collectWishlistChanges } from "./wishlist";
import { sendWishlistAlert } from "./email";
import { getSettingsFresh } from "./settings";
import { unsubscribeToken } from "./customers";

const SITE_URL = process.env.SITE_URL ?? "https://thetyremall.co.za";

/** One pass: email each client whose wishlist items went on sale, dropped in
 *  price or came back in stock. Safe to run often — each change alerts once. */
export async function runWishlistAlerts(): Promise<{ sent: number; failed: number }> {
  const s = await getSettingsFresh();
  const groups = await collectWishlistChanges(); // always records the latest state
  if (!s.clientZone.wishlistAlerts) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0;
  for (const g of groups) {
    const unsub = `${SITE_URL}/account/unsubscribe?c=${g.customerId}&t=${unsubscribeToken(g.customerId)}`;
    try { await sendWishlistAlert(g.email, g.firstName, g.changes, unsub); sent++; }
    catch (e) { failed++; console.error("[wishlist] alert failed:", (e as Error).message); }
  }
  return { sent, failed };
}
