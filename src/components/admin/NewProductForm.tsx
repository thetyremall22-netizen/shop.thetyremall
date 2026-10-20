"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewProductForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      brand: String(fd.get("brand") ?? ""),
      type: String(fd.get("type") ?? "tyre"),
      sku: String(fd.get("sku") ?? ""),
      regularPrice: Math.round(parseFloat(String(fd.get("regularPrice") || "0")) * 100),
      salePrice: fd.get("salePrice") ? Math.round(parseFloat(String(fd.get("salePrice"))) * 100) : undefined,
      onSale: fd.get("onSale") === "on",
      stockQty: parseInt(String(fd.get("stockQty") || "0"), 10),
      categories: String(fd.get("categories") ?? ""),
      shortDescription: String(fd.get("shortDescription") ?? ""),
    };
    const res = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/admin/products/${d.slug}`);
    else { setError(d.error ?? "Couldn't create product."); setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <F label="Product name" name="name" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Brand" name="brand" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">Type</span>
          <select name="type" className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt">
            <option value="tyre">Tyre</option>
            <option value="wheel">Wheel / Rim / Mag</option>
            <option value="other">Other (not a tyre or wheel)</option>
          </select>
        </label>
        <F label="SKU" name="sku" />
        <F label="Slug (optional — auto from name)" name="slug" />
        <F label="Regular price (R)" name="regularPrice" type="number" step="0.01" required />
        <F label="Sale price (R, optional)" name="salePrice" type="number" step="0.01" />
        <F label="Stock quantity" name="stockQty" type="number" />
        <F label="Categories (pipe-separated slugs)" name="categories" placeholder="suv-tyres|passenger-tyres" />
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="onSale" /> On sale</label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-muted">Short description</span>
        <textarea name="shortDescription" rows={3} className="w-full rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg outline-none focus:border-volt" />
      </label>
      {error && <div className="rounded-lg border border-sale/40 bg-sale/10 p-2.5 text-sm font-semibold text-sale">{error}</div>}
      <button type="submit" disabled={busy} className="btn btn-volt px-6 disabled:opacity-60">{busy ? "Creating…" : "Create product"}</button>
    </form>
  );
}

function F({ label, name, type = "text", required, step, placeholder }: { label: string; name: string; type?: string; required?: boolean; step?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input name={name} type={type} step={step} required={required} placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt" />
    </label>
  );
}
