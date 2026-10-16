"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Check } from "./icons";

export function AnimatedRating({ overall = 4.8, count = "1,200+", sourceCopy = "Verified Google & on-site reviews" }: { overall?: number; count?: string; sourceCopy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Start at the real value so it never shows "0.0" (initial render / no-JS / SSR).
  const [val, setVal] = useState(overall);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const from = Math.max(0, overall - 0.5); // gentle count-up, never from 0
        const dur = 900;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(+(from + (overall - from) * eased).toFixed(1));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(overall);
        };
        requestAnimationFrame(tick);
        settle = setTimeout(() => setVal(overall), dur + 400);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(settle);
    };
  }, [overall]);

  return (
    <div ref={ref} className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-gradient-to-br from-surface to-ink-2 p-6 text-center sm:flex-row sm:text-left">
      {/* big number with glow */}
      <div className="relative shrink-0">
        <div className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle,rgba(138,197,63,0.3),transparent_70%)] blur-xl" />
        <div className="font-display text-chrome text-[5.5rem] leading-none sm:text-[7rem]">
          {val.toFixed(1)}
        </div>
      </div>
      <div>
        <div className="flex justify-center gap-1 text-amber-400 sm:justify-start">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} width={26} height={26} />
          ))}
        </div>
        <div className="mt-2 font-display text-2xl text-fg">OUT OF 5</div>
        <div className="mt-1 text-sm text-muted">
          From <b className="text-fg">{count}</b> South African drivers
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-pay/15 px-3 py-1 text-xs font-bold text-pay">
          <Check width={13} height={13} /> {sourceCopy}
        </div>
      </div>
    </div>
  );
}
