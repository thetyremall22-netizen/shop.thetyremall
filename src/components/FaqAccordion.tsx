"use client";

import { useState } from "react";
import { Chevron } from "./icons";
import type { FaqSection } from "@/data/faq";

export function FaqAccordion({ sections }: { sections: FaqSection[] }) {
  // open state keyed by "sectionIdx:itemIdx"
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className="space-y-10">
      {sections.map((sec, si) => (
        <section key={sec.section} id={slugify(sec.section)} className="scroll-mt-28">
          <h2 className="font-display text-2xl text-volt sm:text-3xl">{sec.section}</h2>
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {sec.items.map((item, ii) => {
              const k = `${si}:${ii}`;
              const isOpen = !!open[k];
              return (
                <div key={k}>
                  <button
                    onClick={() => toggle(k)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="font-semibold text-fg">{item.q}</span>
                    <Chevron
                      width={18}
                      height={18}
                      className={`shrink-0 text-volt transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
