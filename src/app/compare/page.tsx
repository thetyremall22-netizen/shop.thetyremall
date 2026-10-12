"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCompare, type CompareItem } from "@/lib/compare";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { hasSetPricing, setPriceOf4 } from "@/lib/pricing";
import { parseTyreSpec } from "@/lib/tyre-spec";
import { Close, Cart, Chevron } from "@/components/icons";

const kmh = (v?: string) => (v === "240+" ? "240+" : v);

type Row = { label: string; cell: (i: CompareItem) => React.ReactNode };

const ROWS: Row[] = [
  { label: "Brand", cell: (i) => i.brand },
  { label: "Pattern", cell: (i) => parseTyreSpec(i).pattern ?? "—" },
  { label: "Size", cell: (i) => i.specs.size ?? "—" },
  { label: "Range", cell: (i) => parseTyreSpec(i).range },
  { label: "Load index", cell: (i) => { const s = parseTyreSpec(i); return s.loadIndex ? (s.loadKg ? `${s.loadIndex} · ${s.loadKg} kg` : s.loadIndex) : "—"; } },
  { label: "Speed rating", cell: (i) => { const s = parseTyreSpec(i); return s.speed ? (s.speedKmh ? `${s.speed} · ${kmh(s.speedKmh)} km/h` : s.speed) : "—"; } },
  { label: "Run-flat", cell: (i) => (parseTyreSpec(i).runFlat ? "Yes" : "No") },
  { label: "Extra load", cell: (i) => (parseTyreSpec(i).extraLoad ? "Yes" : "No") },
  { label: "OE approval", cell: () => "—" },
  {
    label: "Per tyre",
    cell: (i) => (
      <span>
        {i.onSale && i.regularPrice > i.price && (
          <span className="mr-1.5 text-xs text-faint line-through">{formatPrice(i.regularPrice)}</span>
        )}
        <span className="font-display text-base text-fg">{formatPrice(i.price)}</span>
      </span>
    ),
  },
  {
    label: "Set of 4",
    cell: (i) => (hasSetPricing(i.type) ? <span className="font-display text-base text-volt">{formatPrice(setPriceOf4(i.price))}</span> : "—"),
  },
  { label: "Availability", cell: (i) => (i.inStock ? <span className="font-semibold text-pay">In stock</span> : <span className="text-sale">Out of stock</span>) },
];

export default function ComparePage() {
  const { items, remove, clear } = useCompare();
  const { add } = useCart();
  const router = useRouter();

  function addSet(i: CompareItem) {
    const isTyre = i.type === "tyre";
    add({ id: i.id, slug: i.slug, name: i.name, brand: i.brand, image: i.image, price: i.price, type: i.type, roadHazard: false }, isTyre ? 4 : 1);
  }

  return (
    <div className="container-x py-8 lg:py-12">
      <nav className="flex items-center gap-1.5 text-xs text-muted">
        <Link href="/" className="hover:text-volt">Home</Link>
        <Chevron width={12} height={12} />
        <span className="text-fg">Compare</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="skew-italic font-display text-4xl sm:text-6xl">
          <span className="text-chrome">COMPARE</span> <span className="text-volt-grad">TYRES</span>
        </h1>
        {items.length > 0 && (
          <button onClick={clear} className="text-sm font-semibold text-faint hover:text-sale">Clear all</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-line bg-ink-2 p-10 text-center">
          <p className="font-display text-xl text-fg">No tyres to compare yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Tick <b className="text-fg">Compare</b> on any tyre (up to 3) and they&apos;ll show here side by side.
          </p>
          <Link href="/shop" className="btn btn-volt mt-5 h-11 px-6">Browse tyres</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
          <div
            className="grid min-w-[560px] text-sm"
            style={{ gridTemplateColumns: `minmax(120px,150px) repeat(${items.length}, minmax(150px,1fr))` }}
          >
            {/* header */}
            <div className="border-b border-line bg-ink-2 p-4" />
            {items.map((i) => (
              <div key={`h${i.id}`} className="border-b border-l border-line bg-ink-2 p-4 text-center">
                <Link href={`/product/${i.slug}`} className="plate mx-auto grid size-20 place-items-center overflow-hidden rounded-xl">
                  {i.image && <Image src={i.image} alt={i.name} width={80} height={80} className="size-20 object-contain p-1" />}
                </Link>
                <Link href={`/product/${i.slug}`} className="mt-2 block text-xs font-semibold leading-snug text-fg hover:text-volt">{i.name}</Link>
                <button onClick={() => remove(i.id)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-faint hover:text-sale">
                  <Close width={11} height={11} /> Remove
                </button>
              </div>
            ))}

            {/* spec rows */}
            {ROWS.map((row, r) => (
              <RowCells key={row.label} row={row} items={items} stripe={r % 2 === 1} />
            ))}

            {/* add buttons */}
            <div className="border-t border-line bg-ink-2 p-3" />
            {items.map((i) => (
              <div key={`a${i.id}`} className="border-l border-t border-line bg-ink-2 p-3">
                <button
                  disabled={!i.inStock}
                  onClick={() => addSet(i)}
                  className="btn btn-volt h-10 w-full px-2 text-xs disabled:opacity-50"
                >
                  <Cart width={15} height={15} /> {i.type === "tyre" ? "Add set of 4" : "Add to cart"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length > 0 && items.length < 3 && (
        <p className="mt-4 text-sm text-muted">
          You can add {3 - items.length} more. <Link href="/shop" className="font-semibold text-volt hover:underline">Keep browsing →</Link>
        </p>
      )}
    </div>
  );
}

function RowCells({ row, items, stripe }: { row: Row; items: CompareItem[]; stripe: boolean }) {
  const bg = stripe ? "bg-surface" : "bg-ink-2";
  return (
    <>
      <div className={`border-b border-line px-4 py-3 font-semibold text-muted ${bg}`}>{row.label}</div>
      {items.map((i) => (
        <div key={`${row.label}-${i.id}`} className={`border-b border-l border-line px-4 py-3 text-fg ${bg}`}>
          {row.cell(i)}
        </div>
      ))}
    </>
  );
}
