import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProductImporter } from "@/components/admin/ProductImporter";
import { Close } from "@/components/icons";

export const instant = false;

export default async function AdminProductImport() {
  await requirePermission("products.import");
  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
          <h1 className="mt-2 font-display text-2xl">Import products (CSV)</h1>
          <p className="mt-1 text-sm text-muted">Update existing products and/or add new ones. Preview every change before it&apos;s written, then undo the whole import if needed.</p>
        </div>
        <Link href="/admin/products" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>
      <div className="mt-6 max-w-4xl">
        <ProductImporter />
      </div>
    </AdminShell>
  );
}
