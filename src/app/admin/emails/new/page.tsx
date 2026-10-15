import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComposeEmailForm } from "@/components/admin/ComposeEmailForm";
import { Close } from "@/components/icons";

export const instant = false;

export default async function ComposeEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const to = sp.to ?? "";

  return (
    <AdminShell>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/emails" className="text-sm font-bold text-volt hover:underline">← Emails</Link>
          <h1 className="mt-2 font-display text-2xl">Compose email</h1>
          <p className="mt-1 text-sm text-muted">Send a customer an email in the branded template. A copy is CC&apos;d to the shop and logged.</p>
        </div>
        <Link href="/admin/emails" aria-label="Close" title="Close" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-sale hover:text-sale">
          <Close width={16} height={16} />
        </Link>
      </div>

      <div className="mt-6 card max-w-2xl p-6">
        <ComposeEmailForm initialTo={to} clearOnSend />
      </div>
    </AdminShell>
  );
}
