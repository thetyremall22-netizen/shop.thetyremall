/**
 * Timezone helpers for admin date inputs (coupons, specials…).
 *
 * The shop has ONE configured timezone (commerce.timezone, default
 * Africa/Johannesburg). An admin editing a coupon enters a wall-clock time
 * ("2026-11-01 09:00") that must mean 09:00 in THAT zone — no matter where the
 * admin's browser or the server actually is — so the special goes live / ends
 * at the right South African moment. These convert between a `datetime-local`
 * input string and a UTC epoch-ms, anchored to a given IANA timezone.
 *
 * Pure (Intl-based, no deps) so it runs on both client and server.
 */

export const DEFAULT_TZ = "Africa/Johannesburg";

/** A short list of timezones offered in the admin settings dropdown. */
export const TIMEZONE_OPTIONS = [
  "Africa/Johannesburg",
  "Africa/Windhoek",
  "Africa/Harare",
  "Africa/Gaborone",
  "Africa/Maputo",
  "Africa/Nairobi",
  "Africa/Lagos",
  "Africa/Cairo",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "UTC",
] as const;

/** ms that wall-clock time in `tz` is AHEAD of UTC, at the given UTC instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const m: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") m[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute, m.second);
  return asUTC - utcMs;
}

/**
 * Interpret a `datetime-local` value ("YYYY-MM-DDTHH:mm") as a wall-clock time
 * in `tz` and return the corresponding UTC epoch-ms. Empty → null.
 */
export function localInputToMs(value: string, tz: string = DEFAULT_TZ): number | null {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = value.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  if (!y || !mo || !d) return null;
  const guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0);
  // Subtract the zone offset to get the true UTC instant; refine once so a DST
  // boundary (where the offset differs either side) still resolves correctly.
  let utc = guess - tzOffsetMs(guess, tz);
  const refined = guess - tzOffsetMs(utc, tz);
  if (refined !== utc) utc = refined;
  return utc;
}

/**
 * Format a UTC epoch-ms as a `datetime-local` value ("YYYY-MM-DDTHH:mm") showing
 * the wall-clock time in `tz`. Null/0 → "".
 */
export function msToLocalInput(ms: number | null | undefined, tz: string = DEFAULT_TZ): string {
  if (!ms) return "";
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(ms))) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`;
}

/** Human label for a UTC ms in the shop timezone, e.g. "1 Nov 2026, 09:00". */
export function formatInTz(ms: number | null | undefined, tz: string = DEFAULT_TZ): string {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: tz, day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(ms));
}
