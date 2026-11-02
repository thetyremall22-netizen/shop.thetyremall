import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { getLandingPage } from "@/lib/landing-pages";
import { LandingPageView } from "@/components/LandingPageView";

export const instant = false;

// Admins see a page exactly as visitors will, even while it's a hidden draft.
export default async function AdminPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("pages.manage");
  const page = await getLandingPage(Number((await params).id));
  if (!page) notFound();
  return (
    <>
      <div className="sticky top-0 z-30 bg-volt px-4 py-2 text-center text-sm font-bold text-volt-ink">
        Preview{page.published ? "" : " — this page is a draft and hidden from visitors"} · <Link href={`/admin/pages/${page.id}`} className="underline">Back to editing</Link>
      </div>
      <LandingPageView page={page} />
    </>
  );
}
