"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GwField { name: string; label: string; secret: boolean; help?: string; value: string; isSet: boolean }
export interface GatewayStatus {
  key: string; label: string; description: string; capabilities: string[]; implemented: boolean;
  enabled: boolean; mode: "test" | "live"; fields: GwField[];
}

const inputCls = "mt-1 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt";

function GatewayCard({ gw }: { gw: GatewayStatus }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(gw.enabled);
  const [mode, setMode] = useState<"test" | "live">(gw.mode);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(gw.fields.map((f) => [f.name, f.secret ? "" : f.value])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${gw.key}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, mode, config: vals }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setMsg("✓ Saved"); router.refresh(); }
      else setMsg(d.error ?? "Couldn't save.");
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">{gw.label}
            {enabled ? <span className="ml-2 badge badge-pay">enabled</span> : <span className="ml-2 badge badge-muted">off</span>}
            {!gw.implemented && <span className="ml-1.5 badge badge-warn">coming soon</span>}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{gw.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-volt" /> Enabled
          </label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "test" | "live")} className="h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-fg outline-none focus:border-volt">
            <option value="test">Test mode</option>
            <option value="live">Live mode</option>
          </select>
        </div>
      </div>

      {mode === "test" && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-500">TEST MODE — payments go to the sandbox, not real money.</div>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {gw.fields.map((f) => (
          <label key={f.name} className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{f.label}{f.secret && f.isSet ? " · set" : ""}</span>
            <input
              type={f.secret ? "password" : "text"}
              value={vals[f.name] ?? ""}
              onChange={(e) => { setVals({ ...vals, [f.name]: e.target.value }); setMsg(null); }}
              placeholder={f.secret && f.isSet ? "•••••• (leave blank to keep)" : ""}
              autoComplete="off"
              className={inputCls}
            />
            {f.help && <span className="mt-1 block text-xs text-muted">{f.help}</span>}
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn btn-volt px-5 disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        {msg && <span className={`text-sm font-semibold ${msg.startsWith("✓") ? "text-pay" : "text-sale"}`}>{msg}</span>}
      </div>
    </div>
  );
}

export function PaymentsManager({ gateways }: { gateways: GatewayStatus[] }) {
  return (
    <div className="space-y-5">
      {gateways.map((gw) => <GatewayCard key={gw.key} gw={gw} />)}
    </div>
  );
}
