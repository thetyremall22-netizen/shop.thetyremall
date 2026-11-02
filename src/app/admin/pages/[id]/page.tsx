import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { getLandingPage } from "@/lib/landing-pages";
import { LandingPageEditor } from "@/components/admin/LandingPageEditor";

export const instant = false;

export default async function AdminEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("pages.manage");
  const page = await getLandingPage(Number((await params).id));
  if (!page) notFound();
  return (
    <AdminShell>
      <Link href="/admin/pages" className="text-sm font-semibold text-muted hover:text-volt">← Pages</Link>
      <LandingPageEditor initial={page} />
    </AdminShell>
  );
}
