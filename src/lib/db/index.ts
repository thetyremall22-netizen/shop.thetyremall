import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";

// Local dev uses a file (.data/ttm.db). Production points DATABASE_URL at Turso
// (libsql://…) with DATABASE_AUTH_TOKEN — same driver, no code change.
// If opening the configured DB fails (e.g. on Vercel before Turso is connected
// there is no .data file), fall back to an in-memory DB so nothing crashes at
// build or runtime — the storefront falls back to the product snapshot.
const url = process.env.DATABASE_URL || "file:.data/ttm.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

function connect(): Client {
  try {
    return createClient(authToken ? { url, authToken } : { url });
  } catch {
    return createClient({ url: ":memory:" });
  }
}

const client = connect();

// Keep the native SQLite footprint small on the memory-constrained shared host.
// mmap_size=0 disables memory-mapped I/O (otherwise libsql maps a very large
// virtual region); cache_size caps the page cache at ~8 MB; synchronous=NORMAL
// is safe under WAL and avoids extra fsyncs. Fire-and-forget, local DB only —
// ignored for a remote libsql:// URL.
if (url.startsWith("file:") || url === ":memory:") {
  for (const pragma of [
    "PRAGMA mmap_size=0",
    "PRAGMA cache_size=-8000",
    "PRAGMA busy_timeout=5000",
    "PRAGMA synchronous=NORMAL",
    "PRAGMA wal_autocheckpoint=400",
  ]) {
    client.execute(pragma).catch(() => {});
  }
}

// Release the native DB client (and its background threads) on shutdown so the
// process can exit promptly. Without this the libsql native runtime can keep the
// worker alive past Unit's stop timeout, leaving orphaned processes that pile up
// and consume memory.
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  try { process.once(sig, () => { try { client.close(); } catch { /* already closed */ } }); } catch { /* no process (edge) */ }
}

export const db = drizzle(client, { schema });
export { schema };
export { client as libsql };
