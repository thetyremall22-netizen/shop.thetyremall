// Runs the Cart Recovery flow every 5 minutes inside the website process, so
// it needs no external cron. Started once from instrumentation.ts.
const EVERY_MS = 5 * 60 * 1000;

export function startCartRecovery(): void {
  const g = globalThis as unknown as { __ttmCartRecovery?: boolean };
  if (g.__ttmCartRecovery) return;
  g.__ttmCartRecovery = true;
  const tick = async () => {
    try {
      const { runRecovery } = await import("./cart-recovery-email");
      const r = await runRecovery();
      if (r.sent || r.failed) console.log(`[cart-recovery] sent ${r.sent}, failed ${r.failed}`);
    } catch (e) {
      console.error("[cart-recovery] scheduler tick failed:", (e as Error).message);
    }
  };
  setTimeout(tick, 90_000).unref(); // let the site finish starting first
  setInterval(tick, EVERY_MS).unref();
}
