import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { StringsManager } from "@/components/admin/StringsManager";
import { listStrings } from "@/lib/strings";

export const instant = false;

export default async function AdminStrings() {
  await requirePermission("content.edit");
  const rows = await listStrings();
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Wording</h1>
      <p className="mt-1 text-sm text-muted">Edit the labels and short copy used across the storefront — &quot;Per tyre&quot;, &quot;Set of 4&quot;, stock labels, the buy-now-pay-later line and more.</p>
      <div className="mt-6 max-w-3xl">
        <StringsManager rows={rows} />
      </div>
    </AdminShell>
  );
}
