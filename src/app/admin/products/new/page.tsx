import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NewProductForm } from "@/components/admin/NewProductForm";

export const instant = false;

export default async function AdminNewProduct() {
  await requireAdmin();
  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
      <h1 className="mt-2 font-display text-2xl">Add product</h1>
      <p className="mt-1 text-sm text-muted">Create a new product. You can refine stock, price and images after it&apos;s created.</p>
      <div className="mt-6 card max-w-2xl p-6"><NewProductForm /></div>
    </AdminShell>
  );
}
