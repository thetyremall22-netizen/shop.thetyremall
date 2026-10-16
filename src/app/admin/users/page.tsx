import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { UsersManager } from "@/components/admin/UsersManager";
import { listUsers } from "@/lib/admin-users";

export const instant = false;

export default async function AdminUsers() {
  const me = await requirePermission("users.manage");
  const users = await listUsers();

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Staff &amp; roles</h1>
      <p className="mt-1 text-sm text-muted">
        Add staff who work on the shop and set what each can do. <b>Super Admin</b> = everything · <b>Manager</b> = products, deals, orders, emails, leads (no settings/users) · <b>Editor</b> = edit products &amp; content only · <b>Viewer</b> = read-only.
      </p>
      <div className="mt-6">
        <UsersManager users={users} currentUserId={me.id} />
      </div>
    </AdminShell>
  );
}
