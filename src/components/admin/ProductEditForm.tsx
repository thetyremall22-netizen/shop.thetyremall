"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  slug: string;
  initial: {
    name: string;
    regularPrice: number; // cents
    salePrice: number;
    price: number;
    onSale: boolean;
    stockQty: number;
    lowStockThreshold: number;
    visible: boolean;
  };
}

// work in rands in the UI, store cents
const toR = (c: number) => (c / 100).toFixed(2);

export function ProductEditForm({ slug, initial }: Props) {
  const router = useRouter();
  const [regular, setRegular] = useState(toR(initial.regularPrice));
  const [sale, setSale] = useState(toR(initial.salePrice));
  const [onSale, setOnSale] = useState(initial.onSale);
  const [stock, setStock] = useState(String(initial.stockQty));
  const [low, setLow] = useState(String(initial.lowStockThreshold));
  const [visible, setVisible] = useState(initial.visible);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const regularCents = Math.round(parseFloat(regular || "0") * 100);
    const saleCents = Math.round(parseFloat(sale || "0") * 100);
    const body = {
      price: onSale ? saleCents : regularCents,
      salePrice: saleCents,
      onSale,
      stockQty: parseInt(stock || "0", 10),
      lowStockThreshold: parseInt(low || "0", 10),
      visible,
    };
    const res = await fetch(`/api/admin/products/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Couldn't save.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stock quantity">
          <input type="number" min={0} value={stock} onChange={(e) => { setStock(e.target.value); setSaved(false); }} className="num" />
        </Field>
        <Field label="Low-stock alert at">
          <input type="number" min={0} value={low} onChange={(e) => { setLow(e.target.value); setSaved(false); }} className="num" />
        </Field>
        <Field label="Regular price (R)">
          <input type="number" min={0} step="0.01" value={regular} onChange={(e) => { setRegular(e.target.value); setSaved(false); }} className="num" />
        </Field>
        <Field label="Sale price (R)">
          <input type="number" min={0} step="0.01" value={sale} onChange={(e) => { setSale(e.target.value); setSaved(false); }} className="num" />
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        <Toggle label="On sale" checked={onSale} onChange={(v) => { setOnSale(v); setSaved(false); }} />
        <Toggle label="Visible in shop" checked={visible} onChange={(v) => { setVisible(v); setSaved(false); }} />
      </div>

      {error && <div className="rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn btn-volt px-6 disabled:opacity-60">
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm font-semibold text-pay">✓ Saved — live on the store</span>}
      </div>

      <style>{`.num{height:2.75rem;width:100%;border-radius:0.5rem;border:1px solid var(--color-line);background:var(--color-surface-2);padding:0 0.75rem;color:var(--color-fg);outline:none}.num:focus{border-color:var(--color-volt)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5">
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-volt" : "bg-line-2"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className="text-sm font-semibold text-fg">{label}</span>
    </button>
  );
}
