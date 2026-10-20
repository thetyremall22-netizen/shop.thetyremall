"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { useAccount } from "@/lib/account-client";
import { attributionForOrder } from "@/components/AttributionTracker";
import { formatPrice } from "@/lib/format";
import { FITMENT_CENTRES, PAYMENT_METHODS } from "@/lib/shop-config";
import { Check, Truck, Pin, Shield, Bolt } from "@/components/icons";

export default function CheckoutPage() {
  const { items, totals, deliveryMethod, fitmentStoreId, fitmentDate } = useCart();
  const [payment, setPayment] = useState("payfast");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const centre = FITMENT_CENTRES.find((f) => f.id === fitmentStoreId) ?? FITMENT_CENTRES[0];
  const payTotal = Math.max(0, totals.total - (coupon?.discount ?? 0));

  // Restore the customer details + applied coupon after a round-trip to the
  // payment gateway (or an accidental refresh). Runs once the cart has hydrated
  // and the form is rendered (cart items persist separately via the cart store).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || items.length === 0) return;
    let saved: { fields?: Record<string, string>; couponCode?: string } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem("ttm-checkout") || "null"); } catch { /* ignore */ }
    if (!saved) { restoredRef.current = true; return; }
    restoredRef.current = true;
    const form = formRef.current;
    if (form && saved.fields) {
      for (const [k, v] of Object.entries(saved.fields)) {
        const el = form.elements.namedItem(k) as HTMLInputElement | null;
        if (el && !el.value) el.value = v;
      }
    }
    if (saved.couponCode) {
      setCouponInput(saved.couponCode);
      fetch("/api/coupon/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: saved.couponCode, items: items.map((i) => ({ slug: i.slug, qty: i.qty })) }) })
        .then((r) => r.json()).then((d) => { if (d.valid && d.discount > 0) setCoupon({ code: d.code, discount: d.discount }); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Signed-in client: fill in their saved details and address (only empty boxes,
  // so anything typed or restored above is kept).
  const { customer } = useAccount();
  useEffect(() => {
    const form = formRef.current;
    if (!customer || !form || items.length === 0) return;
    const vals: Record<string, string> = {
      firstName: customer.firstName, lastName: customer.lastName, email: customer.email,
      phone: customer.phone.replace(/^\+27/, "0"), ...customer.address,
    };
    for (const [k, v] of Object.entries(vals)) {
      const el = form.elements.namedItem(k) as HTMLInputElement | null;
      if (el && !el.value && v) el.value = v;
    }
  }, [customer, items.length, deliveryMethod]);

  // Cart Recovery: as the shopper fills in checkout, save their cart + details
  // (once a valid email is entered) so a recovery email can go out if they
  // don't finish. Sent at most every few seconds, and only when something changed.
  const lastCapture = useRef("");
  function captureForRecovery() {
    const form = formRef.current;
    if (!form || items.length === 0) return;
    const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim();
    const email = v("email");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return;
    const payload = {
      email, firstName: v("firstName"), lastName: v("lastName"), phone: v("phone"),
      address: { street: v("street"), suburb: v("suburb"), city: v("city"), province: v("province"), postalCode: v("postalCode") },
      total: totals.total,
      items: items.map((i) => ({ name: i.name, qty: i.qty, price: i.price, slug: i.slug, image: i.image, roadHazard: i.roadHazard, alignment: i.alignment, balanceQty: i.balanceQty })),
    };
    const key = JSON.stringify(payload);
    if (key === lastCapture.current) return;
    lastCapture.current = key;
    fetch("/api/cart-recovery/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, keepalive: true }).catch(() => {});
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true); setCouponMsg(null);
    const email = (document.querySelector('input[name="email"]') as HTMLInputElement | null)?.value || undefined;
    try {
      const res = await fetch("/api/coupon/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, items: items.map((i) => ({ slug: i.slug, qty: i.qty })) }),
      });
      const d = await res.json();
      if (d.valid && d.discount > 0) { setCoupon({ code: d.code, discount: d.discount }); setCouponMsg(null); }
      else { setCoupon(null); setCouponMsg(d.error ?? "That code isn't valid."); }
    } catch { setCouponMsg("Couldn't check that code."); }
    setCouponBusy(false);
  }
  function removeCoupon() { setCoupon(null); setCouponInput(""); setCouponMsg(null); }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    // Persist details + coupon so they survive the trip to the payment gateway.
    try {
      const fields: Record<string, string> = {};
      fd.forEach((v, k) => { if (typeof v === "string") fields[k] = v; });
      sessionStorage.setItem("ttm-checkout", JSON.stringify({ fields, couponCode: coupon?.code }));
    } catch { /* ignore */ }
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
      couponCode: coupon?.code,
      attribution: attributionForOrder(),
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
      // HappyPay (and other redirect-based gateways): go to the provider.
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
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

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        {/* form */}
        <form ref={formRef} className="min-w-0 space-y-8" onSubmit={handleSubmit} onBlur={captureForRecovery}>
          <Section n={1} title="Your details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="firstName" label="First name" required />
              <Field name="lastName" label="Last name" required />
              <Field
                name="email"
                label="Email"
                type="email"
                required
              />
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

          {payTotal === 0 ? (
          <Section n={3} title="Payment">
            <div className="rounded-xl border border-volt/40 bg-volt/10 p-4 text-sm font-semibold text-volt">
              ✓ Your coupon covers the full amount — no payment needed. Just place your order below.
            </div>
          </Section>
          ) : (
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
                      {!m.live && <span className="text-[10px] font-bold uppercase tracking-wide text-muted">coming soon</span>}
                    </span>
                    <span className="text-sm text-muted">{m.blurb}</span>
                  </span>
                  {m.id === "happypay" && <Bolt width={18} height={18} className="text-pay" />}
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
          )}

          {error && (
            <div className="rounded-xl border border-sale/40 bg-sale/10 p-3 text-sm font-semibold text-sale">{error}</div>
          )}

          <button type="submit" disabled={submitting} className="btn btn-volt w-full py-4 text-base disabled:opacity-60">
            {submitting
              ? (payTotal === 0 ? "Placing your order…" : "Redirecting to secure payment…")
              : payTotal === 0
                ? <><Bolt width={18} height={18} /> Place order · FREE</>
                : <><Bolt width={18} height={18} /> Pay securely · {formatPrice(payTotal)}</>}
          </button>
        </form>

        {/* summary */}
        <aside className="min-w-0 lg:sticky lg:top-40 lg:h-fit">
          <div className="card p-5">
            <h2 className="font-display text-xl">Your order</h2>
            <ul className="mt-4 space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <span className="relative size-14 shrink-0">
                    <span className="plate grid size-14 place-items-center overflow-hidden rounded-lg">
                      {i.image && <Image src={i.image} alt="" width={56} height={56} className="size-14 object-contain p-1" />}
                    </span>
                    <span className="absolute -right-1.5 -top-1.5 z-10 grid size-5 place-items-center rounded-full bg-volt text-[11px] font-black text-volt-ink">{i.qty}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium text-fg">{i.name}</div>
                    {i.roadHazard && <div className="flex items-center gap-1 text-[11px] text-volt"><Shield width={11} height={11} /> Road hazard cover</div>}
                  </div>
                  <span className="shrink-0 whitespace-nowrap text-sm font-semibold">{formatPrice(i.price * i.qty)}</span>
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
              {coupon && <SumRow label={`Coupon ${coupon.code}`} value={`−${formatPrice(coupon.discount)}`} highlight />}
            </dl>

            {/* Coupon code */}
            <div className="mt-4 border-t border-line pt-4">
              {coupon ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-volt/10 px-3 py-2 text-sm">
                  <span className="font-semibold text-volt">✓ {coupon.code} applied</span>
                  <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-muted hover:text-sale">Remove</button>
                </div>
              ) : (
                <>
                  <label className="mb-1.5 block text-xs font-semibold text-muted">Coupon code</label>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Enter code"
                      className="h-10 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
                    />
                    <button type="button" onClick={applyCoupon} disabled={couponBusy || !couponInput.trim()} className="btn btn-ghost h-10 px-4 text-sm disabled:opacity-50">{couponBusy ? "…" : "Apply"}</button>
                  </div>
                  {couponMsg && <p className="mt-1.5 text-xs font-semibold text-sale">{couponMsg}</p>}
                </>
              )}
            </div>

            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <span className="shrink-0 font-bold">Total</span>
              <span className="min-w-0 whitespace-nowrap font-display text-2xl leading-tight text-volt">{formatPrice(payTotal)}</span>
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

function Field({ name, label, type = "text", required, onBlur }: { name: string; label: string; type?: string; required?: boolean; onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}{required && <span className="text-sale"> *</span>}</span>
      <input
        name={name}
        type={type}
        required={required}
        onBlur={onBlur}
        className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-volt"
      />
    </label>
  );
}

function SumRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={`shrink-0 whitespace-nowrap ${highlight ? "font-semibold text-pay" : "text-fg"}`}>{value}</dd>
    </div>
  );
}
