"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface StringRow { key: string; label: string; value: string; isDefault: boolean }

function Row({ row }: { row: StringRow }) {
  const router = useRouter();
  const [value, setValue] = useState(row.value);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = value !== row.value;

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/strings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: row.key, value }) });
    setMsg(res.ok ? "✓" : "✗");
    if (res.ok) router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line py-2.5 last:border-0">
      <div className="w-full sm:w-64">
        <div className="text-sm font-semibold text-fg">{row.label}</div>
        <div className="font-mono text-[11px] text-faint">{row.key}{!row.isDefault && <span className="ml-1.5 badge badge-muted">edited</span>}</div>
      </div>
      <input value={value} onChange={(e) => { setValue(e.target.value); setMsg(null); }} className="h-9 flex-1 min-w-[200px] rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
      <button onClick={save} disabled={busy || !dirty} className="btn btn-ghost h-9 px-3 text-xs disabled:opacity-40">Save</button>
      {msg && <span className={`text-sm font-bold ${msg === "✓" ? "text-pay" : "text-sale"}`}>{msg}</span>}
    </div>
  );
}

export function StringsManager({ rows }: { rows: StringRow[] }) {
  const [q, setQ] = useState("");
  const filtered = q ? rows.filter((r) => `${r.label} ${r.key} ${r.value}`.toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div className="card p-5">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search wording…" className="mb-3 h-10 w-full max-w-sm rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
      <div>
        {filtered.map((r) => <Row key={r.key} row={r} />)}
        {filtered.length === 0 && <p className="py-4 text-sm text-muted">No matches.</p>}
      </div>
      <p className="mt-3 text-xs text-muted">Clear a field (or set it back to the original) to restore the default. Changes go live within a few seconds.</p>
    </div>
  );
}
