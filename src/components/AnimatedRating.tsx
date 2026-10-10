"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Check } from "./icons";

export function AnimatedRating() {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let settle: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const target = 4.8;
        const dur = 1300;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(+(target * eased).toFixed(1));
          if (p < 1) requestAnimationFrame(tick);
          else setVal(target);
        };
        requestAnimationFrame(tick);
        // guarantee the final value even if rAF is throttled (hidden/background tab)
        settle = setTimeout(() => setVal(target), dur + 400);
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(settle);
    };
  }, []);

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
          From <b className="text-fg">1,200+</b> South African drivers
        </div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-pay/15 px-3 py-1 text-xs font-bold text-pay">
          <Check width={13} height={13} /> Verified Google &amp; on-site reviews
        </div>
      </div>
    </div>
  );
}
