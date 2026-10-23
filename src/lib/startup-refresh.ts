import { randomBytes } from "node:crypto";

// Right after the server starts, refresh every cached copy of the shop's
// content from the live database (see app/api/internal/refresh-content).
// The request comes from the server itself, with a one-off secret made at
// start-up, so nobody else can trigger it.
export function refreshContentAfterStart(): void {
  const g = globalThis as unknown as { __ttmStartupRefresh?: boolean };
  if (g.__ttmStartupRefresh) return;
  g.__ttmStartupRefresh = true;
  const token = randomBytes(24).toString("hex");
  process.env.TTM_STARTUP_TOKEN = token;
  const port = process.env.PORT || "3000";
  let tries = 0;
  const attempt = async () => {
    tries++;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/internal/refresh-content`, { method: "POST", headers: { "x-ttm-startup": token } });
      if (res.ok) { console.log("[startup] shop content refreshed from the live database"); return; }
      console.warn(`[startup] content refresh answered ${res.status}`);
    } catch { /* server not listening yet */ }
    if (tries < 10) setTimeout(attempt, 3000).unref();
  };
  setTimeout(attempt, 2000).unref();
}
