import { ResetPasswordForm } from "@/components/admin/ResetPasswordForm";

export const instant = false;

export default async function AdminReset({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";

  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-ink-2 p-7">
        <div className="mb-1 font-display text-2xl"><span className="text-chrome">TYRE MALL</span> <span className="text-volt-grad">ADMIN</span></div>
        <p className="mb-5 mt-2 text-sm text-muted">Choose a new password for your admin account.</p>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
