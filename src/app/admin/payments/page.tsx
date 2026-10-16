import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { PaymentsManager } from "@/components/admin/PaymentsManager";
import { listGatewayStatus } from "@/lib/payments";

export const instant = false;

export default async function AdminPayments() {
  await requirePermission("settings.manage");
  const gateways = await listGatewayStatus();
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Payments</h1>
      <p className="mt-1 text-sm text-muted">Enable and configure payment gateways. Credentials are encrypted and never shown again — leave a secret field blank to keep its current value. Switching a gateway on/off or changing keys takes effect immediately, no deploy.</p>
      <div className="mt-6 max-w-4xl">
        <PaymentsManager gateways={gateways} />
      </div>
    </AdminShell>
  );
}
