"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search } from "./icons";
import { formatPriceShort } from "@/lib/format";
import { cleanVoiceQuery } from "@/lib/voice-search";
import { MicButton } from "./MicButton";

interface Hit {
  name: string;
  slug: string;
  brand: string;
  price: number;
  thumb: string | null;
  size: string;
  type: string;
}

export function SearchBar({ big = false }: { big?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits(data.results ?? []);
        setOpen(true);
        setActive(-1);
      } catch {}
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function submit(term = q) {
    if (!term.trim()) return;
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(term.trim())}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Enter") {
      if (active >= 0 && hits[active]) router.push(`/product/${hits[active].slug}`);
      else submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div
        className={`flex items-center overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-volt ${
          big ? "h-14" : "h-11"
        }`}
      >
        <Search className={`ml-4 shrink-0 text-muted ${big ? "" : "size-5"}`} width={big ? 22 : 18} height={big ? 22 : 18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKey}
          placeholder={big ? "Search by size (e.g. 265/60R18), brand or SKU…" : "Search tyres…"}
          className={`w-full bg-transparent px-3 text-fg placeholder:text-faint outline-none ${big ? "text-base" : "text-sm"}`}
          aria-label="Search tyres"
        />
        <MicButton
          className={`mr-1 rounded-lg ${big ? "size-10" : "size-8"}`}
          title="Search by voice — e.g. “two oh five fifty-five R sixteen”"
          onInterim={(t) => setQ(t)}
          onResult={(t) => { const c = cleanVoiceQuery(t); setQ(c); submit(c); }}
        />
        <button
          onClick={() => submit()}
          className={`btn btn-volt m-1.5 shrink-0 ${big ? "px-6" : "px-4 text-xs"}`}
        >
          Search
        </button>
      </div>

      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50">
          {hits.map((h, i) => (
            <button
              key={h.slug}
              onMouseEnter={() => setActive(i)}
              onClick={() => router.push(`/product/${h.slug}`)}
              className={`relative flex w-full items-center gap-3 border-b border-line/60 px-3 py-2.5 text-left transition-colors last:border-0 ${
                active === i ? "bg-volt/10" : "hover:bg-surface-2"
              }`}
            >
              <span className={`absolute inset-y-1.5 left-0 w-1 rounded-full bg-volt transition-opacity ${active === i ? "opacity-100" : "opacity-0"}`} />
              <span className={`plate grid size-11 shrink-0 place-items-center overflow-hidden rounded-md transition-shadow ${active === i ? "ring-1 ring-volt" : ""}`}>
                {h.thumb ? (
                  <Image src={h.thumb} alt="" width={44} height={44} className="size-11 object-contain" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{h.name}</span>
                <span className="text-xs text-muted">
                  {h.brand}
                  {h.size ? ` · ${h.size}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-display text-sm text-volt">{formatPriceShort(h.price)}</span>
            </button>
          ))}
          <button
            onClick={() => submit()}
            className="block w-full bg-surface-2 px-3 py-2.5 text-center text-xs font-semibold text-muted hover:text-volt"
          >
            See all results for “{q}” →
          </button>
        </div>
      )}
    </div>
  );
}
