import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettings } from "@/lib/settings";

export const instant = false;

export default async function AdminSettings() {
  await requirePermission("settings.manage");
  const settings = await getSettings();

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-muted">Site identity, contact details, hours and commerce rules — these drive the storefront (footer, contact points, delivery/VAT). Changes go live within a few seconds.</p>
      <div className="mt-6 max-w-3xl">
        <SettingsForm initial={settings} />
      </div>
    </AdminShell>
  );
}
