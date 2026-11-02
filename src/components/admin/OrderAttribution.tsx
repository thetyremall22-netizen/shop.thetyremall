import { classifyOrigin, hostOf, type Attribution, type Touch } from "@/lib/attribution";
import { OriginBadge } from "./OriginBadge";

const when = (ms: number) => (ms ? new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "—");
function ago(fromMs: number, toIso: string): string {
  const mins = Math.max(0, Math.round((Date.parse(toIso) - fromMs) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="mt-3 space-y-1.5 text-sm">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><dt className="text-muted">{k}</dt><dd className="break-words text-fg">{v}</dd></div>
      ))}
    </dl>
  );
}

const utmText = (t: Touch) => Object.entries(t.utm).map(([k, v]) => `${k}: ${v}`).join(" · ");
const adClick = (t: Touch) => Object.keys(t.clickIds).filter((k) => k !== "srsltid").join(", ");

/** "Where did this sale come from" box on the admin order page (like WooCommerce).
 *  Also used on leads and enquiries (`kind`). */
export function OrderAttribution({ a, placedAt, kind = "order" }: { a: Attribution | null; placedAt: string; kind?: "order" | "lead" }) {
  const origin = classifyOrigin(a);
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">{kind === "order" ? "Order attribution" : "Where this came from"}</h2>
      <div className="mt-2"><OriginBadge origin={origin} /></div>
      {!a ? (
        <p className="mt-2 text-sm text-muted">Not recorded. {kind === "order" ? "This order was placed before the website started tracking where sales come from." : "This came in before the website started recording where enquiries come from (2 Nov 2026)."}</p>
      ) : (
        <>
          <Rows rows={[
            ["Origin", origin.label],
            ["Source type", origin.type],
            ["Campaign tags", utmText(a.touch) || null],
            ["Ad click", adClick(a.touch) ? `Yes (${adClick(a.touch)})` : null],
            ["Earlier ad click", origin.assist ? `${origin.assist}${a.ad?.at ? ` on ${when(a.ad.at)}` : a.first?.at ? ` on ${when(a.first.at)}` : ""}${a.ad?.utm.term ? ` — searched “${a.ad.utm.term}”` : ""}` : null],
            ["Came from", a.touch.referrer ? <a href={a.touch.referrer} target="_blank" rel="noreferrer noopener" className="text-volt hover:underline">{hostOf(a.touch.referrer)}</a> : null],
            ["Landing page", a.touch.landing || null],
            ["Tyrone chat", a.tyrone ? <a href={`/admin/leads/tyrone/${a.tyrone}`} className="font-semibold text-volt hover:underline">Chatted to Tyrone first — see the conversation →</a> : null],
            ["Device", a.device ?? null],
            ["Placed by staff", a.staff ? "Yes (logged in to the admin, so it's marked TEST)" : null],
            ["Pages viewed", a.sessionPages ? `${a.sessionPages} in this visit` : null],
            ["Visits", a.visits ? String(a.visits) : null],
            ["Visit started", a.touch.at ? `${when(a.touch.at)} (${ago(a.touch.at, placedAt)} before ${kind === "order" ? "ordering" : "getting in touch"})` : null],
          ]} />
          {a.first && a.first.at && a.first.at !== a.touch.at && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">First ever visit</div>
              <Rows rows={[
                ["Origin", classifyOrigin({ ...a, touch: a.first, staff: false }).label],
                ["When", when(a.first.at)],
                ["Landing page", a.first.landing || null],
              ]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
