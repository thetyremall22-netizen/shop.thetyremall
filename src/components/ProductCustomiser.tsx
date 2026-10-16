"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { setDiscountFor, setPriceOf4, SET_OF_4_DISCOUNT, hasSetPricing } from "@/lib/pricing";
import { WhatsAppButton } from "./WhatsAppButton";
import {
  FITMENT_STORES,
  FREE_DELIVERY_MIN_TYRES,
  STANDARD_DELIVERY_FEE,
  ALIGNMENT_FEE,
  BALANCE_PER_TYRE,
  HAPPYPAY_URL,
} from "@/lib/shop-config";
import { Plus, Minus, Truck, Pin, Check, Bolt, Cart, ChevronDown, Shield } from "./icons";

type Item = Omit<CartItem, "qty" | "roadHazard" | "alignment" | "balanceQty">;

function SelBadge() {
  return (
    <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-volt text-volt-ink shadow">
      <Check width={12} height={12} />
    </span>
  );
}

function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-volt text-xs font-black text-volt-ink">{n}</span>
      <span className="text-sm font-bold uppercase tracking-wide text-fg">{children}</span>
    </div>
  );
}

export function ProductCustomiser({ item, inStock, sku, size }: { item: Item; inStock: boolean; sku?: string; size?: string }) {
  const router = useRouter();
  const { add, setDelivery, setFitment, setFitmentDate } = useCart();
  const isTyre = item.type === "tyre";

  const [qty, setQty] = useState(isTyre ? 2 : 1);
  const [method, setMethod] = useState<"delivery" | "fitment">("delivery");
  const [alignment, setAlignment] = useState(false);
  const [balanceQty, setBalanceQty] = useState(0);
  const [store, setStore] = useState(FITMENT_STORES[0].id);
  const [date, setDate] = useState("");

  const t = useMemo(() => {
    const base = item.price * qty;
    const setDiscount = setDiscountFor(item.price, qty, item.type);
    const alignFee = alignment && isTyre ? ALIGNMENT_FEE : 0;
    const balanceFee = isTyre ? balanceQty * BALANCE_PER_TYRE : 0;
    const freeDelivery = !isTyre || qty >= FREE_DELIVERY_MIN_TYRES;
    const delivery = method === "fitment" ? 0 : freeDelivery ? 0 : STANDARD_DELIVERY_FEE;
    const options = alignFee + balanceFee;
    return { base, setDiscount, alignFee, balanceFee, delivery, options, freeDelivery, total: base - setDiscount + options + delivery };
  }, [item.price, qty, alignment, balanceQty, method, isTyre, item.type]);

  const need = Math.max(0, FREE_DELIVERY_MIN_TYRES - qty);

  // HappyPay on-site widget: inject their official script once. It builds the
  // "Choose how you pay" modal and defines the globals show_happy_modal() /
  // setProductAmount() used by our callout below (same widget the old site used).
  const hpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (document.getElementById("ttm-happypay-widget")) return;
    const el = hpRef.current;
    if (!el) return;
    const sc = document.createElement("script");
    sc.id = "ttm-happypay-widget";
    sc.className = "happypay_script";
    sc.async = true;
    sc.src = `https://widgets.happypay.co.za/integrations/shopify_widget.js?amount=${(item.price / 100).toFixed(2)}`;
    el.appendChild(sc);
  }, [item.price]);

  function openHappyPay() {
    const w = window as unknown as { show_happy_modal?: () => void; setProductAmount?: (n: number) => void };
    if (typeof w.show_happy_modal === "function") {
      // Feed the live order amount (rands) so the plan figures match the cart.
      w.setProductAmount?.(t.total / 100);
      w.show_happy_modal();
    } else {
      window.open(HAPPYPAY_URL, "_blank", "noopener,noreferrer");
    }
  }

  function commit() {
    add({ ...item, roadHazard: false, alignment: alignment && isTyre, balanceQty: isTyre ? balanceQty : 0 }, qty);
    setDelivery(method);
    setFitment(method === "fitment" ? store : null);
    setFitmentDate(method === "fitment" ? date || null : null);
  }

  return (
    <div className="space-y-5">
      {/* HappyPay callout — opens the official HappyPay "how to pay" popup */}
      <button
        type="button"
        onClick={openHappyPay}
        className="group flex w-full items-center gap-3 rounded-xl bg-[#FFD400] p-3 text-left text-black transition-transform hover:-translate-y-0.5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-black text-[#FFD400]">
          <Bolt width={20} height={20} />
        </span>
        <span className="flex-1 leading-tight">
          <span className="block text-sm font-black uppercase">Choose HappyPay — pay over 2 months</span>
          <span className="block text-xs font-semibold">0% interest · no upfront · 2× {formatPrice(Math.round(t.total / 2))}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs font-black uppercase text-[#FFD400] group-hover:bg-neutral-800">
          Check if you qualify →
        </span>
      </button>
      {/* Hidden mount point for the HappyPay widget script (modal renders to <body>) */}
      <div ref={hpRef} className="hidden" aria-hidden="true" />

      {/* 1 — quantity */}
      <div>
        <StepLabel n={1}>How many do you need?</StepLabel>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-line bg-surface-2">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid size-11 place-items-center text-muted hover:text-fg" aria-label="Decrease"><Minus width={16} height={16} /></button>
            <span className="w-12 text-center font-display text-xl">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="grid size-11 place-items-center text-muted hover:text-fg" aria-label="Increase"><Plus width={16} height={16} /></button>
          </div>
          {isTyre && (
            <div className="flex gap-1.5">
              {[2, 4].map((n) => (
                <button key={n} onClick={() => setQty(n)} className={`tappable rounded-lg border px-3 py-1.5 text-xs font-bold ${qty === n ? "is-selected text-volt" : "border-line text-muted hover:text-fg"}`}>{n}</button>
              ))}
            </div>
          )}
        </div>
        {isTyre && (
          t.setDiscount > 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 px-4 py-2.5 text-sm font-bold text-volt">
              <Check width={16} height={16} /> Set of 4 price applied — you save {formatPrice(t.setDiscount)}
            </div>
          ) : (
            <button onClick={() => setQty(4)} className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-line-2 bg-surface px-4 py-2.5 text-left text-sm text-muted transition-colors hover:border-volt hover:text-fg">
              <span>Buy a <b className="text-fg">set of 4</b> → <span className="font-bold text-volt">{formatPrice(setPriceOf4(item.price))}</span></span>
              <span className="shrink-0 rounded-full bg-volt/15 px-2 py-0.5 text-xs font-black text-volt">save {formatPrice(SET_OF_4_DISCOUNT)}</span>
            </button>
          )
        )}
        {isTyre && (t.freeDelivery ? (
          <div key="free-unlocked" className="pop-in shine-sweep mt-3 rounded-xl border border-volt/40 bg-pay/10 px-4 py-3.5 shadow-[0_0_24px_-6px_rgba(138,197,63,0.5)]">
            <div className="flex flex-wrap items-baseline gap-x-[0.3em] gap-y-1 font-display text-[1.9rem] leading-[0.9] sm:text-4xl">
              {["FREE", "DELIVERY", "UNLOCKED!"].map((w, i) => (
                <span key={w} className="fly-word in" style={{ ["--delay" as string]: `${i * 150}ms` }}>
                  <span className={i === 2 ? "text-volt-grad" : "text-chrome"}>{w}</span>
                </span>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-pay">
              <Check width={14} height={14} /> Nice! Your tyres ship FREE, nationwide.
            </p>
          </div>
        ) : (
          <div key="nudge" className="pulse-attn mt-3 flex items-center gap-2.5 rounded-xl border-2 border-volt/40 bg-surface px-4 py-3 text-base font-bold text-fg">
            <Truck width={20} height={20} className="text-volt" /> Add <span className="text-volt">{need} more tyre{need > 1 ? "s" : ""}</span> for FREE delivery!
          </div>
        ))}
      </div>

      {isTyre && (
        <>
          {/* 2 — delivery */}
          <div>
            <StepLabel n={2}>Choose your delivery</StepLabel>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("delivery")} className={`tappable relative flex flex-col items-start rounded-xl border p-3 text-left ${method === "delivery" ? "is-selected bg-volt/15" : "border-line bg-surface"}`}>
                {method === "delivery" && <SelBadge />}
                <Truck width={20} height={20} className={method === "delivery" ? "text-volt" : "text-muted"} />
                <span className="mt-1.5 text-sm font-bold">Deliver to me</span>
                <span className="text-xs text-muted">{t.freeDelivery ? "FREE on 2+ tyres" : `${formatPrice(STANDARD_DELIVERY_FEE)} · 1 tyre`}</span>
              </button>
              <button onClick={() => setMethod("fitment")} className={`tappable relative flex flex-col items-start rounded-xl border p-3 text-left ${method === "fitment" ? "is-selected bg-volt/15" : "border-line bg-surface"}`}>
                {method === "fitment" && <SelBadge />}
                <Pin width={20} height={20} className={method === "fitment" ? "text-volt" : "text-muted"} />
                <span className="mt-1.5 text-sm font-bold">Store fitment</span>
                <span className="text-xs text-muted">FREE · fit in Joburg</span>
              </button>
            </div>
          </div>

          {/* fitment store + date (only when fitment) */}
          {method === "fitment" && (
            <div className="grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Fitment store (JHB only)</span>
                <div className="relative">
                  <select value={store} onChange={(e) => setStore(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-line bg-ink px-3 pr-9 text-sm font-semibold text-fg outline-none focus:border-volt">
                    {FITMENT_STORES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" width={15} height={15} />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Choose a fitment date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-ink px-3 text-sm font-semibold text-fg outline-none focus:border-volt" />
              </label>
            </div>
          )}

          {/* 3 — alignment */}
          <div>
            <StepLabel n={3}>Add wheel alignment?</StepLabel>
            <button onClick={() => setAlignment((a) => !a)} className={`tappable flex w-full items-center gap-3 rounded-xl border p-3 text-left ${alignment ? "is-selected bg-volt/15" : "border-line bg-surface"}`}>
              <span className={`grid size-5 shrink-0 place-items-center rounded border ${alignment ? "border-volt bg-volt" : "border-line-2"}`}>{alignment && <Check width={13} height={13} className="text-volt-ink" />}</span>
              <Shield width={20} height={20} className={alignment ? "text-volt" : "text-muted"} />
              <span className="flex-1">
                <span className="block text-sm font-bold">Wheel alignment</span>
                <span className="text-xs text-muted">Recommended with new tyres</span>
              </span>
              <span className="text-sm font-bold text-fg">+{formatPrice(ALIGNMENT_FEE)}</span>
            </button>
          </div>

          {/* 4 — balancing */}
          <div>
            <StepLabel n={4}>Tyres to balance &amp; valve</StepLabel>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => setBalanceQty(n)} className={`tappable rounded-lg border px-4 py-2 text-sm font-bold ${balanceQty === n ? "is-selected bg-volt/15 text-volt" : "border-line text-muted hover:text-fg"}`}>
                  {n === 0 ? "None" : `${n}×`}
                </button>
              ))}
            </div>
            {balanceQty > 0 && <p className="mt-1.5 text-xs text-muted">{balanceQty} × balance &amp; valve = <b className="text-fg">{formatPrice(balanceQty * BALANCE_PER_TYRE)}</b> ({formatPrice(BALANCE_PER_TYRE)} each)</p>}
          </div>
        </>
      )}

      {/* total */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between text-sm text-muted"><span>{qty} × {formatPrice(item.price)}</span><span className="text-fg">{formatPrice(t.base)}</span></div>
        {t.setDiscount > 0 && <div className="mt-1 flex items-center justify-between text-sm font-semibold text-volt"><span>Set of 4 saving</span><span>−{formatPrice(t.setDiscount)}</span></div>}
        {t.options > 0 && <div className="mt-1 flex items-center justify-between text-sm text-muted"><span>Options (alignment / balancing)</span><span className="text-fg">{formatPrice(t.options)}</span></div>}
        <div className="mt-1 flex items-center justify-between text-sm text-muted"><span>Delivery</span><span className={t.delivery === 0 ? "text-pay" : "text-fg"}>{t.delivery === 0 ? "FREE" : formatPrice(t.delivery)}</span></div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3"><span className="font-bold">Total <span className="text-xs font-normal text-muted">(VAT incl.)</span></span><span className="font-display text-2xl text-volt">{formatPrice(t.total)}</span></div>
      </div>

      {/* actions */}
      <div className="grid gap-2 sm:grid-cols-2">
        <button disabled={!inStock} onClick={commit} className="btn btn-dark py-3.5 text-base disabled:opacity-50"><Cart width={18} height={18} /> Add to cart</button>
        <button disabled={!inStock} onClick={() => { commit(); router.push("/checkout"); }} className="btn btn-volt py-3.5 text-base disabled:opacity-50"><Bolt width={18} height={18} /> Buy now</button>
      </div>
      <WhatsAppButton
        className="w-full py-3.5 text-base"
        slug={item.slug}
        name={item.name}
        sku={sku}
        size={size}
        price={item.price}
        setPrice={hasSetPricing(item.type) ? setPriceOf4(item.price) : undefined}
      />
      {!inStock && <p className="text-center text-sm text-sale">Currently out of stock</p>}
    </div>
  );
}
