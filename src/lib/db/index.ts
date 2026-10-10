import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// Local dev uses a file (.data/ttm.db). Production points DATABASE_URL at Turso
// (libsql://…) with DATABASE_AUTH_TOKEN — same driver, no code change.
const url = process.env.DATABASE_URL || "file:.data/ttm.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = createClient(authToken ? { url, authToken } : { url });
export const db = drizzle(client, { schema });
export { schema };
export { client as libsql };
