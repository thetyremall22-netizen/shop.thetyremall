"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Close, Flame } from "./icons";
import { formatPrice } from "@/lib/format";
import { cleanVoiceQuery } from "@/lib/voice-search";
import { MicButton } from "./MicButton";
import { DragScroll } from "./DragScroll";
import { BurstLink } from "./BurstLink";

interface Hit {
  name: string;
  slug: string;
  brand: string;
  price: number;
  regularPrice: number;
  onSale: boolean;
  pct: number;
  thumb: string | null;
  size: string;
  type: string;
  inStock: boolean;
}

const POPULAR = [
  "265/65R17", "215/45R17", "265/60R18", "215/35R19", "185/60R15",
  "225/45R18", "205/55R16", "Radar", "Michelin", "Mag wheels",
];
const RECENT_KEY = "ttm-recent-searches";

export function MegaSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [mode, setMode] = useState<"recommended" | "results">("recommended");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false); // panel in the DOM (for exit anim)
  const [show, setShow] = useState(false); // panel visible (triggers transition)
  const [recent, setRecent] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const prefetched = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  // Prefetch the recommended list on mount so the panel is instant on first
  // tap (previously it only started fetching once opened → felt slow).
  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/search?q=`);
        const data = await res.json();
        setHits(data.results ?? []);
        setMode(data.mode ?? "recommended");
      } catch {}
    })();
  }, []);

  // Mount/unmount with entrance + exit animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(r);
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);

  // fetch (recommended when empty, results when typing)
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setHits(data.results ?? []);
        setMode(data.mode ?? "recommended");
      } catch {}
    }, q.trim().length >= 2 ? 160 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  function pushRecent(term: string) {
    const next = [term, ...recent.filter((r) => r.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  }

  function go(term: string) {
    const t = term.trim();
    if (!t) return;
    pushRecent(t);
    setOpen(false);
    router.push(`/shop?q=${encodeURIComponent(t)}`);
  }

  function clearRecent() {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  }

  return (
    <div ref={boxRef} className="relative w-full">
      {/* permanent bar */}
      <form
        onSubmit={(e) => { e.preventDefault(); go(q); }}
        className="flex h-10 items-center overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-volt"
      >
        <Search className="ml-4 shrink-0 text-muted" width={20} height={20} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search 7,000+ tyres & mags — by size (265/60R18), brand or SKU…"
          className="w-full bg-transparent px-3 text-sm text-fg placeholder:text-faint outline-none sm:text-base"
          aria-label="Search tyres and wheels"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="grid size-8 place-items-center text-faint hover:text-fg" aria-label="Clear">
            <Close width={16} height={16} />
          </button>
        )}
        <MicButton
          className="mr-1 size-9 rounded-lg"
          title="Search by voice — e.g. “two oh five fifty-five R sixteen”"
          onInterim={(t) => { setOpen(true); setQ(t); }}
          onResult={(t) => { const c = cleanVoiceQuery(t); setQ(c); go(c); }}
        />
        <button type="submit" className="btn btn-volt m-1 shrink-0 px-5">Search</button>
      </form>

      {/* mega panel — full viewport width */}
      {mounted && (
        <div className="absolute left-[calc(-50vw+50%)] top-full z-50 mt-2 w-screen">
          <div className="mega-panel border-y border-line bg-ink-2 shadow-2xl shadow-black/60" data-show={show}>
          <div className="grid w-full gap-0 px-5 py-1 lg:grid-cols-[260px_1fr] lg:px-8">
            {/* left: searches */}
            <div className="border-b border-line p-4 lg:border-b-0 lg:border-r lg:pr-6">
              {recent.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Recent</span>
                    <button onClick={clearRecent} className="text-[11px] font-semibold text-sale hover:underline">Clear</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button key={r} onClick={() => go(r)} className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg hover:border-volt hover:text-volt">{r}</button>
                    ))}
                  </div>
                </div>
              )}
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">Popular searches</span>
              <ul className="space-y-0.5">
                {POPULAR.map((p) => (
                  <li key={p}>
                    <button onClick={() => go(p)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-volt">{p}</button>
                  </li>
                ))}
              </ul>
            </div>

            {/* right: products */}
            <div className="min-w-0 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="eyebrow">
                  {mode === "results" ? `Results for “${q}”` : (
                    <span className="inline-flex items-center gap-1.5"><Flame width={13} height={13} className="text-sale" /> Hot picks &amp; deals</span>
                  )}
                </span>
                <button onClick={() => go(q || "")} className="text-xs font-bold text-volt hover:underline">
                  {mode === "results" ? "See all results →" : "Shop all →"}
                </button>
              </div>

              {hits.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No matches — try a tyre size like “265/60R18”.</p>
              ) : (
                <DragScroll className="no-scrollbar flex gap-3 overflow-x-auto py-2">
                  {hits.map((h, i) => (
                    <BurstLink
                      key={h.slug}
                      href={`/product/${h.slug}`}
                      onActivate={() => { pushRecent(q || h.brand); setOpen(false); }}
                      style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                      className="mega-card glow-hover-tight flex w-40 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-[#14171a] shadow-lg shadow-black/20 ring-1 ring-black/5"
                    >
                      <div className="relative aspect-square w-full bg-white">
                        {h.thumb && <Image src={h.thumb} alt={h.name} fill sizes="160px" className="object-contain p-2" />}
                        {h.onSale && h.pct > 0 && <span className="badge badge-sale absolute left-1.5 top-1.5">-{h.pct}%</span>}
                        {!h.inStock && <span className="absolute inset-x-0 top-0 bg-black/80 py-0.5 text-center text-[9px] font-bold uppercase text-white">Out of stock</span>}
                      </div>
                      <div className="flex flex-1 flex-col border-t border-black/5 p-2">
                        <div className="text-[9px] font-extrabold uppercase tracking-wide text-[#4f7000]">{h.brand}</div>
                        <div className="line-clamp-2 min-h-[2.4em] text-[11px] font-medium leading-snug">{h.name}</div>
                        <div className="mt-auto flex items-end gap-1.5 pt-1">
                          {h.onSale && h.pct > 0 && <span className="text-[10px] text-neutral-400 line-through">{formatPrice(h.regularPrice)}</span>}
                          <span className="font-display text-sm text-[#14171a]">{formatPrice(h.price)}</span>
                        </div>
                      </div>
                    </BurstLink>
                  ))}
                </DragScroll>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
