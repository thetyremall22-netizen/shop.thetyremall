import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { TestBadge } from "@/components/admin/TestFlag";
import { JourneyOutcomeBadge } from "@/components/admin/JourneyOutcomeBadge";
import { getJourney, type JourneyEventType } from "@/lib/tyrone-journey";

export const instant = false;

const when = (ms: number) => new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
const zar = (c: number) => "R" + (c / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

const STEP: Record<JourneyEventType, { icon: string; text: string }> = {
  question: { icon: "❔", text: "Asked" },
  product_click: { icon: "👆", text: "Clicked product" },
  link_click: { icon: "🔗", text: "Clicked" },
  details: { icon: "🪪", text: "Shared contact details" },
  whatsapp: { icon: "💬", text: "Opened WhatsApp" },
  page_view: { icon: "👀", text: "Visited" },
  add_to_cart: { icon: "🛒", text: "Added to cart" },
  checkout: { icon: "💳", text: "Checkout" },
};

export default async function TyroneConversation({ params }: { params: Promise<{ sid: string }> }) {
  await requirePermission("leads.view");
  const { sid } = await params;
  const j = await getJourney(sid);
  if (!j) notFound();
  return (
    <AdminShell>
      <Link href="/admin/leads/tyrone" className="text-sm font-semibold text-muted hover:text-volt">← Tyrone conversations</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{j.name || "Tyrone conversation"}</h1>
        <JourneyOutcomeBadge outcome={j.outcome} />
        <TestBadge test={j.test} />
      </div>
      <p className="mt-1 text-sm text-muted">Started {when(j.startedAt)} · last activity {when(j.lastAt)}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="card p-5">
          <h2 className="font-display text-lg">Journey</h2>
          <ol className="mt-3 space-y-2">
            {j.events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted">{new Date(e.ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" })}<br />{new Date(e.ts).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" })}</span>
                <span aria-hidden>{STEP[e.type]?.icon ?? "•"}</span>
                <span className="min-w-0 flex-1">
                  <b className="text-fg">{STEP[e.type]?.text ?? e.type}</b>{" "}
                  {e.href && e.type !== "page_view"
                    ? <a href={e.href} target="_blank" rel="noopener" className="text-volt hover:underline">{e.label || e.href}</a>
                    : <span className="text-fg">{e.type === "question" ? `“${e.label}”` : e.label}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-6">
          <div className="card space-y-1.5 p-5 text-sm">
            <h2 className="font-display text-lg">Customer</h2>
            {j.email || j.phone ? <>
              <div className="font-semibold text-fg">{j.name}</div>
              {j.email && <a href={`mailto:${j.email}`} className="block text-volt hover:underline">{j.email}</a>}
              {j.phone && <a href={`tel:${j.phone}`} className="block text-fg">{j.phone}</a>}
              {j.phone && <a href={`https://wa.me/${j.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="block text-xs font-semibold text-[#25D366] hover:underline">WhatsApp them →</a>}
            </> : <p className="text-muted">They left before sharing their details.</p>}
          </div>
          <div className="card space-y-1.5 p-5 text-sm">
            <h2 className="font-display text-lg">Outcome</h2>
            <JourneyOutcomeBadge outcome={j.outcome} />
            {j.outcome.orderId && <Link href={`/admin/orders/${encodeURIComponent(j.outcome.orderId)}`} className="block font-semibold text-volt hover:underline">Open order {j.outcome.orderRef}{j.outcome.total ? ` (${zar(j.outcome.total)})` : ""} →</Link>}
            <p className="text-xs text-muted">{j.questions} questions · {j.productClicks} product clicks · {j.pageViews} shopping pages · {j.addToCart} added to cart · {j.whatsapp} WhatsApp</p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
