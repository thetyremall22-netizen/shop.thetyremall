"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface Slide { src: string; alt: string; href: string }

/** Home page marketing banner: one static image, or up to 3 that rotate. Only
 *  the first banner loads up front; the others load lazily, so extra banners
 *  don't slow the first paint. */
export function HomeBanners({ slides, mode, intervalSec }: { slides: Slide[]; mode: "static" | "rotate"; intervalSec: number }) {
  const list = mode === "rotate" ? slides.slice(0, 3) : slides.slice(0, 1);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = list.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  // Visitors who ask for reduced motion still see each banner, but it swaps
  // instantly instead of sliding.
  const [reduce, setReduce] = useState(false);
  useEffect(() => { setReduce(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), Math.max(3, intervalSec) * 1000);
    return () => window.clearInterval(t);
  }, [n, paused, intervalSec]);

  if (!n) return null;

  // Render helpers (plain functions, not components, so images aren't
  // re-mounted on every slide change).
  const img = (s: Slide, idx: number) => (
    // Plain <img>: banners are pre-compressed (≤300 KB, ≤2000px) on upload.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.src} alt={s.alt} width={2000} height={668}
      loading={idx === 0 ? "eager" : "lazy"} fetchPriority={idx === 0 ? "high" : "low"} decoding="async"
      className="aspect-[2000/668] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
  );
  const wrap = (s: Slide, idx: number) =>
    s.href ? (
      /^https?:/i.test(s.href)
        ? <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.alt} className="block">{img(s, idx)}</a>
        : <Link href={s.href} aria-label={s.alt} className="block">{img(s, idx)}</Link>
    ) : img(s, idx);

  if (n === 1) {
    return <div className="glow-hover group block overflow-hidden rounded-2xl border border-line">{wrap(list[0], 0)}</div>;
  }

  return (
    <div
      className="glow-hover group relative overflow-hidden rounded-2xl border border-line"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const start = touchX.current; touchX.current = null; setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      }}
      role="region" aria-roledescription="carousel" aria-label="Promotions"
    >
      <div className={`flex ${reduce ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]"}`} style={{ transform: `translateX(-${i * 100}%)` }}>
        {list.map((s, idx) => (
          <div key={idx} className="w-full shrink-0" aria-hidden={idx !== i} role="group" aria-roledescription="slide" aria-label={`${idx + 1} of ${n}`}>
            {wrap(s, idx)}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => go(i - 1)} aria-label="Previous banner"
        className="absolute left-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">‹</button>
      <button type="button" onClick={() => go(i + 1)} aria-label="Next banner"
        className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">›</button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {list.map((_, idx) => (
          <button key={idx} type="button" onClick={() => go(idx)} aria-label={`Show banner ${idx + 1}`} aria-current={idx === i}
            className={`h-2 rounded-full transition-all ${idx === i ? "w-6 bg-volt" : "w-2 bg-white/60"}`} />
        ))}
      </div>
    </div>
  );
}

/** YouTube video that only loads the player when tapped (keeps the page fast). */
export function LiteYouTube({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-black">
      {on ? (
        <iframe className="absolute inset-0 size-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
          <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#ff0000] text-2xl text-white shadow-xl">▶</span>
        </button>
      )}
    </div>
  );
}
