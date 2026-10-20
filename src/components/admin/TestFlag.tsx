"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Small "TEST" pill: shown on test entries only — no pill means a real customer. */
export function TestBadge({ test, className = "" }: { test?: boolean | number | null; className?: string }) {
  if (!test || test === 0) return null;
  return <span className={`ml-1.5 inline-block rounded bg-amber-400 px-1.5 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide text-black ${className}`} title="Test entry — not a real customer">Test</span>;
}

/** Button to mark an entry as a test, or back to real. */
export function TestToggle({ kind, id, test }: { kind: "lead" | "enquiry" | "cart" | "order" | "support" | "client"; id: string | number; test: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy}
        onClick={async () => {
          if (!confirm(test ? "Mark this as REAL (a real customer)?" : "Mark this as a TEST (not a real customer)?")) return;
          setBusy(true); setErr(null);
          const r = await fetch("/api/admin/test-flag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id, test: !test }) });
          setBusy(false);
          if (!r.ok) setErr("Couldn't change it.");
          router.refresh();
        }}
        className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:border-amber-400 hover:text-amber-400 disabled:opacity-50">
        {test ? "Mark as real" : "Mark as test"}
      </button>
      {err && <span className="text-xs text-sale">{err}</span>}
    </span>
  );
}
