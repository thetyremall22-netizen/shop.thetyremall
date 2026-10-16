"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DuplicateProductButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}/duplicate`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.slug) { router.push(`/admin/products/${d.slug}`); router.refresh(); }
      else { setError(d.error ?? "Couldn't duplicate."); setBusy(false); }
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs font-semibold text-sale">{error}</span>}
      <button onClick={duplicate} disabled={busy} className="text-sm font-semibold text-muted hover:text-volt disabled:opacity-50">
        {busy ? "Duplicating…" : "Duplicate"}
      </button>
    </div>
  );
}
