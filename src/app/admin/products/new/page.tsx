import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { Close } from "@/components/icons";

export const instant = false;

export default async function AdminNewProduct() {
  await requireAdmin();
  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
          <h1 className="mt-2 font-display text-2xl">Add product</h1>
          <p className="mt-1 text-sm text-muted">Create a new product. You can refine stock, price and images after it&apos;s created.</p>
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
      <div className="mt-6 card max-w-2xl p-6"><NewProductForm /></div>
    </AdminShell>
  );
}
