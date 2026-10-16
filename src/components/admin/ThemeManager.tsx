"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface Theme { volt: string; sale: string; pay: string; radiusCard: number }
const DEFAULTS: Theme = { volt: "#8ac53f", sale: "#ff3b2e", pay: "#19c37d", radiusCard: 14 };

export function ThemeManager({ initial }: { initial: Theme }) {
  const router = useRouter();
  const [t, setT] = useState<Theme>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function up<K extends keyof Theme>(k: K, v: Theme[K]) { setT({ ...t, [k]: v }); setMsg(null); }

  async function save(next: Theme = t) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/theme", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setMsg(res.ok ? "✓ Saved — live on the storefront within a few seconds" : "Couldn't save.");
    if (res.ok) router.refresh();
    setBusy(false);
  }

  const Swatch = ({ k, label }: { k: "volt" | "sale" | "pay"; label: string }) => (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input type="color" value={t[k]} onChange={(e) => up(k, e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface-2" />
        <input value={t[k]} onChange={(e) => up(k, e.target.value)} className="h-10 w-28 rounded-lg border border-line bg-surface-2 px-3 font-mono text-sm text-fg outline-none focus:border-volt" />
      </div>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-display text-lg">Brand colours</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Swatch k="volt" label="Primary (brand green)" />
          <Swatch k="sale" label="Sale / discount" />
          <Swatch k="pay" label="Success / pay-later" />
        </div>
        <div className="mt-4 max-w-xs">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted">Card corner radius: {t.radiusCard}px</span>
            <input type="range" min={0} max={28} value={t.radiusCard} onChange={(e) => up("radiusCard", Number(e.target.value))} className="mt-2 w-full accent-volt" />
          </label>
        </div>
      </div>

      {/* Live preview (uses inline styles so it reflects the picks before saving) */}
      <div className="card p-5">
        <h2 className="font-display text-lg">Preview</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span style={{ background: t.volt, color: "#0a0b0d", borderRadius: 10 }} className="px-4 py-2 text-sm font-bold">Primary button</span>
          <span style={{ borderColor: t.volt, color: t.volt, borderWidth: 2 }} className="rounded-lg border px-4 py-2 text-sm font-bold">Outline</span>
          <span style={{ background: t.sale, color: "#fff", borderRadius: 6 }} className="px-2.5 py-1 text-xs font-bold uppercase">-15%</span>
          <span style={{ color: t.pay }} className="text-sm font-bold">In stock · pay later</span>
          <span style={{ borderColor: "#2a2f36", borderWidth: 1, borderRadius: t.radiusCard }} className="px-4 py-3 text-sm text-muted">Card radius {t.radiusCard}px</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => save()} disabled={busy} className="btn btn-volt px-6 disabled:opacity-50">{busy ? "Saving…" : "Save theme"}</button>
        <button onClick={() => { setT(DEFAULTS); save(DEFAULTS); }} disabled={busy} className="text-sm font-semibold text-muted hover:text-fg">Reset to default</button>
        {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
      </div>
    </div>
  );
}
