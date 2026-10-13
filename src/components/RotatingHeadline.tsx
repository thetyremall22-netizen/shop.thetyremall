"use client";

import { useEffect, useState } from "react";

type Line = { t: string; c: string };
const SLIDES: Line[][] = [
  [
    { t: "CHEAPEST", c: "text-chrome" },
    { t: "TYRES", c: "text-volt-grad" },
  ],
  [
    { t: "BIGGEST BRANDS", c: "text-volt-grad" },
    { t: "WIDEST RANGE", c: "text-chrome" },
    { t: "BEST PRICES", c: "text-volt-grad" },
  ],
];

export function RotatingHeadline() {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const id = setInterval(() => {
      setPhase("out");
      window.setTimeout(() => {
        setI((p) => (p + 1) % SLIDES.length);
        setPhase("in");
      }, 420);
    }, 3800);
    return () => clearInterval(id);
  }, []);

  const slide = SLIDES[i];
  const big = slide.length <= 2;
  const sizeCls = big
    ? "text-[4.5rem] sm:text-8xl lg:text-9xl"
    : "text-5xl sm:text-7xl lg:text-8xl";

  return (
    <div className="relative mt-1 min-h-[7.5rem] sm:min-h-[10.5rem] lg:min-h-[13.5rem]">
      <h1 className={`absolute inset-0 skew-italic font-display leading-[0.82] tracking-tight ${phase === "out" ? "headline-out" : "headline-in"}`}>
        {slide.map((l, idx) => (
          <span key={idx} className={`block ${l.c} ${sizeCls}`} style={{ animationDelay: `${idx * 0.08}s` }}>
            {l.t}
          </span>
        ))}
      </h1>
    </div>
  );
}
