import Link from "next/link";

/** Official The Tyre Mall logo (white/green on transparent — for dark backgrounds). */
export function Logo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="The Tyre Mall home" className={`ttm-logo inline-flex items-center ${className}`}>
      {/* Shown 56–76px tall: phones take the 240px copy (9 KB) instead of the 480px one (20 KB).
          A plain <img> because next/image drops a custom srcSet when images are unoptimized. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-real-sm.webp"
        srcSet="/brand/logo-real-xs.webp 240w, /brand/logo-real-sm.webp 480w"
        sizes="(min-width: 1024px) 140px, 104px"
        alt="The Tyre Mall"
        width={480}
        height={265}
        decoding="async"
        loading={priority ? "eager" : undefined}
        fetchPriority={priority ? "high" : undefined}
        style={{ color: "transparent" }}
        className="h-14 w-auto lg:h-[76px]"
      />
    </Link>
  );
}
