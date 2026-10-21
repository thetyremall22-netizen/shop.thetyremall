import type { JourneyOutcome } from "@/lib/tyrone-journey";

const STYLE: Record<JourneyOutcome["kind"], string> = {
  bought: "bg-pay/15 text-pay ring-pay/40",
  unpaid_order: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  added_to_cart: "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  whatsapp: "bg-[#25D366]/15 text-[#25D366] ring-[#25D366]/40",
  viewed_products: "bg-sky-400/15 text-sky-300 ring-sky-400/40",
  questions: "bg-surface-2 text-muted ring-line",
};
const ICON: Record<JourneyOutcome["kind"], string> = { bought: "✅", unpaid_order: "🛒", added_to_cart: "🛒", whatsapp: "💬", viewed_products: "👀", questions: "❔" };

export function JourneyOutcomeBadge({ outcome }: { outcome: JourneyOutcome }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${STYLE[outcome.kind]}`}>{ICON[outcome.kind]} {outcome.label}</span>;
}
