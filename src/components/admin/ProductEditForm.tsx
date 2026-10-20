"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, ChangeList, UndoBar } from "./ConfirmDialog";

interface Props {
  slug: string;
  initial: {
    name: string;
    brand: string;
    type: string;
    sku: string;
    regularPrice: number; // cents
    salePrice: number;
    onSale: boolean;
    stockQty: number;
    lowStockThreshold: number;
    visible: boolean;
    shortDescription: string;
    description: string;
    image: string;
    categories: string[];
    specs: Record<string, string>;
  };
}

const toR = (c: number) => (c / 100).toFixed(2);
const SPEC_KEYS = ["width", "profile", "rim", "pcd", "pattern", "size"] as const;

export function ProductEditForm({ slug, initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [brand, setBrand] = useState(initial.brand);
  const [type, setType] = useState(initial.type === "accessory" ? "other" : initial.type || "tyre");
  const [sku, setSku] = useState(initial.sku);
  const [categories, setCategories] = useState(initial.categories.join(", "));
  const [regular, setRegular] = useState(toR(initial.regularPrice));
  const [sale, setSale] = useState(toR(initial.salePrice));
  const [onSale, setOnSale] = useState(initial.onSale);
  const [stock, setStock] = useState(String(initial.stockQty));
  const [low, setLow] = useState(String(initial.lowStockThreshold));
  const [visible, setVisible] = useState(initial.visible);
  const [shortDesc, setShortDesc] = useState(initial.shortDescription);
  const [desc, setDesc] = useState(initial.description);
  const [image, setImage] = useState(initial.image);
  const [specs, setSpecs] = useState<Record<string, string>>(() => Object.fromEntries(SPEC_KEYS.map((k) => [k, initial.specs[k] ?? ""])));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const touch = () => setSaved(false);

  const buildBody = () => ({
      name, brand, type, sku,
      categories: categories.split(/[|,]/).map((s) => s.trim()).filter(Boolean),
      regularPrice: Math.round(parseFloat(regular || "0") * 100),
      salePrice: Math.round(parseFloat(sale || "0") * 100),
      onSale,
      stockQty: parseInt(stock || "0", 10),
      lowStockThreshold: parseInt(low || "0", 10),
      visible,
      shortDescription: shortDesc,
      description: desc,
      image,
      specs,
  });
  type Body = ReturnType<typeof buildBody>;
  const [savedBody, setSavedBody] = useState<Body>(() => buildBody());
  const [confirm, setConfirm] = useState(false);
  const [undo, setUndo] = useState<Body | null>(null);

  const LABELS: Record<string, string> = {
    name: "Name", brand: "Brand", type: "Type", sku: "SKU", categories: "Categories", regularPrice: "Regular price",
    salePrice: "Sale price", onSale: "On sale", stockQty: "Stock", lowStockThreshold: "Low-stock alert", visible: "Visible in shop",
    shortDescription: "Short description", description: "Description", image: "Image", specs: "Specifications",
  };
  const show = (k: string, v: unknown) =>
    k === "regularPrice" || k === "salePrice" ? `R${(Number(v) / 100).toFixed(2)}`
      : typeof v === "boolean" ? (v ? "Yes" : "No")
      : Array.isArray(v) ? v.join(", ")
      : v && typeof v === "object" ? Object.entries(v as Record<string, string>).filter(([, x]) => x).map(([a, x]) => `${a}: ${x}`).join(", ")
      : String(v ?? "");
  const body = buildBody();
  const changes = Object.keys(LABELS)
    .filter((k) => JSON.stringify((body as Record<string, unknown>)[k]) !== JSON.stringify((savedBody as Record<string, unknown>)[k]))
    .map((k) => ({
      label: LABELS[k],
      from: k === "description" || k === "shortDescription" ? "(previous text)" : show(k, (savedBody as Record<string, unknown>)[k]),
      to: k === "description" || k === "shortDescription" ? "(edited text)" : show(k, (body as Record<string, unknown>)[k]),
    }));

  function applyBody(b: Body) {
    setName(b.name); setBrand(b.brand); setType(b.type); setSku(b.sku); setCategories(b.categories.join(", "));
    setRegular(toR(b.regularPrice)); setSale(toR(b.salePrice)); setOnSale(b.onSale); setStock(String(b.stockQty));
    setLow(String(b.lowStockThreshold)); setVisible(b.visible); setShortDesc(b.shortDescription); setDesc(b.description);
    setImage(b.image); setSpecs(b.specs);
  }

  async function patch(b: Body, isUndo = false): Promise<boolean> {
    const res = await fetch(`/api/admin/products/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, undo: isUndo }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Couldn't save."); return false; }
    return true;
  }

  function save() {
    setError(null);
    if (!changes.length) { setSaved(true); return; }
    setConfirm(true);
  }

  async function doSave() {
    setSaving(true); setSaved(false);
    const prev = savedBody;
    const ok = await patch(body);
    setSaving(false); setConfirm(false);
    if (ok) { setSaved(true); setSavedBody(body); setUndo(prev); router.refresh(); }
  }

  return (
    <div className="space-y-6">
      <Section title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input value={name} onChange={(e) => { setName(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Brand"><input value={brand} onChange={(e) => { setBrand(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Type">
            <select value={type} onChange={(e) => { setType(e.target.value); touch(); }} className="num">
              <option value="tyre">Tyre</option><option value="wheel">Wheel / Rim / Mag</option><option value="other">Other (not a tyre or wheel)</option>
            </select>
          </Field>
          <Field label="SKU"><input value={sku} onChange={(e) => { setSku(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Categories (comma-separated)"><input value={categories} onChange={(e) => { setCategories(e.target.value); touch(); }} className="num" /></Field>
          <div className="flex items-end"><Toggle label="Visible in shop" checked={visible} onChange={(v) => { setVisible(v); touch(); }} /></div>
        </div>
      </Section>

      <Section title="Pricing & stock">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Regular price (R)"><input type="number" min={0} step="0.01" value={regular} onChange={(e) => { setRegular(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Sale price (R)"><input type="number" min={0} step="0.01" value={sale} onChange={(e) => { setSale(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Stock quantity"><input type="number" min={0} value={stock} onChange={(e) => { setStock(e.target.value); touch(); }} className="num" /></Field>
          <Field label="Low-stock alert at"><input type="number" min={0} value={low} onChange={(e) => { setLow(e.target.value); touch(); }} className="num" /></Field>
        </div>
        <div className="mt-3"><Toggle label="On sale" checked={onSale} onChange={(v) => { setOnSale(v); touch(); }} /></div>
      </Section>

      <Section title="Content">
        <Field label="Short description"><textarea value={shortDesc} onChange={(e) => { setShortDesc(e.target.value); touch(); }} rows={2} className="num !h-auto py-2" /></Field>
        <div className="mt-4"><Field label="Description"><textarea value={desc} onChange={(e) => { setDesc(e.target.value); touch(); }} rows={5} className="num !h-auto py-2" /></Field></div>
        <div className="mt-4"><Field label="Image URL or path"><input value={image} onChange={(e) => { setImage(e.target.value); touch(); }} placeholder="/products/slug.webp" className="num" /></Field></div>
      </Section>

      <Section title="Specifications">
        <div className="grid gap-4 sm:grid-cols-3">
          {SPEC_KEYS.map((k) => (
            <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
              <input value={specs[k] ?? ""} onChange={(e) => { setSpecs({ ...specs, [k]: e.target.value }); touch(); }} className="num" />
            </Field>
          ))}
        </div>
      </Section>

      {error && <div className="rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-line bg-ink/80 px-1 py-3 backdrop-blur">
        <button onClick={save} disabled={saving} className="btn btn-volt px-6 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
        {saved && <span className="text-sm font-semibold text-pay">✓ Saved — live on the store within ~1 min</span>}
        {!saved && changes.length > 0 && <span className="text-xs text-muted">{changes.length} unsaved change{changes.length === 1 ? "" : "s"}</span>}
      </div>

      <ConfirmDialog open={confirm} busy={saving} yesLabel="Yes, change it" onYes={doSave} onNo={() => setConfirm(false)}>
        <ChangeList changes={changes} />
      </ConfirmDialog>
      {undo && (
        <UndoBar message="Product updated" onClose={() => setUndo(null)}
          onUndo={async () => { if (await patch(undo, true)) { applyBody(undo); setSavedBody(undo); setSaved(true); router.refresh(); } }} />
      )}

      <style>{`.num{height:2.75rem;width:100%;border-radius:0.5rem;border:1px solid var(--color-line);background:var(--color-surface-2);padding:0 0.75rem;color:var(--color-fg);outline:none}.num:focus{border-color:var(--color-volt)}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>{children}</label>;
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
