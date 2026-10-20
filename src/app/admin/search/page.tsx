import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { can, listUsers } from "@/lib/admin-users";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { listOrders, STATUS_LABEL } from "@/lib/orders";
import { listLeads } from "@/lib/contacts";
import { listEnquiries } from "@/lib/enquiries";
import { listCarts, STATUS_LABEL as CART_STATUS } from "@/lib/cart-recovery";
import { listProducts } from "@/lib/db/queries";
import { listEmails, EMAIL_TYPE_LABELS } from "@/lib/email-log";

export const instant = false;

const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const when = (ms: unknown) => { const n = typeof ms === "string" ? Date.parse(ms) : Number(ms); return n ? new Date(n).toLocaleDateString("en-ZA", { dateStyle: "medium" }) : ""; };
const str = (v: unknown) => (v == null ? "" : String(v));
const SOURCE: Record<string, string> = { contact: "Contact form", "whatsapp-quote": "WhatsApp quote", "whatsapp-enquiry": "Product enquiry", "whatsapp-chat": "WhatsApp chat", tyrone: "Tyrone chat" };

function matches(row: Record<string, unknown>, q: string): boolean {
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return Object.values(row).some((v) => {
    const s = v == null ? "" : String(v).toLowerCase();
    return s.includes(needle) || (digits.length >= 6 && s.replace(/\D/g, "").includes(digits.slice(-9)));
  });
}

/** One search across the whole admin. */
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim();

  const results = q.length >= 2 ? await Promise.all([
    can(me.role, "orders.view") ? listOrders({ q, perPage: 20 }) : null,
    can(me.role, "leads.view") ? listLeads({ q, limit: 20 }) : null,
    can(me.role, "leads.view") ? listEnquiries(1000).then((r) => r.filter((x) => matches(x, q)).slice(0, 20)) : null,
    can(me.role, "leads.view") ? listCarts({ q, limit: 20 }) : null,
    can(me.role, "products.view") ? listProducts({ q, perPage: 20 }) : null,
    can(me.role, "emails.view") ? listEmails({ q, perPage: 20 }) : null,
    can(me.role, "users.manage") ? listUsers().then((u) => u.filter((x) => matches(x as unknown as Record<string, unknown>, q))) : null,
  ]) : null;
  const [orders, leads, enquiries, carts, products, emails, staff] = results ?? [];
  const total = results ? [orders?.total ?? 0, leads?.length ?? 0, enquiries?.length ?? 0, carts?.length ?? 0, products?.total ?? 0, emails?.total ?? 0, staff?.length ?? 0].reduce((a, b) => a + b, 0) : 0;

  return (
    <AdminShell>
      <h1 className="font-display text-3xl">Search</h1>
      <AdminSearch className="mt-4 max-w-2xl" placeholder="Order no., customer name, email, phone, product, SKU, size, lead…" />
      {!q && <p className="mt-4 text-sm text-muted">Searches orders, leads, enquiries, abandoned carts, products, emails and staff in one go.</p>}
      {q && q.length < 2 && <p className="mt-4 text-sm text-muted">Type at least 2 characters.</p>}
      {results && (
        <p className="mt-3 text-sm text-muted">{total ? `${total.toLocaleString()} result${total === 1 ? "" : "s"} for “${q}”` : `Nothing found for “${q}”.`}</p>
      )}

      {orders && orders.total > 0 && (
        <Group title="Orders" count={orders.total} more={`/admin/orders?q=${encodeURIComponent(q)}`}>
          {orders.orders.map((o) => (
            <Row key={o.id} href={`/admin/orders/${o.id}`} title={`${o.reference} — ${o.customer.firstName} ${o.customer.lastName}`}
              sub={`${o.customer.email} · ${o.customer.phone} · ${STATUS_LABEL[o.status] ?? o.status} · ${when(o.createdAt)}`} right={zar(o.totals.total)} />
          ))}
        </Group>
      )}
      {leads && leads.length > 0 && (
        <Group title="Leads" count={leads.length} more={`/admin/leads?q=${encodeURIComponent(q)}`}>
          {leads.map((l) => (
            <Row key={str(l.id)} href={`/admin/leads/contact/${str(l.id)}`} title={`${str(l.name) || str(l.email) || str(l.phone)} — ${SOURCE[str(l.source)] ?? str(l.source)}`}
              sub={[str(l.email), str(l.phone), str(l.product_name), when(l.created_at)].filter(Boolean).join(" · ")} />
          ))}
        </Group>
      )}
      {enquiries && enquiries.length > 0 && (
        <Group title="Tyrone questions, WhatsApp & call taps" count={enquiries.length}>
          {enquiries.map((e) => (
            <Row key={str(e.id)} href={`/admin/leads/enquiry/${str(e.id)}`} title={`${str(e.type)} — ${str(e.product_name) || str(e.store_name) || "enquiry"}`}
              sub={[str(e.message).slice(0, 100), when(e.created_at)].filter(Boolean).join(" · ")} />
          ))}
        </Group>
      )}
      {carts && carts.length > 0 && (
        <Group title="Abandoned carts" count={carts.length} more={`/admin/cart-recovery?q=${encodeURIComponent(q)}`}>
          {carts.map((c) => (
            <Row key={c.id} href={`/admin/cart-recovery/${c.id}`} title={`Cart #${c.id} — ${`${c.firstName} ${c.lastName}`.trim() || c.email}`}
              sub={`${c.email} · ${CART_STATUS[c.status]} · ${c.items.map((i) => i.name).join(", ").slice(0, 80)}`} right={zar(c.total)} />
          ))}
        </Group>
      )}
      {products && products.total > 0 && (
        <Group title="Products" count={products.total} more={`/admin/products?q=${encodeURIComponent(q)}`}>
          {products.rows.map((p) => (
            <Row key={p.slug} href={`/admin/products/${p.slug}`} title={p.name} sub={`${p.brand} · SKU ${p.sku || "—"} · stock ${p.stockQty}`} right={zar(p.price)} />
          ))}
        </Group>
      )}
      {emails && emails.total > 0 && (
        <Group title="Emails" count={emails.total} more={`/admin/emails?q=${encodeURIComponent(q)}`}>
          {emails.rows.map((e) => (
            <Row key={e.id} href={`/admin/emails/${e.id}`} title={e.subject} sub={`${EMAIL_TYPE_LABELS[e.type] ?? e.type} · to ${e.toAddr} · ${when(e.createdAt)}`} />
          ))}
        </Group>
      )}
      {staff && staff.length > 0 && (
        <Group title="Staff" count={staff.length} more="/admin/users">
          {staff.map((u) => <Row key={u.id} href="/admin/users" title={u.name || u.email} sub={`${u.email} · ${u.role}`} />)}
        </Group>
      )}
    </AdminShell>
  );
}

function Group({ title, count, more, children }: { title: string; count: number; more?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="font-display text-xl">{title} <span className="text-sm text-muted">({count.toLocaleString()})</span></h2>
        {more && <Link href={more} className="text-sm font-semibold text-volt hover:underline">See all →</Link>}
      </div>
      <div className="overflow-hidden rounded-xl border border-line">{children}</div>
    </section>
  );
}

function Row({ href, title, sub, right }: { href: string; title: string; sub?: string; right?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-surface">
      <span className="min-w-0">
        <span className="block truncate font-semibold text-fg">{title}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-sm font-semibold text-fg">{right}</span>}
    </Link>
  );
}
