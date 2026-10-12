"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Close, Arrow, WhatsApp } from "./icons";
import { formatPrice } from "@/lib/format";
import { cleanVoiceQuery } from "@/lib/voice-search";
import { MicButton } from "./MicButton";
import { WhatsAppPanel } from "./WhatsAppPanel";

interface TyroneProduct {
  name: string;
  slug: string;
  brand: string;
  price: number;
  regularPrice: number;
  onSale: boolean;
  pct: number;
  thumb: string | null;
  size: string;
}
type Msg = { from: "bot" | "user"; text: string; products?: TyroneProduct[] };

interface Rule {
  keys: string[];
  answer: string;
}

// Keyword-matched knowledge base built from the site content. (No AI yet.)
const RULES: Rule[] = [
  {
    keys: ["delivery", "deliver", "shipping", "ship", "courier", "postage", "send", "how long", "nationwide"],
    answer:
      "Great question! 🚚 Delivery is FREE nationwide when you order 2 or more tyres — anywhere in South Africa. For a single tyre there's a small R200 delivery fee. Prefer to collect? Store fitment at our Johannesburg partner centres is free, and we'll call to book your slot.",
  },
  {
    keys: ["fit", "fitment", "install", "alignment", "balance", "centre", "center"],
    answer:
      "We offer FREE store fitment at our Johannesburg partner centres: Supa Quick (Selby & Cresta), HiQ Booysens, and Dunlop Zone (Boksburg & Midrand). Optional extras are wheel alignment (R450) and balance & valve (R100 per tyre). We'll call you to confirm a fitment time. 🔧",
  },
  {
    keys: ["pay", "payment", "card", "eft", "payfast", "checkout", "secure"],
    answer:
      "Paying is quick and secure 💳. At checkout you can pay by card or Instant EFT through PayFast, or choose Buy Now, Pay Later with HappyPay or Mobicred. Your card details are never stored on our site.",
  },
  {
    keys: ["happypay", "mobicred", "later", "instal", "credit", "months", "deposit", "upfront"],
    answer:
      "Yes! With HappyPay you can pay over 2 months at 0% interest, with no upfront payment — just a quick credit check at checkout. Mobicred is also available as a revolving buy-now-pay-later option. 😊",
  },
  {
    keys: ["find", "search", "looking", "size", "how do i find", "which tyre", "fit my car", "my car"],
    answer:
      "Easy! Use the search bar at the top — pop in your tyre size (like 265/60R18), a brand, or an SKU and I'll bring up matching tyres. You can also browse by category (Passenger, SUV, 4×4, UHP and more) or by brand. Not sure of your size? It's on your tyre's sidewall. 🔍",
  },
  {
    keys: ["brand", "brands", "make", "pirelli", "michelin", "goodyear", "bridgestone", "dunlop", "continental"],
    answer:
      "We stock 26 top brands including Bridgestone, Pirelli, Goodyear, Dunlop, Michelin, Continental, Radar and more. Hover over 'Shop by Brands' in the menu to see them all — tap any logo to see that brand's tyres. 👍",
  },
  {
    keys: ["mag", "wheel", "wheels", "rim", "rims"],
    answer:
      "Looking for mags? 🛞 Head to The Wheel Shop — we've got mag wheels from 14\" to 20\", including bakkie, 4×4 and replica designs. Can't find your exact fitment? Send us a quick quote request and we'll sort you out.",
  },
  {
    keys: ["road hazard", "radar protect", "warranty", "guarantee", "protection", "puncture"],
    answer:
      "Radar Protect is our 12-month road-hazard protection — peace of mind against those unexpected potholes and punctures. You can add it on the product page before checkout. 🛡️",
  },
  {
    keys: ["contact", "phone", "call", "email", "whatsapp", "number", "hours", "open", "address", "where"],
    answer:
      "You can reach the team on 078 0088 788 (Mon–Fri 8:00–17:00, Sat 8:00–13:00), email shop@thetyremall.co.za, or WhatsApp us any time. We're at 31 Heronmere Road, Reuven, Johannesburg. There's a full Contact page in the menu too. 📞",
  },
  {
    keys: ["return", "refund", "cancel", "wrong", "exchange"],
    answer:
      "No stress — if something's not right, check our Delivery & Returns Policy (linked in the footer) or just give us a shout on 078 0088 788 or shop@thetyremall.co.za and we'll help you sort it out. 🙂",
  },
  {
    keys: ["cheap", "cheapest", "deal", "deals", "sale", "discount", "special", "best price"],
    answer:
      "Love a bargain? 🔥 Check the deals — tap 'RED HOT DEALZ ON WHEELZ' on the home page or the Deals section to see what's on sale right now. We're all about the best tyres at the best prices.",
  },
  {
    keys: ["stock", "available", "availability", "in stock", "how many"],
    answer:
      "Stock is shown right on each product page — you'll see 'In stock' and the quantity available. If anything's out of stock, message us and we'll let you know when it's back. 👍",
  },
  {
    keys: ["thank", "thanks", "cheers", "appreciate", "great", "awesome", "perfect"],
    answer: "You're most welcome! 😊 Anything else I can help you with — tyres, delivery, payment or fitment?",
  },
  {
    keys: ["bye", "goodbye", "later", "see you", "cheers"],
    answer: "Cheers for chatting! Safe travels out there — come back any time. 👋",
  },
];

const GREETING =
  "Hey there! 👋 I'm Tyrone, your tyre guy at The Tyre Mall. Ask me anything — finding the right tyres, delivery, payment, fitment, you name it. How can I help today?";

const SUGGESTIONS = [
  "Tyres for my SUV",
  "I need 265/60R18",
  "Show me the deals",
  "How does delivery work?",
];

function matchRule(input: string): string {
  const q = ` ${input.toLowerCase()} `;
  let best: Rule | null = null;
  let bestScore = 0;
  for (const r of RULES) {
    let score = 0;
    for (const k of r.keys) if (q.includes(k)) score += k.includes(" ") ? 2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (best && bestScore > 0) return best.answer;
  return "I'm not totally sure on that one, but I'd love to help! 🙂 I can answer questions about finding tyres, delivery, payment, fitment, mag wheels, brands and more. You can also call us on 078 0088 788 or email shop@thetyremall.co.za.";
}

export function Tyrone() {
  const [open, setOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: GREETING }]);
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastMsgRef = useRef<HTMLDivElement>(null);

  // When a new bot reply arrives, bring the START of that reply to the top of
  // the chat so a long answer reads from the beginning (no scrolling up).
  // For the user's own message / typing, keep the latest in view at the bottom.
  useEffect(() => {
    const last = msgs[msgs.length - 1];
    if (last?.from === "bot" && msgs.length > 1) {
      lastMsgRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs, open]);

  useEffect(() => {
    if (typing) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [typing]);

  // Let other parts of the site open Tyrone (e.g. the no-results help panel)
  // and optionally have him greet with a specific message.
  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      setWaOpen(false);
      const say = (e as CustomEvent<{ botSay?: string }>).detail?.botSay;
      if (say) setMsgs((m) => (m.some((x) => x.text === say) ? m : [...m, { from: "bot", text: say }]));
    }
    window.addEventListener("ttm:tyrone", onOpen as EventListener);
    return () => window.removeEventListener("ttm:tyrone", onOpen as EventListener);
  }, []);

  async function send(text: string) {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setInput("");
    setTyping(true);
    const started = Date.now();
    let reply: Msg = { from: "bot", text: matchRule(t) };
    let firstProduct: TyroneProduct | undefined;
    try {
      const res = await fetch(`/api/tyrone?msg=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length) {
        reply = { from: "bot", text: `${data.label}${data.note ? " — " + data.note : ""}:`, products: data.products };
        firstProduct = data.products[0];
      }
    } catch {
      /* fall back to the keyword reply */
    }

    // Record the Tyrone enquiry (DB + email to the shop) — fire and forget.
    fetch("/api/enquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "tyrone",
        message: t,
        productSlug: firstProduct?.slug,
        productName: firstProduct?.name,
        price: firstProduct?.price,
      }),
      keepalive: true,
    }).catch(() => {});

    // Lead capture (item 44): if the visitor shared an email or phone, save it
    // so the team can follow up even if they drop off before buying.
    const hasContact = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(t) || /(?:\+?27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/.test(t);
    let leadReply: Msg | null = null;
    if (hasContact) {
      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "tyrone", message: t }),
        keepalive: true,
      }).catch(() => {});
      leadReply = { from: "bot", text: "Got it — I've saved your details. Someone from The Tyre Mall will reach out to help. 👍" };
    }

    // keep a natural little pause
    const wait = Math.max(0, 450 - (Date.now() - started));
    window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => (leadReply ? [...m, reply, leadReply] : [...m, reply]));
    }, wait);
  }

  return (
    <>
      {/* launcher dock — WhatsApp + Tyrone on a solid black row so page
          content is never hidden behind the two chat buttons */}
      {!open && !waOpen && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-black p-1.5 shadow-xl shadow-black/50 ring-1 ring-white/10">
          <button
            onClick={() => { setWaOpen(true); setOpen(false); }}
            className="grid size-11 place-items-center rounded-full bg-[#25D366] text-black transition-transform hover:scale-105"
            aria-label="WhatsApp / get a quote"
          >
            <WhatsApp width={24} height={24} />
          </button>
          <button
            onClick={() => { setOpen(true); setWaOpen(false); }}
            className="flex items-center gap-2 rounded-full bg-volt py-2 pl-2 pr-4 text-volt-ink transition-transform hover:scale-105"
            aria-label="Chat with Tyrone"
          >
            <span className="relative grid size-8 place-items-center rounded-full bg-ink text-volt">
              <Avatar />
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-volt bg-pay" />
            </span>
            <span className="text-sm font-extrabold">Chat with Tyrone</span>
          </button>
        </div>
      )}

      {/* panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] max-h-[82vh] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-ink-2 shadow-2xl shadow-black/60">
          {/* header */}
          <div className="flex items-center gap-3 border-b border-line bg-ink px-4 py-3">
            <span className="grid size-10 place-items-center rounded-full bg-volt/15 text-volt"><Avatar /></span>
            <div className="flex-1">
              <div className="font-display text-base leading-tight text-fg">Tyrone</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="size-2 rounded-full bg-pay" /> Online · The Tyre Mall
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg text-muted hover:text-fg" aria-label="Close chat">
              <Close width={18} height={18} />
            </button>
          </div>

          {/* messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                ref={i === msgs.length - 1 ? lastMsgRef : undefined}
                className={`flex scroll-mt-2 flex-col ${m.from === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.from === "user"
                      ? "rounded-br-sm bg-volt text-volt-ink"
                      : "rounded-bl-sm bg-surface text-fg"
                  }`}
                >
                  {m.text}
                </div>
                {m.products && m.products.length > 0 && (
                  <div className="mt-2 w-full space-y-2">
                    {m.products.map((p) => (
                      <Link
                        key={p.slug}
                        href={`/product/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-black/5 transition-transform hover:scale-[1.01]"
                      >
                        <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
                          {p.thumb && <img src={p.thumb} alt="" className="size-14 object-contain" />}
                          {p.onSale && p.pct > 0 && (
                            <span className="absolute left-0 top-0 rounded-br-md bg-sale px-1 text-[9px] font-black text-white">-{p.pct}%</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-extrabold uppercase tracking-wide text-[#4f7000]">{p.brand}{p.size ? ` · ${p.size}` : ""}</span>
                          <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-[#14171a]">{p.name}</span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {p.onSale && p.pct > 0 && <span className="text-[10px] text-neutral-400 line-through">{formatPrice(p.regularPrice)}</span>}
                            <span className="font-display text-sm text-[#14171a]">{formatPrice(p.price)}</span>
                          </span>
                        </span>
                        <Arrow width={14} height={14} className="shrink-0 text-[#4f7000]" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-surface px-3.5 py-3">
                  <span className="tyrone-dot" /><span className="tyrone-dot" /><span className="tyrone-dot" />
                </div>
              </div>
            )}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-volt hover:text-volt">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* input */}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 border-t border-line bg-ink p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Tyrone — type or tap the mic…"
              className="h-10 flex-1 rounded-full bg-surface-2 px-4 text-sm text-fg placeholder:text-faint outline-none focus:ring-1 focus:ring-volt"
            />
            <MicButton
              className="size-10 rounded-full bg-surface-2"
              title="Talk to Tyrone — e.g. “tyres for a Toyota Hilux 2021”"
              onInterim={(t) => setInput(t)}
              onResult={(t) => send(cleanVoiceQuery(t))}
            />
            <button type="submit" className="grid size-10 shrink-0 place-items-center rounded-full bg-volt text-volt-ink transition-transform hover:scale-105" aria-label="Send">
              <Arrow width={18} height={18} />
            </button>
          </form>
          <div className="border-t border-line bg-ink px-3 pb-2 pt-1 text-center text-[10px] text-faint">
            Tyrone gives general help · for orders call 078 0088 788
          </div>
        </div>
      )}

      {/* WhatsApp quote panel — mutually exclusive with the Tyrone chat */}
      <WhatsAppPanel open={waOpen} onClose={() => setWaOpen(false)} />
    </>
  );
}

function Avatar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12a8 8 0 0 1 16 0" />
      <path d="M4 12v4a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2z" fill="currentColor" />
      <path d="M20 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z" fill="currentColor" />
      <circle cx="12" cy="9" r="3" />
    </svg>
  );
}
