import type { TyreSpec } from "@/lib/tyre-spec";

/** "How to read this size" — breaks a tyre's own numbers down into plain English. */
export function TyreSizeExplainer({ spec }: { spec: TyreSpec }) {
  if (!spec.width || !spec.profile || !spec.rim) return null;

  const cols: { value: string; label: string; sub: string }[] = [
    { value: `${spec.width}/`, label: "Width", sub: "Tread width in millimetres" },
    { value: spec.profile, label: "Profile", sub: "Sidewall height as % of width" },
    { value: `R${spec.rim}`, label: "Rim", sub: `Fits a ${spec.rim}-inch wheel` },
  ];
  if (spec.loadIndex) {
    cols.push({
      value: spec.loadIndex,
      label: "Load index",
      sub: spec.loadKg ? `${spec.loadKg} kg per tyre` : "Max load per tyre",
    });
  }
  if (spec.speed) {
    cols.push({
      value: spec.speed,
      label: "Speed",
      sub: spec.speedKmh ? `Up to ${spec.speedKmh === "240+" ? "240+" : spec.speedKmh} km/h` : "Speed rating",
    });
  }

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl sm:text-3xl">How to read this size</h2>
      <div className="mt-4 rounded-2xl border border-line bg-ink-2 p-5 sm:p-7">
        <div
          className="grid gap-y-6 gap-x-2 text-center"
          style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
        >
          {/* big values */}
          {cols.map((c, i) => (
            <div key={`v${i}`} className="font-display text-3xl leading-none text-volt sm:text-5xl">
              {c.value}
            </div>
          ))}
          {/* connector ticks */}
          {cols.map((_, i) => (
            <div key={`t${i}`} className="mx-auto h-5 w-px bg-line-2" />
          ))}
          {/* labels + sub-text */}
          {cols.map((c, i) => (
            <div key={`l${i}`} className="px-1">
              <div className="font-bold text-fg">{c.label}</div>
              <div className="mt-1 text-xs leading-snug text-muted">{c.sub}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-faint">
          Find these numbers on your current tyre&apos;s sidewall, then type them into the search bar.
        </p>
      </div>
    </section>
  );
}
