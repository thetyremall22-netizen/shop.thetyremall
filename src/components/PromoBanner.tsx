import Image from "next/image";
import Link from "next/link";

/** Full-width marketing banner. Swap `src`/`href`/`alt` to run a new promo —
 *  artwork is a wide landscape image (≈3:1). */
export function PromoBanner({
  src,
  href,
  alt,
  priority = false,
}: {
  src: string;
  href: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={alt}
      className="glow-hover group block overflow-hidden rounded-2xl border border-line"
    >
      <Image
        src={src}
        alt={alt}
        width={2000}
        height={668}
        priority={priority}
        sizes="(max-width:1280px) 100vw, 1216px"
        className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.02]"
      />
    </Link>
  );
}
