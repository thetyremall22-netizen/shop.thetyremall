import type { AuditEntry } from "@/lib/audit";

const when = (ms: number) => new Date(ms).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });

/** Running history of every change made to a record in the admin. */
export function AuditHistory({ entries, title = "History", empty = "No changes yet." }: { entries: AuditEntry[]; title?: string; empty?: string }) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-line pl-4">
          {entries.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-volt" />
              <div className="text-xs text-muted">{when(e.createdAt)} · {e.actor || "System"}{e.action === "undo" ? " · undo" : ""}</div>
              <div className="mt-0.5 break-words text-fg">{e.summary || e.action}</div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
