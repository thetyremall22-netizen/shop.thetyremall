"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

/** A card link that does a quick "burst" (grow) before navigating to the
 *  product page. Plays nicely inside <DragScroll>: a drag cancels the click
 *  before this fires, and modified clicks (new tab) are left alone. */
export function BurstLink({
  href,
  className = "",
  children,
  onActivate,
  ...rest
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  onActivate?: () => void;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "onClick">) {
  const router = useRouter();
  const ref = useRef<HTMLAnchorElement>(null);
  const navigating = useRef(false);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented) return; // a drag already cancelled it
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return; // new tab etc.
    e.preventDefault();
    if (navigating.current) return;
    navigating.current = true;
    onActivate?.();
    ref.current?.classList.add("bursting");
    router.prefetch?.(href);
    window.setTimeout(() => router.push(href), 165);
  }

  return (
    <Link ref={ref} href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
