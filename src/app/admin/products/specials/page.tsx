import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { can } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { SpecialsManager } from "@/components/admin/SpecialsManager";
import { listSpecials, specialStatus, specialProductCounts } from "@/lib/special-categories";
import { listLandingPages } from "@/lib/landing-pages";

export const instant = false;

export default async function SpecialsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requirePermission("products.view");
  const sp = await searchParams;
  const kind = sp.kind === "sale" ? "sale" : "special";
  const canPages = can(me.role, "pages.manage");
  const [specials, counts, landing] = await Promise.all([listSpecials(kind), specialProductCounts(), canPages ? listLandingPages() : Promise.resolve([])]);
  // Landing pages and which categories they show (for each special's "Landing page" line).
  const pages = landing.map((p) => ({ id: p.id, title: p.title, slug: p.slug, published: p.published, categories: p.sections.filter((s) => s.type === "products" && s.category).map((s) => s.category as string) }));
  const now = Date.now();
  const tab = (k: "special" | "sale", label: string) => (
    <Link href={k === "sale" ? "/admin/products/specials?kind=sale" : "/admin/products/specials"}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${kind === k ? "bg-volt text-volt-ink" : "border border-line text-muted hover:text-fg"}`}>{label}</Link>
  );
  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-bold text-volt hover:underline">← Products</Link>
      <h1 className="mt-2 font-display text-3xl">{kind === "sale" ? "Sale categories" : "Special categories"}</h1>
      <div className="mt-3 flex flex-wrap gap-2">{tab("special", "★ Special categories")}{tab("sale", "% Sale categories")}</div>
      <p className="mt-3 text-sm text-muted">
        {kind === "sale"
          ? "Sale groupings like a Black Friday Sale or Clearance Sale."
          : "Seasonal categories like Father’s Day or Christmas specials."}{" "}
        Give one a start and end date, add products, and it shows on the site (in the shop filters and at its own /product-category address)
        only between those dates. Link to it from a home page banner to promote it. Deleting one removes it from its products; the products stay in the shop.
        To change prices, use the products list&apos;s bulk “Sale” action on the same products.
      </p>
      <div className="mt-5">
        <SpecialsManager key={kind} kind={kind} openSlug={sp.open} pages={pages} canPages={canPages} canEdit={can(me.role, "products.edit")} canDelete={can(me.role, "products.delete")}
          specials={specials.map((s) => ({ ...s, status: specialStatus(s, now), count: counts[s.slug] ?? 0 }))} />
      </div>
    </AdminShell>
  );
}
