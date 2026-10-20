// Every 10 minutes, asks HappyPay about HappyPay orders still waiting, in case
// HappyPay's "approved" callback never reached the site. Started once from
// instrumentation.ts.
const EVERY_MS = 10 * 60 * 1000;

export function startPaymentChecks(): void {
  const g = globalThis as unknown as { __ttmPaymentChecks?: boolean };
  if (g.__ttmPaymentChecks) return;
  g.__ttmPaymentChecks = true;
  const tick = async () => {
    try {
      const { recheckHappyPayOrders } = await import("./order-payment");
      const r = await recheckHappyPayOrders();
      if (r.paid) console.log(`[payments] HappyPay re-check: ${r.paid} of ${r.checked} waiting order(s) confirmed paid`);
    } catch (e) {
      console.error("[payments] re-check failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 100_000).unref();
  setInterval(tick, EVERY_MS).unref();
}
