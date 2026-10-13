"use client";

import { useEffect, useState } from "react";

type Word = { t: string; g?: boolean };
const MESSAGES: Word[][] = [
  [{ t: "BIGGEST", g: true }, { t: "BRANDS" }, { t: "WIDEST", g: true }, { t: "RANGE" }, { t: "BEST", g: true }, { t: "PRICES" }],
  [{ t: "FREE" }, { t: "DELIVERY" }, { t: "ACROSS", g: true }, { t: "SA", g: true }],
  [{ t: "BUY" }, { t: "NOW," }, { t: "PAY", g: true }, { t: "LATER", g: true }],
  [{ t: "4.8★", g: true }, { t: "GOOGLE" }, { t: "RATING" }],
  [{ t: "SAFE" }, { t: "&" }, { t: "SECURE", g: true }],
  [{ t: "25", g: true }, { t: "YEARS", g: true }, { t: "TRUSTED" }],
];

const STAGGER = 110;
const ENTER = 550;
const EXIT = 450;
const HOLD = 1700;

export function RotatingHeadline() {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    const n = MESSAGES[idx].length;
    if (phase === "in") {
      const t = setTimeout(() => setPhase("out"), (n - 1) * STAGGER + ENTER + HOLD);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIdx((i) => (i + 1) % MESSAGES.length);
      setPhase("in");
    }, (n - 1) * STAGGER + EXIT);
    return () => clearTimeout(t);
  }, [idx, phase]);

  const words = MESSAGES[idx];

  return (
    <div className="flex min-h-[120px] items-center overflow-hidden sm:min-h-[150px] lg:min-h-[192px]">
      <h2
        className="skew-italic flex flex-wrap items-baseline gap-x-[0.28em] gap-y-1 font-display leading-[0.85]"
        style={{ fontSize: "clamp(2.2rem, 8.5vw, 6rem)" }}
        aria-label={words.map((w) => w.t).join(" ")}
      >
        {words.map((w, i) => (
          <span
            key={`${idx}-${phase}-${i}`}
            className={`fly-word ${phase}`}
            style={{ ["--delay" as string]: `${i * STAGGER}ms` }}
          >
            <span className={w.g ? "text-volt-grad" : "text-chrome"}>{w.t}</span>
          </span>
        ))}
      </h2>
    </div>
  );
}
