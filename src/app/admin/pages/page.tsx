import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { listLandingPages } from "@/lib/landing-pages";
import { LandingPagesList } from "@/components/admin/LandingPagesList";

export const instant = false;

export default async function AdminPages() {
  await requirePermission("pages.manage");
  const pages = await listLandingPages();
  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Pages</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Make your own landing pages — for a special, a promotion or information. Each page gets its own address
        (thetyremall.co.za/<i>your-page</i>), a title and subtitle, and sections of text, images, videos and products
        from a category. Link it from the main menu, the footer, or nowhere (just share the link).
        These are separate from the website&apos;s own pages, which aren&apos;t changed.
      </p>
      <LandingPagesList initial={pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, published: p.published, menu: p.menu, sections: p.sections.length, updatedAt: p.updatedAt }))} />
    </AdminShell>
  );
}
