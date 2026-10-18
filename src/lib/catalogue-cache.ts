import "server-only";
import { revalidateTag } from "next/cache";

// Shared cache tag for the product catalogue. Kept in its own tiny module so
// both the reader (catalogue.ts) and the writers (db/queries.ts) can reference
// it without a circular import.
export const PRODUCTS_TAG = "catalogue-products";

// Call after any product create/update/delete so the cached product list is
// rebuilt on the next request instead of on a timer. Wrapped in try/catch so a
// write never fails if it ever runs outside a request context.
export function revalidateProducts(): void {
  try {
    revalidateTag(PRODUCTS_TAG, "max");
  } catch {
    /* not in a request/render context — the timed cacheLife still refreshes it */
  }
}
