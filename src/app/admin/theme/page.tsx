import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ThemeManager } from "@/components/admin/ThemeManager";
import { getThemeRaw } from "@/lib/theme";

export const instant = false;

export default async function AdminTheme() {
  await requirePermission("content.edit");
  const theme = await getThemeRaw();
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Theme</h1>
      <p className="mt-1 text-sm text-muted">Your brand colours and card style, applied across the whole storefront. Changes go live within a few seconds — no redeploy.</p>
      <div className="mt-6 max-w-3xl">
        <ThemeManager initial={theme} />
      </div>
    </AdminShell>
  );
}
