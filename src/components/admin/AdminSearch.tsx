"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";

type Props = { placeholder?: string; param?: string; className?: string };

/** Search box for any admin list. Writes `?q=` to the URL (keeping the other
 *  params, e.g. the current tab) so the server page filters the results. */
export function AdminSearch(props: Props) {
  return (
    <Suspense fallback={<div className={`h-10 ${props.className ?? ""}`} />}>
      <SearchBox {...props} />
    </Suspense>
  );
}

function SearchBox({ placeholder = "Search…", param = "q", className = "" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? "";
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);

  function go(next: string) {
    const params = new URLSearchParams(sp.toString());
    if (next.trim()) params.set(param, next.trim()); else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    go(value);
  }

  return (
    <form onSubmit={submit} role="search" className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" aria-hidden>⌕</span>
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-10 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-volt"
        />
      </div>
      <button type="submit" className="btn btn-volt h-10 px-4 text-sm">Search</button>
      {current && (
        <button type="button" onClick={() => { setValue(""); go(""); }} className="btn btn-dark h-10 px-3 text-sm">Clear</button>
      )}
    </form>
  );
}
