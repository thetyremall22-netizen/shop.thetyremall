"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { setDiscountFor } from "@/lib/pricing";
import { Close, Trash, Plus, Minus, Cart as CartIcon, Check } from "./icons";
import { NotAvailableNotice, useCanBuy } from "./GeoNotice";

export function CartDrawer() {
  const { items, totals, drawerOpen, setDrawerOpen, setQty, remove } = useCart();
  const canBuy = useCanBuy();

  return (
    <div className={`fixed inset-0 z-50 ${drawerOpen ? "" : "pointer-events-none"}`} aria-hidden={!drawerOpen}>
      <div
        className={`absolute inset-0 bg-black/70 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-ink-2 shadow-2xl transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="font-display text-lg">Your Cart{totals.itemCount > 0 ? ` (${totals.itemCount})` : ""}</h2>
          <button onClick={() => setDrawerOpen(false)} aria-label="Close cart" className="text-muted hover:text-fg">
            <Close />
          </button>
        </div>

        {/* free delivery progress */}
        {totals.itemCount > 0 && (
          <div className="border-b border-line bg-gradient-to-br from-surface to-ink-2 px-4 py-4">
            {totals.freeDelivery ? (
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pay/20 text-pay">
                  <Check width={22} height={22} />
                </span>
                <p className="text-lg font-black leading-tight text-pay">
                  FREE delivery to your front door — unlocked! 🎉
                </p>
              </div>
            ) : (
              <p className="text-lg font-extrabold leading-snug text-fg">
                Add{" "}
                <span className="text-volt">
                  {totals.tyresToFreeDelivery} more tyre{totals.tyresToFreeDelivery > 1 ? "s" : ""}
                </span>{" "}
                for <span className="text-volt">FREE delivery</span> to your front door!
              </p>
            )}
            {/* progress bar */}
            <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt-2 to-volt transition-all duration-700"
                style={{ width: `${Math.min(100, (totals.tyreQty / 2) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid size-16 place-items-center rounded-full bg-surface-2 text-faint">
                  <CartIcon width={28} height={28} />
                </div>
                <p className="mt-4 font-semibold text-fg">Your cart is empty</p>
                <p className="mt-1 text-sm text-muted">Find your perfect tyre and add it here.</p>
                <Link href="/shop" onClick={() => setDrawerOpen(false)} className="btn btn-volt mt-5">
                  Shop tyres
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3 p-4">
                  <Link
                    href={`/product/${i.slug}`}
                    onClick={() => setDrawerOpen(false)}
                    className="plate grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg"
                  >
                    {i.image && <Image src={i.image} alt="" width={64} height={64} className="size-16 object-contain p-1" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/product/${i.slug}`}
                        onClick={() => setDrawerOpen(false)}
                        className="line-clamp-2 text-sm font-medium text-fg hover:text-volt"
                      >
                        {i.name}
                      </Link>
                      <button onClick={() => remove(i.id)} aria-label="Remove" className="shrink-0 text-faint hover:text-sale">
                        <Trash width={16} height={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-line">
                        <button onClick={() => setQty(i.id, i.qty - 1)} className="grid size-8 place-items-center text-muted hover:text-fg" aria-label="Decrease">
                          <Minus width={14} height={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{i.qty}</span>
                        <button onClick={() => setQty(i.id, i.qty + 1)} className="grid size-8 place-items-center text-muted hover:text-fg" aria-label="Increase">
                          <Plus width={14} height={14} />
                        </button>
                      </div>
                      <span className="font-display text-base text-fg">{formatPrice(i.price * i.qty)}</span>
                    </div>
                    {setDiscountFor(i.price, i.qty, i.type) > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-volt/15 px-2 py-0.5 text-[11px] font-bold text-volt">
                        <Check width={12} height={12} /> Set of 4 — save {formatPrice(setDiscountFor(i.price, i.qty, i.type))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line p-4">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span className="text-fg">{formatPrice(totals.subtotal)}</span>
            </div>
            {totals.setDiscount > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm font-semibold text-volt">
                <span>Set of 4 saving</span>
                <span>−{formatPrice(totals.setDiscount)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-sm text-muted">
              <span>Delivery</span>
              <span className={totals.delivery === 0 ? "text-pay" : "text-fg"}>
                {totals.delivery === 0 ? "FREE" : formatPrice(totals.delivery)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold">Total</span>
              <span className="font-display text-xl text-volt">{formatPrice(totals.total)}</span>
            </div>
            {canBuy ? (
            <Link href="/checkout" onClick={() => setDrawerOpen(false)} className="btn btn-volt mt-4 w-full py-3.5 text-base">
              Checkout
            </Link>
            ) : <NotAvailableNotice className="mt-4" />}
            <Link href="/cart" onClick={() => setDrawerOpen(false)} className="btn btn-ghost mt-2 w-full">
              View cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
