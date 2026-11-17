"use client";
import { useEffect, useState } from "react";

// My Garage in the browser. Everyone's garage is kept in this browser
// (localStorage). For a signed-in client it is also saved to their account
// (/api/account/garage) so it follows them to any device: on first load the
// account's vehicles and this browser's vehicles are merged and saved back.
// When they sign out, this browser's copy is cleared (it lives in the account).

export interface GarageItem {
  make: string; model: string; year: number; generation: string | null; trim: string | null;
  image: string | null; selectedSize: string | null; tyreOptions: string[]; rimOptions: string[]; pcd: string | null;
}

export const GARAGE_KEY = "ttm-garage-v1";
/** Set once this browser's garage has been merged into the signed-in account;
 *  from then on the account is the master copy (so a vehicle removed on another
 *  device doesn't come back from here). Cleared on sign out. */
const SYNCED_KEY = "ttm-garage-acct";
export const GARAGE_MAX = 6;
const EVENT = "ttm-garage";

export const sameVehicle = (a: Pick<GarageItem, "make" | "model" | "year" | "trim">, b: Pick<GarageItem, "make" | "model" | "year" | "trim">) =>
  a.make === b.make && a.model === b.model && a.year === b.year && (a.trim ?? null) === (b.trim ?? null);

function readLocal(): GarageItem[] {
  try { const r = localStorage.getItem(GARAGE_KEY); const v = r ? JSON.parse(r) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeLocal(items: GarageItem[]) {
  try { localStorage.setItem(GARAGE_KEY, JSON.stringify(items)); } catch { /* private mode etc. */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ }
}
/** Readable "signed in" flag cookie (no secret) set by the account sign-in. */
const signedInFlag = () => typeof document !== "undefined" && /(?:^|;\s*)ttm_cz=1/.test(document.cookie);

async function putAccount(items: GarageItem[]) {
  try {
    await fetch("/api/account/garage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicles: items }) });
  } catch { /* offline — the browser copy still has it */ }
}

/** Merge the account's garage with this browser's (once per page load). */
let syncing: Promise<void> | null = null;
function syncWithAccount(): Promise<void> {
  if (!signedInFlag()) {
    // Signed out (or the sign-in ran out): the next sign-in merges again.
    try { localStorage.removeItem(SYNCED_KEY); } catch { /* ignore */ }
    return Promise.resolve();
  }
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const res = await fetch("/api/account/garage", { cache: "no-store" });
      const d = (await res.json().catch(() => null)) as { signedIn?: boolean; vehicles?: GarageItem[] } | null;
      if (!d?.signedIn) return;
      const account = Array.isArray(d.vehicles) ? d.vehicles : [];
      let alreadySynced = false;
      try { alreadySynced = localStorage.getItem(SYNCED_KEY) === "1"; } catch { /* ignore */ }
      if (alreadySynced) { writeLocal(account.slice(0, GARAGE_MAX)); return; }
      // First time on this browser: add vehicles saved here before signing in.
      const merged = [...account];
      for (const v of readLocal()) if (!merged.some((m) => sameVehicle(m, v))) merged.push(v);
      const final = merged.slice(0, GARAGE_MAX);
      writeLocal(final);
      if (final.length !== account.length) await putAccount(final);
      try { localStorage.setItem(SYNCED_KEY, "1"); } catch { /* ignore */ }
    } catch { /* keep the browser copy */ }
  })();
  return syncing;
}

/** Save the garage: this browser, and the client's account when signed in. */
export function saveGarage(items: GarageItem[]) {
  const list = items.slice(0, GARAGE_MAX);
  writeLocal(list);
  if (signedInFlag()) void putAccount(list);
}

/** Forget this browser's copy (on sign out — it's kept in the account). */
export function clearLocalGarage() {
  syncing = null;
  try { localStorage.removeItem(GARAGE_KEY); localStorage.removeItem(SYNCED_KEY); } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* ignore */ }
}

/** The garage list, kept up to date across every component on the page. */
export function useGarage(): [GarageItem[], (items: GarageItem[]) => void] {
  const [items, setItems] = useState<GarageItem[]>([]);
  useEffect(() => {
    const load = () => setItems(readLocal());
    load();
    void syncWithAccount();
    window.addEventListener(EVENT, load);
    const onStorage = (e: StorageEvent) => { if (e.key === GARAGE_KEY) load(); };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, load); window.removeEventListener("storage", onStorage); };
  }, []);
  return [items, saveGarage];
}
