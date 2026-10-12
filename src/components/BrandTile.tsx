import Link from "next/link";
import Image from "next/image";
import { brandHref, brandLogoPath, hasBrandLogo } from "@/lib/brands";

export function BrandTile({ brand, onClick }: { brand: string; onClick?: () => void }) {
  return (
    <Link
      href={brandHref(brand)}
      aria-label={brand}
      onClick={onClick}
      className="glow-hover flex aspect-[3/2] items-center justify-center rounded-xl bg-white p-2 ring-1 ring-black/5 transition-transform hover:scale-[1.04]"
    >
      {hasBrandLogo(brand) ? (
        <Image src={brandLogoPath(brand)} alt={brand} width={140} height={84} className="h-auto max-h-full w-auto max-w-full object-contain" />
      ) : (
        <span className="skew-italic text-center font-display text-base uppercase leading-none tracking-wide text-[#14171a] sm:text-lg">{brand}</span>
      )}
    </Link>
  );
}
