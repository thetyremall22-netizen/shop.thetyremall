import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { BrandsManager } from "@/components/admin/BrandsManager";
import { listBrandsAdmin } from "@/lib/brand-registry";

export const instant = false;

export default async function BrandsPage() {
  const me = await requirePermission("products.view");
  const brands = await listBrandsAdmin();
  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
      <h1 className="mt-2 font-display text-3xl">Brands <span className="text-base text-muted">({brands.length})</span></h1>
      <p className="mt-1 text-sm text-muted">Every brand with products in the shop is listed here automatically, including new brands from a CSV import. Add a new brand and its logo, rename a brand, or hide it from the menus.</p>
      <div className="mt-5"><BrandsManager brands={brands} canEdit={can(me.role, "products.edit")} canDelete={can(me.role, "products.delete")} /></div>
    </AdminShell>
  );
}
