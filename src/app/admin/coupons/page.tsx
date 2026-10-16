import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { CouponsManager } from "@/components/admin/CouponsManager";
import { listCoupons } from "@/lib/coupons";
import { getSettings } from "@/lib/settings";

export const instant = false;

export default async function AdminCoupons() {
  await requirePermission("deals.manage");
  const [coupons, settings] = await Promise.all([listCoupons(), getSettings()]);
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Coupons</h1>
      <p className="mt-1 text-sm text-muted">Discount codes customers enter at checkout — percentage or fixed amount, for all products or specific ones, with per-customer and total-use limits.</p>
      <div className="mt-6">
        <CouponsManager coupons={coupons} timezone={settings.commerce.timezone} />
      </div>
    </AdminShell>
  );
}
