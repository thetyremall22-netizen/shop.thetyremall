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

/** "Where did this sale come from" box on the admin order page (like WooCommerce). */
export function OrderAttribution({ a, placedAt }: { a: Attribution | null; placedAt: string }) {
  const origin = classifyOrigin(a);
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">Order attribution</h2>
      <div className="mt-2"><OriginBadge origin={origin} /></div>
      {!a ? (
        <p className="mt-2 text-sm text-muted">Not recorded. This order was placed before the website started tracking where sales come from.</p>
      ) : (
        <>
          <Rows rows={[
            ["Origin", origin.label],
            ["Source type", origin.type],
            ["Campaign tags", utmText(a.touch) || null],
            ["Ad click", adClick(a.touch) ? `Yes (${adClick(a.touch)})` : null],
            ["Came from", a.touch.referrer ? <a href={a.touch.referrer} target="_blank" rel="noreferrer noopener" className="text-volt hover:underline">{hostOf(a.touch.referrer)}</a> : null],
            ["Landing page", a.touch.landing || null],
            ["Tyrone chat", a.tyrone ? <a href={`/admin/leads/tyrone/${a.tyrone}`} className="font-semibold text-volt hover:underline">Chatted to Tyrone first — see the conversation →</a> : null],
            ["Device", a.device ?? null],
            ["Placed by staff", a.staff ? "Yes (logged in to the admin, so it's marked TEST)" : null],
            ["Pages viewed", a.sessionPages ? `${a.sessionPages} in this visit` : null],
            ["Visits", a.visits ? String(a.visits) : null],
            ["Visit started", a.touch.at ? `${when(a.touch.at)} (${ago(a.touch.at, placedAt)} before ordering)` : null],
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
