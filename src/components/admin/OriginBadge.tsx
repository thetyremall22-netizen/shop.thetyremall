import type { Origin } from "@/lib/attribution";

const COLOR: Record<Origin["type"], string> = {
  "Paid ads": "bg-amber-400/15 text-amber-300 ring-amber-400/40",
  "Organic search": "bg-sky-400/15 text-sky-300 ring-sky-400/40",
  "AI assistant": "bg-fuchsia-400/15 text-fuchsia-300 ring-fuchsia-400/40",
  Social: "bg-pink-400/15 text-pink-300 ring-pink-400/40",
  Email: "bg-teal-400/15 text-teal-300 ring-teal-400/40",
  Referral: "bg-violet-400/15 text-violet-300 ring-violet-400/40",
  Campaign: "bg-orange-400/15 text-orange-300 ring-orange-400/40",
  Direct: "bg-surface-2 text-muted ring-line",
};

/** Small coloured "where the sale came from" label. */
export function OriginBadge({ origin }: { origin: Origin }) {
  const text = origin.type === "Paid ads" || origin.type === "Direct" ? origin.source : `${origin.type === "Organic search" ? "Search" : origin.type === "AI assistant" ? "AI" : origin.type}: ${origin.source}`;
  return <span title={origin.label} className={`inline-block max-w-[180px] truncate rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${COLOR[origin.type]}`}>{text}</span>;
}
