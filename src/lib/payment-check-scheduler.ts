// Every 10 minutes: asks HappyPay about HappyPay orders still waiting (in case
// HappyPay's "approved" callback never reached the site), and alerts the shop
// about PayFast orders whose customer came back as paid but PayFast never confirmed,
// and cancels unpaid orders (PayFast after 1 hour, HappyPay after 24). Started once from
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
      const { watchPayfastReturns } = await import("./order-payment");
      const alerted = await watchPayfastReturns();
      if (alerted) console.log(`[payments] ${alerted} PayFast order(s) put on hold: customer returned as paid but PayFast didn't confirm`);
      const { cancelUnpaidOrders } = await import("./order-payment");
      const cancelled = await cancelUnpaidOrders();
      if (cancelled) console.log(`[payments] ${cancelled} unpaid order(s) cancelled automatically (PayFast after 1 hour, HappyPay after 24 hours)`);
    } catch (e) {
      console.error("[payments] re-check failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 100_000).unref();
  setInterval(tick, EVERY_MS).unref();
}
