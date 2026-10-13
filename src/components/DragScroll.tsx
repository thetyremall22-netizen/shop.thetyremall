"use client";

import { useRef } from "react";

/** Horizontal scroll row you can swipe (touch) or click-and-drag (mouse) to
 *  reveal off-screen cards. After a real drag it swallows the click so the
 *  card underneath doesn't navigate. */
export function DragScroll({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ down: false, moved: false, startX: 0, startLeft: 0 });

  function onPointerDown(e: React.PointerEvent) {
    // only left mouse / primary pointer
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    st.current = { down: true, moved: false, startX: e.clientX, startLeft: el.scrollLeft };
  }
  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || !st.current.down) return;
    const dx = e.clientX - st.current.startX;
    if (Math.abs(dx) > 4) {
      st.current.moved = true;
      el.scrollLeft = st.current.startLeft - dx;
      // start capturing so the pointer keeps driving the scroll off-element
      if (e.pointerType === "mouse") el.setPointerCapture?.(e.pointerId);
    }
  }
  function endDrag() { st.current.down = false; }
  function onClickCapture(e: React.MouseEvent) {
    if (st.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      st.current.moved = false;
    }
  }

  return (
    <div
      ref={ref}
      className={`${className} ${"cursor-grab active:cursor-grabbing"}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  );
}
