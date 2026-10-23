import Link from "next/link";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { getProductsFresh } from "@/lib/catalogue";
import { feedProblem, merchantId } from "@/lib/merchant";
import retired from "@/data/retired-products.json";

export const instant = false;

const FEED = "https://thetyremall.co.za/feeds/google-merchant.xml";

export default async function GoogleMerchantFeed() {
  await requirePermission("products.view");
  const products = await getProductsFresh();
  const left = products.map((p) => ({ p, why: feedProblem(p) })).filter((x) => x.why);
  const sent = products.length - left.length;
  const inStock = products.filter((p) => !feedProblem(p) && p.inStock).length;

  return (
    <AdminShell>
      <Link href="/admin/products" className="text-sm font-semibold text-muted hover:text-volt">← Products</Link>
      <h1 className="mt-2 font-display text-3xl">Google Merchant Center feed</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Your products go to Google Shopping, free listings and Google Ads through this feed. It&apos;s built live from your products every time Google fetches it,
        so price and stock changes in the admin are picked up automatically on Google&apos;s next daily fetch.
      </p>

      <div className="mt-4 card p-5">
        <div className="text-xs font-semibold uppercase text-muted">Feed link (paste into Merchant Center)</div>
        <div className="mt-1 break-all font-mono text-sm text-volt">{FEED}</div>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-fg">
          <li>Merchant Center → <b>Products</b> → <b>Add products</b> → <b>Add from a file</b> → <b>Enter a link to your file</b>.</li>
          <li>Paste the link above, set the fetch to <b>daily</b>, country South Africa, language English.</li>
          <li>Once Google has processed it, remove the old <b>Google for WooCommerce</b> data source so products aren&apos;t listed twice.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">Product IDs are the same as before ({products[0] ? merchantId(products[0]) : "gla_…"} etc.), so Google treats them as the same products and keeps their history.</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Sent to Google</div><div className="font-display text-3xl">{sent.toLocaleString()}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">In stock</div><div className="font-display text-3xl">{inStock.toLocaleString()}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Left out</div><div className="font-display text-3xl">{left.length}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold uppercase text-muted">Old products redirected to similar</div><div className="font-display text-3xl">{(retired as unknown[]).length.toLocaleString()}</div></div>
      </div>

      {left.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-2xl">Left out of the feed — fix these to list them on Google</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Why</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {left.map(({ p, why }) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-muted">{why}</td>
                    <td className="px-3 py-2 text-right"><Link href={`/admin/products/${encodeURIComponent(p.slug)}`} className="font-semibold text-volt hover:underline">Edit →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
