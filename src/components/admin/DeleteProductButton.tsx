"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProductButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else setBusy(false);
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="text-sm font-semibold text-sale hover:underline">
        Delete product
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className="text-muted">Delete “{name.slice(0, 24)}…”?</span>
      <button onClick={del} disabled={busy} className="rounded-md bg-sale px-3 py-1 font-semibold text-white disabled:opacity-60">
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button onClick={() => setConfirming(false)} className="text-muted hover:text-fg">Cancel</button>
    </span>
  );
}
