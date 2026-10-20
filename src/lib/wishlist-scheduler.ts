// Checks wishlists every 30 minutes inside the website process (no external
// cron needed). Started once from instrumentation.ts.
const EVERY_MS = 30 * 60 * 1000;

export function startWishlistAlerts(): void {
  const g = globalThis as unknown as { __ttmWishlist?: boolean };
  if (g.__ttmWishlist) return;
  g.__ttmWishlist = true;
  const tick = async () => {
    try {
      const { runWishlistAlerts } = await import("./wishlist-alerts");
      const r = await runWishlistAlerts();
      if (r.sent || r.failed) console.log(`[wishlist] alerts sent ${r.sent}, failed ${r.failed}`);
    } catch (e) {
      console.error("[wishlist] scheduler tick failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 120_000).unref(); // let the site finish starting first
  setInterval(tick, EVERY_MS).unref();
}
