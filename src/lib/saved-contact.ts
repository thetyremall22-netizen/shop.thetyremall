// The customer's validated name, email and mobile, remembered on their own
// device so a returning visitor doesn't retype them (WhatsApp step + Tyrone).
const SAVED_KEY = "ttm-contact";

export interface SavedContact { name: string; email: string; phone: string }

export function loadSavedContact(): SavedContact {
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_KEY) || "{}");
    return { name: v.name || "", email: v.email || "", phone: v.phone || "" };
  } catch {
    return { name: "", email: "", phone: "" };
  }
}

export function storeSavedContact(c: SavedContact): void {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}
