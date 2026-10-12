import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductEditForm } from "@/components/admin/ProductEditForm";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { getProductRow } from "@/lib/db/queries";

export const instant = false;

export default async function AdminProductEdit({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const p = await getProductRow(slug);
  if (!p) notFound();

  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
      <h1 className="mt-2 font-display text-2xl leading-tight">{p.name}</h1>
      <div className="mt-1 text-sm text-muted">{p.brand} · {p.sku || "no SKU"} · {p.type}</div>

      <div className="mt-6 card max-w-2xl p-6">
        <ProductEditForm
          slug={p.slug}
          initial={{
            name: p.name,
            regularPrice: p.regularPrice,
            salePrice: p.salePrice,
            price: p.price,
            onSale: p.onSale,
            stockQty: p.stockQty,
            lowStockThreshold: p.lowStockThreshold,
            visible: p.visible,
          }}
        />
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-line pt-4">
        <Link href={`/product/${p.slug}`} target="_blank" className="text-sm font-semibold text-muted hover:text-volt">
          View on store ↗
        </Link>
        <DeleteProductButton slug={p.slug} name={p.name} />
      </div>
    </AdminShell>
  );
}
