import "server-only";
import { libsql } from "./db";

// Why a cancelled order was cancelled — worked out from the order history
// (audit log), so nothing on the order itself changes.
//
//  • "System (unpaid order timer)"          → not paid in time (PayFast 1 hour / HappyPay 24 hours)
//  • "System (payfast)" / "System (happypay)" → the customer came back from the payment page
//                                              without paying (pressed cancel / not approved)
//  • anyone else                             → cancelled by staff (their name)

export type CancelReasonKind = "payfast_timeout" | "payfast_customer" | "happypay_timeout" | "happypay_returned" | "timeout" | "returned" | "staff" | "unknown";

export interface CancelReason { kind: CancelReasonKind; label: string; detail: string }

export function describeCancel(actor: string, paymentMethod: string): CancelReason {
  const pm = paymentMethod.toLowerCase();
  if (/unpaid order timer/i.test(actor)) {
    if (pm === "payfast") return { kind: "payfast_timeout", label: "Unpaid — PayFast hold expired", detail: "Not paid within the 1-hour PayFast hold, so it was cancelled automatically." };
    if (pm === "happypay") return { kind: "happypay_timeout", label: "HappyPay not approved / not completed", detail: "HappyPay didn't confirm an approval within 24 hours (the application was declined, not finished or never started), so it was cancelled automatically. HappyPay's merchant portal shows which." };
    return { kind: "timeout", label: "Unpaid — timed out", detail: "Not paid in time, so it was cancelled automatically." };
  }
  if (/^System \(payfast\)/i.test(actor)) return { kind: "payfast_customer", label: "Cancelled by customer at PayFast", detail: "The customer pressed cancel on the PayFast payment page and came back without paying." };
  if (/^System \(happypay\)/i.test(actor)) return { kind: "happypay_returned", label: "Came back from HappyPay without approval", detail: "The customer came back from HappyPay without an approval (declined, or they cancelled the application)." };
  if (/^System/i.test(actor) || !actor) return { kind: "returned", label: "Cancelled — not paid", detail: "The customer came back from the payment page without paying." };
  return { kind: "staff", label: `Cancelled by ${actor}`, detail: `Cancelled in the admin by ${actor}.` };
}

/** Cancel reason for each cancelled order, keyed by order id. */
export async function cancelReasonsById(orderIds: string[]): Promise<Record<string, CancelReason>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length) return {};
  return cancelReasonsWhere(`o.order_id IN (${ids.map(() => "?").join(",")})`, ids, "id");
}

/** Cancel reason for each cancelled order, keyed by order reference (TTM-…). */
export async function cancelReasonsByRef(refs: string[]): Promise<Record<string, CancelReason>> {
  const list = [...new Set(refs.filter(Boolean))];
  if (!list.length) return {};
  return cancelReasonsWhere(`o.reference IN (${list.map(() => "?").join(",")})`, list, "ref");
}

async function cancelReasonsWhere(where: string, args: string[], key: "id" | "ref"): Promise<Record<string, CancelReason>> {
  const out: Record<string, CancelReason> = {};
  try {
    const r = await libsql.execute({
      sql: `SELECT o.order_id id, o.reference ref, o.payment_method pm,
              (SELECT a.actor FROM audit_log a WHERE a.entity = 'order' AND a.entity_id = o.order_id AND a.action = 'status'
                 AND a.after LIKE '%cancelled%' ORDER BY a.id DESC LIMIT 1) actor
            FROM orders o WHERE o.status = 'cancelled' AND ${where}`,
      args,
    });
    for (const row of r.rows) {
      if (!row.actor) continue; // no record of the cancellation (e.g. orders from the old website)
      const k = String(key === "id" ? row.id : row.ref);
      out[k] = describeCancel(String(row.actor ?? ""), String(row.pm ?? ""));
    }
  } catch (e) {
    console.error("[cancel-reasons]", (e as Error).message);
  }
  return out;
}
