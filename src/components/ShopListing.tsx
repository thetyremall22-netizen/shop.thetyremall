import Link from "next/link";
import { queryProducts, meta } from "@/lib/catalogue";
import { findCategory, shopCategories } from "@/lib/special-categories";
import { filterBrands } from "@/lib/brand-registry";
import { detectTyreSize } from "@/lib/voice-search";
import { findVehicle, factorySizes } from "@/lib/vehicles";
import { canonicalSize } from "@/lib/tyre-size";
import { ProductCard } from "@/components/ProductCard";
import { ShopFilters } from "@/components/ShopFilters";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { NoResultsHelp } from "@/components/NoResultsHelp";
import { SortSelect } from "@/components/SortSelect";
import { ShopPromo } from "@/components/ShopPromo";
import { Chevron, Truck } from "@/components/icons";

import { shopHref } from "@/lib/shop-url";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The shop listing (filters, sort, results, pagination). Used by /shop and by
 *  the category pages at /product-category/<slug>. */
export async function ShopListing({ sp }: { sp: SP }) {
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const q = one(sp.q) ?? "";
  const category = one(sp.category);
  const type = one(sp.type) as "tyre" | "wheel" | undefined;
  const priceNum = (v: string | undefined) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

  // Multi-size union (from the vehicle "show all sizes" CTA): ?sizes=265/60 R18|265/65 R17
  const sizesParam = one(sp.sizes);
  const sizeList = sizesParam ? sizesParam.split("|").map((s) => s.trim()).filter(Boolean) : [];
  const canonSizes = [...new Set(sizeList.map((s) => canonicalSize(s)).filter((s): s is string => !!s))];
  const vehicleCtx = one(sp.vehicle); // display-only "2021 Toyota Hilux …"

  // Item 18: a query that isn't a size but names a vehicle (e.g. "hilux",
  // "toyota hilux 2021") shows that vehicle's factory-fitment tyres.
  let vehicle: ReturnType<typeof findVehicle> = null;
  let vehicleSizes: string[] | undefined;
  if (q && !detectTyreSize(q)) {
    vehicle = findVehicle(q);
    if (vehicle) {
      const hasYear = /\b(19|20)\d{2}\b/.test(q);
      vehicleSizes = hasYear
        ? [...new Set(vehicle.tyres.map((t) => t.replace(/\s+/g, "").toUpperCase()))].filter((s) => /^\d{2,3}\/\d{2}R\d{2}$/.test(s))
        : factorySizes(vehicle.make, vehicle.model);
      if (!vehicleSizes.length) { vehicle = null; vehicleSizes = undefined; }
    }
  }

  const result = await queryProducts({
    q: vehicle ? "" : q,
    sizes: canonSizes.length ? canonSizes : vehicleSizes,
    category,
    type,
    brand: one(sp.brand),
    width: one(sp.width),
    profile: one(sp.profile),
    rim: one(sp.rim),
    pcd: one(sp.pcd),
    runFlat: one(sp.runflat) === "1",
    extraLoad: one(sp.xl) === "1",
    minPrice: priceNum(one(sp.min)),
    maxPrice: priceNum(one(sp.max)),
    onSale: one(sp.onSale) === "1",
    inStock: one(sp.instock) === "1",
    sort: (one(sp.sort) as "relevance" | "price-asc" | "price-desc" | "name" | "newest") ?? "relevance",
    page,
    perPage: 24,
  });

  const [cat, categories, brands] = await Promise.all([category ? findCategory(category) : undefined, shopCategories(), filterBrands()]);
  const heading = vehicle
    ? `Tyres for your ${vehicle.make} ${vehicle.model}`
    : vehicleCtx
      ? `Tyres for your ${vehicleCtx}`
      : q
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
    return shopHref(next);
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

      {vehicle && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-volt/30 bg-volt/10 px-4 py-3 text-sm">
          <Truck width={18} height={18} className="text-volt" />
          <span className="font-semibold text-fg">
            Factory fitment for {vehicle.make} {vehicle.model}{vehicle.label ? ` (${vehicle.label})` : ""}:
          </span>
          <span className="text-muted">
            {vehicleSizes?.map((s) => s.replace("R", " R")).join(" · ")}
          </span>
          <Link href="/shop" className="ml-auto text-xs font-bold text-volt hover:underline">Clear</Link>
        </div>
      )}

      {sizeList.length > 0 && (
        <div className="mt-4 rounded-xl border border-volt/30 bg-volt/10 px-4 py-3 text-sm">
          <span className="font-semibold text-fg">
            Showing {result.total.toLocaleString()} {result.total === 1 ? "tyre" : "tyres"} in {sizeList.length} {sizeList.length === 1 ? "size" : "sizes"}
            {vehicleCtx ? ` for your ${vehicleCtx}` : ""}:
          </span>
          <span className="mt-2 flex flex-wrap gap-2">
            {sizeList.map((s) => {
              const others = sizeList.filter((x) => x !== s);
              const u = new URLSearchParams();
              u.set("type", "tyre");
              if (others.length) u.set("sizes", others.join("|"));
              if (vehicleCtx) u.set("vehicle", vehicleCtx);
              return (
                <Link key={s} href={`/shop?${u.toString()}`} className="inline-flex items-center gap-1.5 rounded-full border border-volt/40 bg-volt/10 px-3 py-1 text-xs font-semibold text-volt hover:bg-volt/20">
                  {s} <span aria-hidden>✕</span>
                </Link>
              );
            })}
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* sidebar */}
        <aside className="lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-1">
          <ShopFilters
            categories={categories}
            brands={brands}
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

          <ActiveFilterChips search={searchStr} categories={categories} />

          {result.items.length === 0 ? (
            <NoResultsHelp query={q || (vehicle ? `${vehicle.make} ${vehicle.model}` : "")} />
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
