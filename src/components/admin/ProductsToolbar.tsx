"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function ProductsToolbar() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    const text = await file.text();
    const res = await fetch("/api/admin/products/import", {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: text,
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg(`✓ Updated ${d.updated} product${d.updated === 1 ? "" : "s"}${d.skipped ? ` (${d.skipped} not matched)` : ""}.`);
      router.refresh();
    } else {
      setMsg(d.error ?? "Import failed.");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/admin/products/new" className="btn btn-volt h-9 px-4 text-sm">+ Add product</Link>
      <a href="/api/admin/products/export" className="btn btn-ghost h-9 px-4 text-sm">Export CSV</a>
      <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-ghost h-9 px-4 text-sm disabled:opacity-60">
        {busy ? "Importing…" : "Import CSV"}
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      {msg && <span className="text-xs font-semibold text-pay">{msg}</span>}
    </div>
  );
}
