import Link from "next/link";
import { dealProducts } from "@/lib/catalogue";
import { specialStatus, type SpecialCategory } from "@/lib/special-categories";
import { ProductCard } from "@/components/ProductCard";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });

/** Shown instead of an empty page (or a 404) when a special or sale isn't
 *  running: on its own /product-category page and on landing pages that show
 *  it. Says it has ended (or when it starts) and offers today's deals. */
export async function SpecialEnded({ special, limit = 8, heading }: { special: SpecialCategory; limit?: number; heading?: string }) {
  const status = specialStatus(special);
  const message =
    status === "ended" ? `${special.name} has ended${special.endAt ? ` (it ran until ${day(special.endAt)})` : ""}. Thanks for the support. Here are our current deals instead.`
    : status === "scheduled" && special.startAt ? `${special.name} starts on ${day(special.startAt)}. Check back then. In the meantime, here are our current deals.`
    : `${special.name} isn't running right now. Here are our current deals instead.`;
  const deals = (await dealProducts(limit * 4)).filter((p) => p.inStock).slice(0, limit);
  return (
    <section>
      <div className="card border-volt/30 p-6 sm:p-8">
        <h2 className="font-display text-2xl sm:text-3xl">{heading || special.name}</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">{message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/product-category/hot-dealz" className="btn btn-volt h-10 px-5 text-sm">See all deals</Link>
          <Link href="/shop" className="btn btn-dark h-10 px-5 text-sm">Browse the shop</Link>
        </div>
      </div>
      {deals.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {deals.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}

/** A deal product's page once its special / sale has ended: say so, link to the
 *  normal product, and offer today's deals (instead of a 404). */
export async function DealProductEnded({ specialName, original }: { specialName: string; original?: { slug: string; name: string } | null }) {
  const deals = (await dealProducts(32)).filter((p) => p.inStock).slice(0, 8);
  return (
    <div className="container-x py-6 lg:py-10">
      <section className="card border-volt/30 p-6 sm:p-8">
        <h1 className="font-display text-2xl sm:text-3xl">This {specialName} deal has ended</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted sm:text-base">
          Thanks for the support. {original ? <>The tyre is still in the shop at its normal price.</> : <>Here are our current deals instead.</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {original && <Link href={`/product/${original.slug}`} className="btn btn-volt h-10 px-5 text-sm">View {original.name}</Link>}
          <Link href="/product-category/hot-dealz" className={`btn ${original ? "btn-dark" : "btn-volt"} h-10 px-5 text-sm`}>See all deals</Link>
          <Link href="/shop" className="btn btn-dark h-10 px-5 text-sm">Browse the shop</Link>
        </div>
      </section>
      {deals.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {deals.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
