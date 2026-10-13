import Link from "next/link";
import Image from "next/image";

/** Official The Tyre Mall logo (white/green on transparent — for dark backgrounds). */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="The Tyre Mall home" className={`ttm-logo inline-flex items-center ${className}`}>
      <Image
        src="/brand/logo-real.webp"
        alt="The Tyre Mall"
        width={1500}
        height={827}
        priority={priority}
        className="h-14 w-auto lg:h-[76px]"
      />
    </Link>
  );
}
