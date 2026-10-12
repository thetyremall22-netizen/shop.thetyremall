import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const Search = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const Mic = (p: P) => (
  <svg {...base(p)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
);
export const Cart = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2.2l2.1 12.2a1.5 1.5 0 0 0 1.5 1.3h8.8a1.5 1.5 0 0 0 1.5-1.2L21 7H5.3" /></svg>
);
export const Menu = (p: P) => (
  <svg {...base(p)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);
export const Close = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Truck = (p: P) => (
  <svg {...base(p)}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
);
export const Shield = (p: P) => (
  <svg {...base(p)}><path d="M12 3 5 6v5c0 4.3 3 7.4 7 9 4-1.6 7-4.7 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const Chevron = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const Star = (p: P) => (
  <svg {...base({ fill: "currentColor", stroke: "none", ...p })}><path d="m12 2 2.9 6 6.6.6-5 4.4 1.5 6.4L12 16.9 6 19.8l1.5-6.4-5-4.4 6.6-.6z" /></svg>
);
export const Bolt = (p: P) => (
  <svg {...base({ fill: "currentColor", stroke: "none", ...p })}><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}><path d="m5 12 5 5L20 6" /></svg>
);
export const Plus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const Minus = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
);
export const Filter = (p: P) => (
  <svg {...base(p)}><path d="M3 5h18M6 12h12M10 19h4" /></svg>
);
export const Trash = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const Pin = (p: P) => (
  <svg {...base(p)}><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const Phone = (p: P) => (
  <svg {...base(p)}><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>
);
export const User = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" /></svg>
);
export const Heart = (p: P) => (
  <svg {...base(p)}><path d="M12 20s-7-4.3-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 5c-2.3 4.7-9.3 9-9.3 9z" /></svg>
);
export const Arrow = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Flame = (p: P) => (
  <svg {...base({ fill: "currentColor", stroke: "none", ...p })}><path d="M12 2c0 3-4 4-4 8a4 4 0 0 0 8 0c0-1-.5-2-1-2.5.3 1.3-.7 2-1.2 2-.9 0-1.3-.8-.8-1.8C13.8 5.6 12 3.5 12 2zm-1.3 10.5c0 1.6-1.2 2-1.2 3.4A2.5 2.5 0 0 0 12 18.4a2.5 2.5 0 0 0 2.5-2.5c0-1.9-1.8-2.2-1.8-3.9-.4.6-1 .9-1 1.7 0 .5.2.8.2 1.1 0 .5-.4.8-.8.8-.5 0-.8-.4-.8-1 0-.6.2-1 .2-1.6z" /></svg>
);
export const WhatsApp = (p: P) => (
  <svg {...base({ fill: "currentColor", stroke: "none", ...p })}><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.2.5.2.6.4.1.1.1.8-.1 1.3z" /></svg>
);
