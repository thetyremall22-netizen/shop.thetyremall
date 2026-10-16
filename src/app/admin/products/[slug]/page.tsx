import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductEditForm } from "@/components/admin/ProductEditForm";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { DuplicateProductButton } from "@/components/admin/DuplicateProductButton";
import { getProductRow } from "@/lib/db/queries";
import { Close } from "@/components/icons";

function parseJson<T>(s: string, fallback: T): T { try { return JSON.parse(s) as T; } catch { return fallback; } }

export const instant = false;

export default async function AdminProductEdit({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const p = await getProductRow(slug);
  if (!p) notFound();

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
          <h1 className="mt-2 font-display text-2xl leading-tight">{p.name}</h1>
          <div className="mt-1 text-sm text-muted">{p.brand} · {p.sku || "no SKU"} · {p.type}</div>
        </div>
        <Link
          href="/admin/products"
          aria-label="Close and return to products"
          title="Close"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale"
        >
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 card max-w-2xl p-6">
        <ProductEditForm
          slug={p.slug}
          initial={{
            name: p.name,
            brand: p.brand,
            type: p.type,
            sku: p.sku,
            regularPrice: p.regularPrice,
            salePrice: p.salePrice,
            onSale: p.onSale,
            stockQty: p.stockQty,
            lowStockThreshold: p.lowStockThreshold,
            visible: p.visible,
            shortDescription: p.shortDescription,
            description: p.description,
            image: p.image ?? "",
            categories: parseJson<string[]>(p.categories, []),
            specs: parseJson<Record<string, string>>(p.specs, {}),
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <Link href={`/product/${p.slug}`} target="_blank" className="text-sm font-semibold text-muted hover:text-volt">
          View on store ↗
        </Link>
        <div className="flex items-center gap-4">
          <DuplicateProductButton slug={p.slug} />
          <DeleteProductButton slug={p.slug} name={p.name} />
        </div>
      </div>
    </AdminShell>
  );
}
