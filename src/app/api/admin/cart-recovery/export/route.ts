import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/admin-auth";
import { listCarts, STATUS_LABEL, SOURCE_LABEL } from "@/lib/cart-recovery";

const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "");

/** CSV of the carts (current filter/search). */
export async function GET(req: NextRequest) {
  if (!(await authorize("leads.view"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rows = await listCarts({ status: req.nextUrl.searchParams.get("status") || undefined, q: req.nextUrl.searchParams.get("q") || undefined, limit: 10000 });
  const head = ["Cart #", "Email", "First name", "Last name", "Phone", "Source", "Status", "Items", "Cart value (R)", "Emails sent", "Last email", "Order no.", "Recovered (sale)", "Recovered order", "Recovered value (R)", "Created", "Updated"];
  const lines = rows.map((c) => [
    c.id, c.email, c.firstName, c.lastName, c.phone, SOURCE_LABEL[c.source] ?? c.source, STATUS_LABEL[c.status] ?? c.status,
    c.items.map((i) => `${i.qty}x ${i.name}`).join("; "), (c.total / 100).toFixed(2), c.emailsSent, when(c.lastEmailAt), c.orderRef ?? "",
    c.status === "recovered" ? "Yes" : "No", c.recoveredOrderRef ?? "", c.status === "recovered" ? (c.recoveredValue / 100).toFixed(2) : "", when(c.createdAt), when(c.updatedAt),
  ].map(cell).join(","));
  return new NextResponse([head.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="abandoned-carts-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
