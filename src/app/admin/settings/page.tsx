import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { getSettingsFresh } from "@/lib/settings";
import { listBackups } from "@/lib/db-backup";

export const instant = false;

export default async function AdminSettings() {
  await requirePermission("settings.manage");
  // Always the live values (never a cached copy): a stale copy once showed
  // "coming soon" as ticked, and saving then switched the shop off.
  const settings = await getSettingsFresh();
  const backups = listBackups();

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-muted">Site identity, contact details, hours and commerce rules — these drive the storefront (footer, contact points, delivery/VAT). Changes go live within a few seconds.</p>
      <div className="mt-6 max-w-3xl">
        <SettingsForm initial={settings} />

        <section className="card mt-6 p-5">
          <h2 className="font-display text-lg">Database backups</h2>
          <p className="mt-1 text-sm text-muted">
            Every order, lead, email, customer, product and setting is stored in the site database. A full copy is saved
            automatically once a day on the server, and the last 14 days are kept.
          </p>
          {backups.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {backups.slice(0, 5).map((b) => (
                <li key={b.name} className="flex justify-between gap-3">
                  <span className="text-fg">{new Date(b.createdAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })}</span>
                  <span className="text-muted">{(b.bytes / 1024 / 1024).toFixed(1)} MB</span>
                </li>
              ))}
              {backups.length > 5 && <li className="text-xs text-muted">+ {backups.length - 5} older</li>}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">The first backup is made about a minute after the site starts.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
