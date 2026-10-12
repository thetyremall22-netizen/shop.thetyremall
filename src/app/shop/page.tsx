import Link from "next/link";
import type { Metadata } from "next";
import { queryProducts, categories, meta, getCategory } from "@/lib/catalogue";
import { ProductCard } from "@/components/ProductCard";
import { ShopFilters } from "@/components/ShopFilters";
import { SortSelect } from "@/components/SortSelect";
import { ShopPromo } from "@/components/ShopPromo";
import { Chevron } from "@/components/icons";

export const metadata: Metadata = { title: "Shop tyres & mag wheels" };
export const instant = false;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ShopPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q) ?? "";
  const category = one(sp.category);
  const type = one(sp.type) as "tyre" | "wheel" | undefined;

  const result = await queryProducts({
    q,
    category,
    type,
    brand: one(sp.brand),
    width: one(sp.width),
    profile: one(sp.profile),
    rim: one(sp.rim),
    pcd: one(sp.pcd),
    onSale: one(sp.onSale) === "1",
    sort: (one(sp.sort) as "relevance" | "price-asc" | "price-desc" | "name" | "newest") ?? "relevance",
    page,
    perPage: 24,
  });

  const cat = category ? getCategory(category) : undefined;
  const heading = q
    ? `Results for “${q}”`
    : cat
      ? cat.name
      : type === "wheel"
        ? "Mag Wheels"
        : one(sp.onSale) === "1"
          ? "Hot Deals"
          : "All Tyres & Wheels";

  // current query string (single-valued) for client filter controls + pagination
  const currentParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (val) currentParams.set(k, val);
  }
  const searchStr = currentParams.toString();
  const pageHref = (p: number) => {
    const next = new URLSearchParams(searchStr);
    next.set("page", String(p));
    return `/shop?${next.toString()}`;
  };

  return (
    <div className="container-x py-6 lg:py-8">
      <ShopPromo />

      {/* breadcrumb + heading */}
      <nav className="mt-7 flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <Link href="/shop" className="hover:text-volt">Shop</Link>
        {cat && (<><Chevron width={12} height={12} /><span className="text-fg">{cat.name}</span></>)}
      </nav>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">{heading}</h1>
          <p className="mt-1 text-sm text-muted">{result.total.toLocaleString()} products</p>
        </div>
        <div className="hidden lg:block"><SortSelect search={searchStr} /></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* sidebar */}
        <aside className="lg:sticky lg:top-40 lg:h-fit">
          <ShopFilters
            categories={categories}
            brands={result.facetBrands.length ? result.facetBrands : meta.brands}
            widths={meta.widths}
            profiles={meta.profiles}
            rims={meta.rims}
            total={result.total}
            search={searchStr}
          />
        </aside>

        {/* results */}
        <div>
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <SortSelect search={searchStr} />
          </div>

          {result.items.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div>
                <p className="font-display text-2xl">No tyres found</p>
                <p className="mt-2 text-sm text-muted">Try a different size or clear your filters.</p>
                <Link href="/shop" className="btn btn-volt mt-5">Browse all</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {result.items.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}

          {/* pagination */}
          {result.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-1.5">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="btn btn-dark px-3">Prev</Link>
              )}
              {pageWindow(page, result.pages).map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-2 text-muted">…</span>
                ) : (
                  <Link
                    key={p}
                    href={pageHref(p as number)}
                    className={`grid size-10 place-items-center rounded-lg text-sm font-bold ${
                      p === page ? "bg-volt text-volt-ink" : "border border-line bg-surface text-muted hover:text-fg"
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}
              {page < result.pages && (
                <Link href={pageHref(page + 1)} className="btn btn-dark px-3">Next</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pageWindow(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const add = (n: number) => out.push(n);
  const range = (a: number, b: number) => { for (let i = a; i <= b; i++) add(i); };
  if (total <= 7) { range(1, total); return out; }
  add(1);
  if (current > 4) out.push("…");
  range(Math.max(2, current - 1), Math.min(total - 1, current + 1));
  if (current < total - 3) out.push("…");
  add(total);
  return out;
}
