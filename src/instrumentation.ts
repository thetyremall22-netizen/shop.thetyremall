// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startBackups } = await import("./lib/db-backup");
  startBackups();
  const { startCartRecovery } = await import("./lib/cart-recovery-scheduler");
  startCartRecovery();
}
