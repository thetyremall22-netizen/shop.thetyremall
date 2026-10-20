import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { getOrder, updateOrder, type Order, type OrderStatus } from "@/lib/orders";
import { incrementStock, decrementStock } from "@/lib/db/queries";
import { sendOrderCompleted, sendOrderRefunded, sendOrderCancelled, sendOrderOnHold, sendOrderFailed, resendStatusEmail } from "@/lib/email";
import { validateContact } from "@/lib/validate";
import { addAudit, diffFields, describeChanges, actorName } from "@/lib/audit";
import type { LineItem, OrderTotals } from "@/lib/totals";
import { getProduct } from "@/lib/catalogue";

const ALLOWED: OrderStatus[] = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"];
const STOCK_HELD: OrderStatus[] = ["processing", "completed"]; // stock is taken in these states (matches checkout/payment)

const s = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const cents = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Edit an order from the admin. Body may contain any of:
 *  - status (+ notify: email the customer, note: reason for the history)
 *  - customer { firstName, lastName, email, phone }
 *  - delivery { method, address{…}, fitmentStore, fitmentDate }
 *  - items [{ slug, name, sku, qty, price }] and totals { delivery, setDiscount, … }
 *  - undo: true (marks a revert in the history)
 * Every change is recorded in the order's history.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("orders.edit");
  if (!actor) return NextResponse.json({ error: "You don't have permission to edit orders." }, { status: 403 });
  const who = actorName(actor);
  const { id } = await params;
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }

  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const undo = b.undo === true;
  let current: Order = order;

  // ---- customer --------------------------------------------------------------
  if (b.customer && typeof b.customer === "object") {
    const c = b.customer as Record<string, unknown>;
    const next = {
      firstName: s(c.firstName, 80) || current.customer.firstName,
      lastName: s(c.lastName, 80),
      email: s(c.email, 160),
      phone: s(c.phone, 40),
    };
    // Validate (and tidy) only the fields that were actually changed, so an
    // old order's formatting isn't rewritten as a "change".
    const emailChanged = next.email !== current.customer.email;
    const phoneChanged = next.phone !== current.customer.phone;
    const { errors, clean } = validateContact(
      { email: emailChanged ? next.email : undefined, phone: phoneChanged ? next.phone : undefined },
      { email: emailChanged },
    );
    if (Object.keys(errors).length) return NextResponse.json({ error: Object.values(errors)[0], errors }, { status: 400 });
    if (emailChanged) next.email = clean.email ?? next.email;
    if (phoneChanged && next.phone) next.phone = clean.phone ?? next.phone;
    const changes = diffFields(current.customer, next);
    if (Object.keys(changes).length) {
      current = (await updateOrder(id, { customer: next })) ?? current;
      await addAudit({
        entity: "order", entityId: id, action: undo ? "undo" : "edit", actor: who,
        summary: (undo ? "Undid: " : "Customer — ") + describeChanges(changes, { firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone" }),
        before: { customer: order.customer }, after: { customer: next },
      });
    }
  }

  // ---- delivery --------------------------------------------------------------
  if (b.delivery && typeof b.delivery === "object") {
    const d = b.delivery as Record<string, unknown>;
    const ad = (d.address ?? {}) as Record<string, unknown>;
    const method = d.method === "fitment" ? "fitment" : "delivery";
    const next: Order["delivery"] = method === "fitment"
      ? { method, fitmentStore: s(d.fitmentStore, 160) || undefined, fitmentDate: s(d.fitmentDate, 60) || undefined }
      : { method, address: { street: s(ad.street), suburb: s(ad.suburb, 120), city: s(ad.city, 120), province: s(ad.province, 80), postalCode: s(ad.postalCode, 12) } };
    const flat = (x: Order["delivery"]) => ({
      method: x.method, street: x.address?.street ?? "", suburb: x.address?.suburb ?? "", city: x.address?.city ?? "",
      province: x.address?.province ?? "", postalCode: x.address?.postalCode ?? "", fitmentStore: x.fitmentStore ?? "", fitmentDate: x.fitmentDate ?? "",
    });
    const changes = diffFields(flat(current.delivery), flat(next));
    if (Object.keys(changes).length) {
      const before = current.delivery;
      current = (await updateOrder(id, { delivery: next })) ?? current;
      await addAudit({
        entity: "order", entityId: id, action: undo ? "undo" : "edit", actor: who,
        summary: (undo ? "Undid: " : "Delivery — ") + describeChanges(changes, {
          method: "Method", street: "Street", suburb: "Suburb", city: "City", province: "Province", postalCode: "Postal code", fitmentStore: "Fitment centre", fitmentDate: "Fitment date",
        }),
        before: { delivery: before }, after: { delivery: next },
      });
    }
  }

  // ---- items + totals ----------------------------------------------------------
  if (Array.isArray(b.items)) {
    const incoming = (b.items as Record<string, unknown>[]).slice(0, 50);
    const prevBySlug = new Map(current.items.map((i) => [i.slug, i]));
    const items: LineItem[] = [];
    for (const raw of incoming) {
      const qty = Math.max(0, Math.min(99, Math.floor(Number(raw.qty) || 0)));
      if (!qty) continue; // qty 0 = removed
      const slug = s(raw.slug, 200);
      const prev = prevBySlug.get(slug);
      // A newly added catalogue product: take its id/type/brand/SKU from the catalogue.
      const p = !prev && slug ? await getProduct(slug).catch(() => undefined) : undefined;
      items.push({
        ...(prev ?? (p
          ? { id: p.id, slug: p.slug, brand: p.brand, type: p.type }
          : { id: 0, slug, type: (raw.type === "wheel" || raw.type === "other" ? raw.type : "tyre") as LineItem["type"] })),
        slug: slug || prev?.slug || `custom-${Date.now()}`,
        name: s(raw.name, 200) || prev?.name || p?.name || "Item",
        sku: s(raw.sku, 80) || prev?.sku || p?.sku || undefined,
        qty,
        price: cents(raw.price),
      });
    }
    if (!items.length) return NextResponse.json({ error: "An order needs at least one item. To cancel it, change the status instead." }, { status: 400 });
    const tIn = (b.totals ?? {}) as Record<string, unknown>;
    const t0 = current.totals;
    const pick = (k: keyof OrderTotals) => (tIn[k] !== undefined ? cents(tIn[k]) : (t0[k] as number) || 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.qty, 0);
    const totals: OrderTotals = {
      ...t0,
      tyreQty: items.filter((i) => i.type === "tyre").reduce((n, i) => n + i.qty, 0),
      itemCount: items.reduce((n, i) => n + i.qty, 0),
      subtotal,
      setDiscount: pick("setDiscount"),
      alignmentTotal: pick("alignmentTotal"),
      balanceTotal: pick("balanceTotal"),
      hazardTotal: pick("hazardTotal"),
      couponDiscount: pick("couponDiscount"),
      delivery: pick("delivery"),
      total: 0,
    };
    totals.freeDelivery = totals.delivery === 0;
    totals.total = Math.max(0, subtotal - totals.setDiscount + totals.alignmentTotal + totals.balanceTotal + totals.hazardTotal - totals.couponDiscount + totals.delivery);

    const describe = (list: LineItem[]) => list.map((i) => `${i.qty}× ${i.name}${i.sku ? ` [${i.sku}]` : ""} @ R${(i.price / 100).toFixed(2)}`).join("; ");
    const beforeTxt = describe(current.items) + ` | total R${(current.totals.total / 100).toFixed(2)}`;
    const afterTxt = describe(items) + ` | total R${(totals.total / 100).toFixed(2)}`;
    if (beforeTxt !== afterTxt) {
      // Keep stock right while the order holds stock.
      if (STOCK_HELD.includes(current.status)) {
        const qtyOf = (list: LineItem[]) => list.reduce((m, i) => m.set(i.slug, (m.get(i.slug) ?? 0) + i.qty), new Map<string, number>());
        const before = qtyOf(current.items), after = qtyOf(items);
        for (const slug of new Set([...before.keys(), ...after.keys()])) {
          const delta = (after.get(slug) ?? 0) - (before.get(slug) ?? 0);
          if (delta > 0) await decrementStock(slug, delta);
          if (delta < 0) await incrementStock(slug, -delta);
        }
      }
      const prevItems = current.items, prevTotals = current.totals;
      current = (await updateOrder(id, { items, totals })) ?? current;
      await addAudit({
        entity: "order", entityId: id, action: undo ? "undo" : "edit", actor: who,
        summary: `${undo ? "Undid item changes" : "Items/totals changed"}: ${beforeTxt} → ${afterTxt}`,
        before: { items: prevItems, totals: prevTotals }, after: { items, totals },
      });
    }
  }

  // ---- status ----------------------------------------------------------------
  let emailed = false;
  if (typeof b.status === "string" && b.status !== current.status) {
    const status = b.status as OrderStatus;
    if (!ALLOWED.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    const prev = current.status;
    const note = s(b.note, 500);
    const updated = await updateOrder(id, { status }, { actor: who, note: (undo ? "undo" : "") + (note ? (undo ? " — " : "") + note : "") || undefined });
    if (!updated) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    current = updated;

    // Stock follows the status: released when an order stops holding stock,
    // taken again if it's reinstated.
    if (STOCK_HELD.includes(prev) && !STOCK_HELD.includes(status)) {
      for (const it of updated.items) await incrementStock(it.slug, it.qty);
    } else if (!STOCK_HELD.includes(prev) && STOCK_HELD.includes(status)) {
      for (const it of updated.items) await decrementStock(it.slug, it.qty);
    }

    if (b.notify !== false) {
      try {
        if (status === "completed") await sendOrderCompleted(updated);
        else if (status === "refunded") await sendOrderRefunded(updated);
        else if (status === "cancelled") await sendOrderCancelled(updated);
        else if (status === "on-hold") await sendOrderOnHold(updated);
        else if (status === "failed") await sendOrderFailed(updated);
        else if (status === "processing") await resendStatusEmail(updated);
        emailed = status !== "pending";
      } catch (e) {
        console.error("[admin/orders] status email failed", e);
      }
    }
  }

  return NextResponse.json({ ok: true, order: current, emailed });
}
