import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { setPriceOf4 } from "@/lib/pricing";
import { parseTyreSpec } from "@/lib/tyre-spec";

const kmh = (v?: string) => (v === "240+" ? "240+" : v);

type Row = { label: string; cell: (p: Product) => React.ReactNode };

/** Read-only spec comparison of the current product vs a few alternatives,
 *  embedded on the product page. Tyres compare with same-size tyres; wheels
 *  with other wheels. */
export function OnPageCompare({ items, isTyre, currentId }: { items: Product[]; isTyre: boolean; currentId: number }) {
  if (items.length < 2) return null;

  const rows: Row[] = isTyre
    ? [
        { label: "Brand", cell: (p) => p.brand },
        { label: "Pattern", cell: (p) => parseTyreSpec(p).pattern ?? "—" },
        { label: "Size", cell: (p) => p.specs.size ?? "—" },
        {
          label: "Load / Speed",
          cell: (p) => {
            const s = parseTyreSpec(p);
            const load = s.loadIndex ? (s.loadKg ? `${s.loadIndex} · ${s.loadKg}kg` : s.loadIndex) : null;
            const sp = s.speed ? (s.speedKmh ? `${s.speed} · ${kmh(s.speedKmh)}km/h` : s.speed) : null;
            return [load, sp].filter(Boolean).join("  /  ") || "—";
          },
        },
        { label: "Run-flat", cell: (p) => (parseTyreSpec(p).runFlat ? "Yes" : "No") },
        { label: "Extra load", cell: (p) => (parseTyreSpec(p).extraLoad ? "Yes" : "No") },
        { label: "Per tyre", cell: (p) => <span className="font-display text-base text-fg">{formatPrice(p.price)}</span> },
        { label: "Set of 4", cell: (p) => <span className="font-display text-base text-volt">{formatPrice(setPriceOf4(p.price))}</span> },
        { label: "Stock", cell: (p) => (p.inStock ? <span className="font-semibold text-pay">In stock</span> : <span className="text-sale">Out</span>) },
      ]
    : [
        { label: "Brand", cell: (p) => p.brand },
        { label: "Size", cell: (p) => p.specs.size ?? "—" },
        { label: "Width", cell: (p) => p.specs.width ?? "—" },
        { label: "PCD", cell: (p) => p.specs.pcd ?? "—" },
        { label: "Price (set)", cell: (p) => <span className="font-display text-base text-volt">{formatPrice(p.price)}</span> },
        { label: "Stock", cell: (p) => (p.inStock ? <span className="font-semibold text-pay">In stock</span> : <span className="text-sale">Out</span>) },
      ];

  const colBg = (p: Product) => (p.id === currentId ? "bg-volt/10" : "bg-ink-2");

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl sm:text-3xl">Compare {isTyre ? "this tyre" : "this wheel"} with alternatives</h2>
      <p className="mt-1 text-sm text-muted">
        Side by side — this {isTyre ? "tyre" : "wheel"} vs {isTyre ? "same-size options" : "similar wheels"} from other brands.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <div className="grid min-w-[560px] text-sm" style={{ gridTemplateColumns: `minmax(110px,130px) repeat(${items.length}, minmax(130px,1fr))` }}>
          {/* header */}
          <div className="border-b border-line bg-ink-2 p-3" />
          {items.map((p) => (
            <div key={`h${p.id}`} className={`border-b border-l border-line p-3 text-center ${colBg(p)}`}>
              <Link href={`/product/${p.slug}`} className="plate mx-auto grid size-16 place-items-center overflow-hidden rounded-lg">
                {p.image && <Image src={p.image} alt={p.name} width={64} height={64} className="size-16 object-contain p-1" />}
              </Link>
              {p.id === currentId && <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-volt">This {isTyre ? "tyre" : "wheel"}</div>}
              <Link href={`/product/${p.slug}`} className="mt-1 block line-clamp-2 text-xs font-semibold text-fg hover:text-volt">{p.name}</Link>
            </div>
          ))}

          {/* rows */}
          {rows.map((row, r) => (
            <RowCells key={row.label} row={row} items={items} currentId={currentId} stripe={r % 2 === 1} />
          ))}

          {/* footer */}
          <div className="border-t border-line bg-ink-2 p-3" />
          {items.map((p) => (
            <div key={`v${p.id}`} className={`border-l border-t border-line p-3 ${colBg(p)}`}>
              {p.id === currentId ? (
                <span className="grid h-9 w-full place-items-center rounded-lg text-xs font-bold text-muted">You&apos;re here</span>
              ) : (
                <Link href={`/product/${p.slug}`} className="btn btn-ghost h-9 w-full px-2 text-xs">View</Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RowCells({ row, items, currentId, stripe }: { row: Row; items: Product[]; currentId: number; stripe: boolean }) {
  const bg = stripe ? "bg-surface" : "bg-ink-2";
  return (
    <>
      <div className={`border-b border-line px-3 py-2.5 font-semibold text-muted ${bg}`}>{row.label}</div>
      {items.map((p) => (
        <div key={`${row.label}-${p.id}`} className={`border-b border-l border-line px-3 py-2.5 text-fg ${p.id === currentId ? "bg-volt/5" : bg}`}>
          {row.cell(p)}
        </div>
      ))}
    </>
  );
}
