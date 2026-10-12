"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { FITMENT_CENTRES, PAYMENT_METHODS } from "@/lib/shop-config";
import { Check, Truck, Pin, Shield, Bolt } from "@/components/icons";

export default function CheckoutPage() {
  const { items, totals, deliveryMethod, fitmentStoreId, fitmentDate } = useCart();
  const [payment, setPayment] = useState("payfast");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const centre = FITMENT_CENTRES.find((f) => f.id === fitmentStoreId) ?? FITMENT_CENTRES[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      customer: {
        firstName: String(fd.get("firstName") ?? ""),
        lastName: String(fd.get("lastName") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
      },
      delivery:
        deliveryMethod === "fitment"
          ? { method: "fitment" as const, fitmentStore: centre?.name, fitmentDate: fitmentDate ?? undefined }
          : {
              method: "delivery" as const,
              address: {
                street: String(fd.get("street") ?? ""),
                suburb: String(fd.get("suburb") ?? ""),
                city: String(fd.get("city") ?? ""),
                province: String(fd.get("province") ?? ""),
                postalCode: String(fd.get("postalCode") ?? ""),
              },
            },
      items: items.map((i) => ({
        slug: i.slug, qty: i.qty, roadHazard: i.roadHazard, alignment: i.alignment, balanceQty: i.balanceQty,
      })),
      paymentMethod: payment,
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      if (data.gateway === false) {
        setError(data.message ?? "That payment method isn't available yet. Please choose PayFast.");
        setSubmitting(false);
        return;
      }
      // Auto-submit a hidden form to PayFast.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.processUrl;
      for (const [k, v] of Object.entries(data.fields as Record<string, string>)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Network error — please check your connection and try again.");
      setSubmitting(false);
    }
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
        <form className="space-y-8" onSubmit={handleSubmit}>
          <Section n={1} title="Your details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Mobile" type="tel" required />
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
                <div className="sm:col-span-2"><Field name="street" label="Street address" required /></div>
                <Field name="suburb" label="Suburb" required />
                <Field name="city" label="City" required />
                <Field name="province" label="Province" required />
                <Field name="postalCode" label="Postal code" required />
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
                      {m.id !== "payfast" && <span className="text-[10px] font-bold uppercase tracking-wide text-muted">coming soon</span>}
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
              Payments are processed securely by PayFast. Card details are never stored on this site.
            </p>
          </Section>

          {error && (
            <div className="rounded-xl border border-sale/40 bg-sale/10 p-3 text-sm font-semibold text-sale">{error}</div>
          )}

          <button type="submit" disabled={submitting} className="btn btn-volt w-full py-4 text-base disabled:opacity-60">
            {submitting ? "Redirecting to secure payment…" : <><Bolt width={18} height={18} /> Pay securely · {formatPrice(totals.total)}</>}
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
              {totals.setDiscount > 0 && <SumRow label="Set of 4 saving" value={`−${formatPrice(totals.setDiscount)}`} highlight />}
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

function Field({ name, label, type = "text", required }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input
        name={name}
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
