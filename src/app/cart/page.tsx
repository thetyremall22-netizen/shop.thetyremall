"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { FITMENT_CENTRES, STANDARD_DELIVERY_FEE } from "@/lib/shop-config";
import { Trash, Plus, Minus, Truck, Pin, Check, Shield, Bolt } from "@/components/icons";

export default function CartPage() {
  const { items, totals, setQty, remove, toggleHazard, deliveryMethod, setDelivery, fitmentStoreId, setFitment } = useCart();

  if (items.length === 0) {
    return (
      <div className="container-x grid place-items-center py-24 text-center">
        <div>
          <h1 className="font-display text-4xl">Your cart is empty</h1>
          <p className="mt-2 text-muted">Let&apos;s find you some rubber.</p>
          <Link href="/shop" className="btn btn-volt mt-6">Shop tyres</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="font-display text-4xl">Your Cart</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {/* free delivery bar */}
          <div className="card p-4">
            {totals.freeDelivery ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-pay"><Check width={16} height={16} /> FREE nationwide delivery unlocked!</p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted"><Truck width={16} height={16} className="text-volt" /> Add <b className="text-fg">{totals.tyresToFreeDelivery} more tyre{totals.tyresToFreeDelivery > 1 ? "s" : ""}</b> for FREE delivery</p>
            )}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-volt transition-all" style={{ width: `${Math.min(100, (totals.tyreQty / 2) * 100)}%` }} />
            </div>
          </div>

          {items.map((i) => (
            <div key={i.id} className="card flex gap-4 p-4">
              <Link href={`/product/${i.slug}`} className="plate grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl">
                {i.image && <Image src={i.image} alt="" width={96} height={96} className="size-24 object-contain p-2" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-volt">{i.brand}</div>
                    <Link href={`/product/${i.slug}`} className="line-clamp-2 font-semibold text-fg hover:text-volt">{i.name}</Link>
                  </div>
                  <button onClick={() => remove(i.id)} aria-label="Remove" className="shrink-0 text-faint hover:text-sale"><Trash width={18} height={18} /></button>
                </div>

                {i.type === "tyre" && (
                  <button onClick={() => toggleHazard(i.id)} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
                    <span className={`grid size-4 place-items-center rounded border ${i.roadHazard ? "border-volt bg-volt" : "border-line-2"}`}>
                      {i.roadHazard && <Check width={11} height={11} className="text-volt-ink" />}
                    </span>
                    <Shield width={13} height={13} className="text-volt" /> Road hazard cover
                  </button>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-line">
                    <button onClick={() => setQty(i.id, i.qty - 1)} className="grid size-9 place-items-center text-muted hover:text-fg" aria-label="Decrease"><Minus width={15} height={15} /></button>
                    <span className="w-9 text-center font-semibold">{i.qty}</span>
                    <button onClick={() => setQty(i.id, i.qty + 1)} className="grid size-9 place-items-center text-muted hover:text-fg" aria-label="Increase"><Plus width={15} height={15} /></button>
                  </div>
                  <span className="font-display text-lg">{formatPrice(i.price * i.qty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* summary */}
        <aside className="lg:sticky lg:top-40 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-display text-xl">Order Summary</h2>

            {/* delivery method */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setDelivery("delivery")} className={`flex flex-col items-start rounded-xl border p-3 text-left ${deliveryMethod === "delivery" ? "border-volt bg-volt/5" : "border-line"}`}>
                <Truck width={18} height={18} className={deliveryMethod === "delivery" ? "text-volt" : "text-muted"} />
                <span className="mt-1 text-sm font-bold">Delivery</span>
                <span className="text-xs text-muted">{totals.freeDelivery ? "FREE" : formatPrice(STANDARD_DELIVERY_FEE)}</span>
              </button>
              <button onClick={() => setDelivery("fitment")} className={`flex flex-col items-start rounded-xl border p-3 text-left ${deliveryMethod === "fitment" ? "border-volt bg-volt/5" : "border-line"}`}>
                <Pin width={18} height={18} className={deliveryMethod === "fitment" ? "text-volt" : "text-muted"} />
                <span className="mt-1 text-sm font-bold">Fit in Joburg</span>
                <span className="text-xs text-muted">partner centre</span>
              </button>
            </div>

            {deliveryMethod === "fitment" && (
              <select
                value={fitmentStoreId ?? FITMENT_CENTRES[0].id}
                onChange={(e) => setFitment(e.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm font-semibold outline-none focus:border-volt"
              >
                {FITMENT_CENTRES.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.area}</option>)}
              </select>
            )}

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
              {totals.hazardTotal > 0 && <Row label="Road hazard cover" value={formatPrice(totals.hazardTotal)} />}
              {totals.alignmentTotal > 0 && <Row label="Wheel alignment" value={formatPrice(totals.alignmentTotal)} />}
              {totals.balanceTotal > 0 && <Row label="Balance & valve" value={formatPrice(totals.balanceTotal)} />}
              <Row label="Delivery" value={totals.delivery === 0 ? "FREE" : formatPrice(totals.delivery)} highlight={totals.delivery === 0} />
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-2xl text-volt">{formatPrice(totals.total)}</span>
            </div>
            <div className="mt-1 text-right text-xs text-pay">or 3× {formatPrice(Math.round(totals.total / 3))} with HappyPay</div>

            <Link href="/checkout" className="btn btn-volt mt-5 w-full py-3.5 text-base"><Bolt width={18} height={18} /> Checkout</Link>
            <Link href="/shop" className="btn btn-ghost mt-2 w-full">Continue shopping</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={highlight ? "font-semibold text-pay" : "text-fg"}>{value}</dd>
    </div>
  );
}
