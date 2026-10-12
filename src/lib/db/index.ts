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
export const db = drizzle(client, { schema });
export { schema };
export { client as libsql };
