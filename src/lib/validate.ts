// Contact-detail validation shared by every website form. It runs in the
// browser (instant feedback) AND again on the server in /api/lead and
// /api/contact, so it can't be bypassed. No "server-only" import on purpose.

const NAME_JUNK = new Set([
  "test", "testing", "tester", "asdf", "asd", "sdf", "qwe", "qwerty", "abc", "abcd", "xyz",
  "name", "my name", "none", "na", "n/a", "no", "nil", "null", "xxx", "aaa", "customer",
  "user", "unknown", "anonymous", "anon", "nobody", "fake", "hello", "hi", "hey", "me",
]);

/** Returns an error message, or null when the name looks real. */
export function checkName(raw: string): string | null {
  const s = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "Please enter your name.";
  if (s.length > 60) return "That name is too long.";
  if (!/^\p{L}[\p{L}' .-]*$/u.test(s)) return "Please use letters only for your name.";
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return "Please enter your full name.";
  if (NAME_JUNK.has(s.toLowerCase())) return "Please enter your real name.";
  if (/(\p{L})\1\1/iu.test(letters)) return "Please enter your real name.";
  // Keyboard mash like "sdfghk": long, with no vowel at all.
  if (letters.length >= 5 && !/[aeiouyàáâäãåèéêëìíîïòóôöõùúûüý]/i.test(letters)) return "Please enter your real name.";
  return null;
}

export function cleanName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/i;
const EMAIL_PLACEHOLDER_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "example.co.za", "test.com", "test.co.za", "domain.com", "email.co.za",
]);

/** Returns an error message, or null when the email is valid. */
export function checkEmail(raw: string): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "Please enter your email address.";
  if (s.length > 254 || !EMAIL_RE.test(s) || s.includes("..")) return "Please enter a valid email address, e.g. name@gmail.com.";
  const [local, domain] = s.split("@");
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".")) return "Please enter a valid email address, e.g. name@gmail.com.";
  if (/\.(con|cmo|cm|om|comm)$/.test(domain)) return "Check the end of your email address. Did you mean .com?";
  if (EMAIL_PLACEHOLDER_DOMAINS.has(domain)) return "Please enter your real email address.";
  return null;
}

export function cleanEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Normalise to E.164 (e.g. +27821234567), or null if it isn't a real number.
 *  Accepts South African numbers in any common format (082 123 4567,
 *  +27 82 123 4567, 0027 82…, 27821234567) and other international numbers
 *  written with + or 00. */
export function normalizePhone(raw: string): string | null {
  const s = (raw ?? "").trim();
  if (!s || !/^[+\d\s().-]+$/.test(s)) return null;
  let d = s.replace(/[^\d+]/g, "");
  if (d.indexOf("+") > 0) return null;
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (/^0[1-8]\d{8}$/.test(d)) d = "+27" + d.slice(1);
  else if (/^27[1-8]\d{8}$/.test(d)) d = "+" + d;
  if (d.startsWith("+27")) {
    if (!/^\+27[1-8]\d{8}$/.test(d)) return null;
  } else if (!/^\+[1-9]\d{7,14}$/.test(d)) {
    return null;
  }
  const subscriber = d.slice(-9);
  if (/^(\d)\1+$/.test(subscriber) || subscriber === "123456789" || subscriber === "987654321") return null;
  return d;
}

/** Returns an error message, or null when the phone number is valid. */
export function checkPhone(raw: string): string | null {
  if (!(raw ?? "").trim()) return "Please enter your mobile number.";
  return normalizePhone(raw) ? null : "Please enter a valid mobile number, e.g. 082 123 4567.";
}

export type ContactField = "name" | "email" | "phone";
export type ContactErrors = Partial<Record<ContactField, string>>;

/** Validate the fields a form requires. `clean` holds the normalised values
 *  to store; `errors` is empty when everything passes. */
export function validateContact(
  input: { name?: string; email?: string; phone?: string },
  required: Partial<Record<ContactField, boolean>>,
): { errors: ContactErrors; clean: { name?: string; email?: string; phone?: string } } {
  const errors: ContactErrors = {};
  const clean: { name?: string; email?: string; phone?: string } = {};
  const has = (v?: string) => !!(v ?? "").trim();

  if (required.name || has(input.name)) {
    const e = checkName(input.name ?? "");
    if (e) errors.name = e; else clean.name = cleanName(input.name ?? "");
  }
  if (required.email || has(input.email)) {
    const e = checkEmail(input.email ?? "");
    if (e) errors.email = e; else clean.email = cleanEmail(input.email ?? "");
  }
  if (required.phone || has(input.phone)) {
    const e = checkPhone(input.phone ?? "");
    if (e) errors.phone = e; else clean.phone = normalizePhone(input.phone ?? "") ?? undefined;
  }
  return { errors, clean };
}
