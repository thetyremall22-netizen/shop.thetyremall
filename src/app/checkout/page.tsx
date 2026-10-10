"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { FITMENT_CENTRES, PAYMENT_METHODS, STANDARD_DELIVERY_FEE } from "@/lib/shop-config";
import { Check, Truck, Pin, Shield, Bolt } from "@/components/icons";

export default function CheckoutPage() {
  const { items, totals, deliveryMethod, fitmentStoreId, clear } = useCart();
  const [payment, setPayment] = useState("payfast");
  const [placed, setPlaced] = useState(false);
  const centre = FITMENT_CENTRES.find((f) => f.id === fitmentStoreId) ?? FITMENT_CENTRES[0];

  if (placed) {
    return (
      <div className="container-x grid place-items-center py-24 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-pay/15 text-pay">
            <Check width={40} height={40} />
          </div>
          <h1 className="mt-6 font-display text-4xl">Order placed!</h1>
          <p className="mt-3 text-muted">
            Thanks for your order. In the live store you&apos;d now be redirected to{" "}
            <b className="text-fg">{PAYMENT_METHODS.find((m) => m.id === payment)?.name}</b> to complete secure payment.
          </p>
          <Link href="/" className="btn btn-volt mt-6">Back to home</Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-x grid place-items-center py-24 text-center">
        <div>
          <h1 className="font-display text-4xl">Nothing to check out</h1>
          <Link href="/shop" className="btn btn-volt mt-6">Shop tyres</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-8 lg:py-12">
      <h1 className="font-display text-4xl">Checkout</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* form */}
        <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); setPlaced(true); clear(); }}>
          <Section n={1} title="Your details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" required />
              <Field label="Last name" required />
              <Field label="Email" type="email" required />
              <Field label="Mobile" type="tel" required />
            </div>
          </Section>

          <Section n={2} title={deliveryMethod === "fitment" ? "Fitment centre" : "Delivery address"}>
            {deliveryMethod === "fitment" ? (
              <div className="flex items-start gap-3 rounded-xl border border-volt/40 bg-volt/5 p-4">
                <Pin width={20} height={20} className="mt-0.5 text-volt" />
                <div>
                  <div className="font-bold text-fg">{centre.name}</div>
                  <div className="text-sm text-muted">{centre.address}</div>
                  <div className="mt-1 text-xs text-pay">We&apos;ll call to book your fitment slot.</div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Street address" required /></div>
                <Field label="Suburb" required />
                <Field label="City" required />
                <Field label="Province" required />
                <Field label="Postal code" required />
              </div>
            )}
          </Section>

          <Section n={3} title="Payment method">
            <div className="space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPayment(m.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${payment === m.id ? "border-volt bg-volt/5" : "border-line bg-surface hover:border-line-2"}`}
                >
                  <span className={`grid size-5 shrink-0 place-items-center rounded-full border ${payment === m.id ? "border-volt bg-volt" : "border-line-2"}`}>
                    {payment === m.id && <span className="size-2 rounded-full bg-volt-ink" />}
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-fg">{m.name}</span>
                      <span className="badge badge-pay">{m.tag}</span>
                    </span>
                    <span className="text-sm text-muted">{m.blurb}</span>
                  </span>
                  {m.id !== "payfast" && <Bolt width={18} height={18} className="text-pay" />}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-white p-2.5">
              <Image src="/brand/payments.png" alt="Accepted payment methods" width={1920} height={120} className="h-auto w-full" />
            </div>
            <p className="mt-3 text-xs text-muted">
              Payments are processed securely by the provider. Card details are never stored on this site.
            </p>
          </Section>

          <button type="submit" className="btn btn-volt w-full py-4 text-base">
            <Bolt width={18} height={18} /> Place order · {formatPrice(totals.total)}
          </button>
        </form>

        {/* summary */}
        <aside className="lg:sticky lg:top-40 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-display text-xl">Your order</h2>
            <ul className="mt-4 space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <span className="plate relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg">
                    {i.image && <Image src={i.image} alt="" width={56} height={56} className="size-14 object-contain p-1" />}
                    <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-volt text-[11px] font-black text-volt-ink">{i.qty}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-fg">{i.name}</div>
                    {i.roadHazard && <div className="flex items-center gap-1 text-[11px] text-volt"><Shield width={11} height={11} /> Road hazard cover</div>}
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(i.price * i.qty)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <SumRow label="Subtotal" value={formatPrice(totals.subtotal)} />
              {totals.hazardTotal > 0 && <SumRow label="Road hazard" value={formatPrice(totals.hazardTotal)} />}
              {totals.alignmentTotal > 0 && <SumRow label="Wheel alignment" value={formatPrice(totals.alignmentTotal)} />}
              {totals.balanceTotal > 0 && <SumRow label="Balance & valve" value={formatPrice(totals.balanceTotal)} />}
              <SumRow
                label={deliveryMethod === "fitment" ? "Fitment delivery" : "Delivery"}
                value={totals.delivery === 0 ? "FREE" : formatPrice(totals.delivery)}
                highlight={totals.delivery === 0}
              />
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="font-bold">Total</span>
              <span className="font-display text-2xl text-volt">{formatPrice(totals.total)}</span>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted">
              <Truck width={15} height={15} className="text-volt" />
              {totals.freeDelivery ? "Free nationwide delivery included" : "Add 2+ tyres for free delivery"}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 font-display text-xl">
        <span className="grid size-7 place-items-center rounded-full bg-volt text-sm text-volt-ink">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, type = "text", required }: { label: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input
        type={type}
        required={required}
        className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
      />
    </label>
  );
}

function SumRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={highlight ? "font-semibold text-pay" : "text-fg"}>{value}</dd>
    </div>
  );
}
