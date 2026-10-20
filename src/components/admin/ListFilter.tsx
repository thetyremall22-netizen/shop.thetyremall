"use client";

/** Quick search box for an admin list (filters what's already loaded). */
export function ListFilter({ value, onChange, placeholder = "Search this list…", count }: { value: string; onChange: (v: string) => void; placeholder?: string; count?: number }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-10 w-full max-w-md rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none placeholder:text-faint focus:border-volt" />
      {value && count !== undefined && <span className="text-xs text-muted">{count} match{count === 1 ? "" : "es"}</span>}
    </div>
  );
}

/** Does any field of the item contain the search text? */
export function matchesFilter(item: unknown, q: string): boolean {
  if (!q.trim()) return true;
  return JSON.stringify(item).toLowerCase().includes(q.trim().toLowerCase());
}
