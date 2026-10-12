"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncWooButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/sync-woo", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(`✓ Synced from WooCommerce: ${d.updated} updated, ${d.inserted} new.`);
      router.refresh();
    } else {
      setMsg(d.error ?? "Sync failed.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={sync} disabled={busy} className="btn btn-ghost h-9 px-4 text-sm disabled:opacity-60">
        {busy ? "Syncing…" : "⟳ Sync stock & prices from WooCommerce"}
      </button>
      {msg && <span className="text-xs font-semibold text-pay">{msg}</span>}
    </div>
  );
}
