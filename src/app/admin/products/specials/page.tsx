import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { SpecialsManager } from "@/components/admin/SpecialsManager";
import { listSpecials, specialStatus, specialProductCounts } from "@/lib/special-categories";

export const instant = false;

export default async function SpecialsPage() {
  const me = await requirePermission("products.view");
  const [specials, counts] = await Promise.all([listSpecials(), specialProductCounts()]);
  const now = Date.now();
  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
      <h1 className="mt-2 font-display text-3xl">Special categories</h1>
      <p className="mt-1 text-sm text-muted">
        Seasonal categories like Father&apos;s Day or Christmas specials. Give one a start and end date, add products, and it shows on the
        site (in the shop filters and at its own /product-category address) only between those dates. Link to it from a home page banner
        to promote it. Deleting a special removes it from its products; the products stay in the shop.
      </p>
      <div className="mt-5">
        <SpecialsManager canEdit={can(me.role, "products.edit")} canDelete={can(me.role, "products.delete")}
          specials={specials.map((s) => ({ ...s, status: specialStatus(s, now), count: counts[s.slug] ?? 0 }))} />
      </div>
    </AdminShell>
  );
}
