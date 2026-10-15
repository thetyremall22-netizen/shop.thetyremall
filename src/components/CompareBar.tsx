"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCompare, COMPARE_MAX } from "@/lib/compare";
import { Close, Arrow } from "./icons";

export function CompareBar() {
  const { items, remove, clear } = useCompare();
  const pathname = usePathname();

  // Hidden when empty or already on the compare page.
  if (items.length === 0 || pathname === "/compare") return null;

  return (
    <div className="fixed bottom-20 left-4 z-40 max-w-[calc(100vw-2rem)]">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink-2/95 p-2.5 pr-3 shadow-2xl shadow-black/60 backdrop-blur">
        <span className="hidden pl-1 text-xs font-bold uppercase tracking-wide text-muted sm:block">
          Compare<br />{items.length}/{COMPARE_MAX}
        </span>
        <div className="flex items-center gap-2">
          {items.map((i) => (
            <div key={i.id} className="group relative">
              <span className="plate grid size-11 place-items-center overflow-hidden rounded-lg ring-1 ring-line">
                {i.image && <Image src={i.image} alt={i.name} width={44} height={44} className="size-11 object-contain p-0.5" />}
              </span>
              <button
                onClick={() => remove(i.id)}
                aria-label={`Remove ${i.name}`}
                className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-sale text-white"
              >
                <Close width={10} height={10} />
              </button>
            </div>
          ))}
          {Array.from({ length: COMPARE_MAX - items.length }).map((_, i) => (
            <span key={`e${i}`} className="grid size-11 place-items-center rounded-lg border border-dashed border-line-2 text-faint">+</span>
          ))}
        </div>
        <Link href="/compare" className="btn btn-volt h-10 shrink-0 px-4 text-sm">
          Compare <Arrow width={15} height={15} />
        </Link>
        <button onClick={clear} className="shrink-0 text-xs font-semibold text-faint hover:text-sale" aria-label="Clear compare">
          Clear
        </button>
      </div>
    </div>
  );
}
