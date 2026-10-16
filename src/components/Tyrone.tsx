"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Close, Arrow, WhatsApp } from "./icons";
import { formatPrice } from "@/lib/format";
import { cleanVoiceQuery, correctBrands, detectTyreSize } from "@/lib/voice-search";
import { parseSize, sizeToShopHref } from "@/lib/tyre-size";
import { MicButton } from "./MicButton";
import { WhatsAppPanel } from "./WhatsAppPanel";
import { useCart } from "@/lib/cart";
import type { VehicleRecord } from "./VehicleSizeChoice";

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
type Msg = { from: "bot" | "user"; text: string; products?: TyroneProduct[]; buttons?: string[]; links?: { label: string; href: string }[] };

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
      "Paying is quick and secure 💳. At checkout you can pay by card or Instant EFT through PayFast, or choose Buy Now, Pay Later with HappyPay. Your card details are never stored on our site.",
  },
  {
    keys: ["happypay", "later", "instal", "credit", "months", "deposit", "upfront"],
    answer:
      "Yes! With HappyPay you can pay over 2 months at 0% interest, with no upfront payment — just a quick credit check at checkout. 😊",
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
  "Hey there! 👋 I'm Tyrone, your tyre guy at The Tyre Mall. What can I help you with today? Pick an option below, or just type or say what you need.";

// Guided menu (blueprint: by size · by vehicle · wheels · fitment & delivery ·
// track order · talk to a human). Labels double as the button text.
const MENU = {
  size: "🔍 Find tyres by size",
  vehicle: "🚗 Find tyres by vehicle",
  wheels: "🛞 Mag wheels & rims",
  info: "🚚 Fitment & delivery",
  order: "📦 Track my order",
  human: "💬 Talk to a human",
};
const MAIN_MENU = [MENU.size, MENU.vehicle, MENU.wheels, MENU.info, MENU.order, MENU.human];
const WA_BUTTON = "💬 Chat on WhatsApp";
const FOLLOWUPS = [MENU.size, MENU.vehicle, MENU.human];

// Filler words stripped before deciding whether a message is just a broad
// category word ("tyres", "I need some mags", "do you have wheels").
const CAT_FILLERS =
  /\b(i|need|want|wanna|looking|look|for|a|an|some|new|the|me|show|get|got|find|please|pls|hi|hey|hello|yo|do|you|have|any|my|buy|price|prices|on|of|to|see|browse|check|cheap|cheapest|best|good|great|there|and|or|help|with)\b/g;

/** If a message boils down to just a category word (tyres / wheels / mags) with
 *  no size, brand or vehicle, return which catalogue it's about so Tyrone can
 *  guide the user instead of hitting the generic fallback. */
function categoryIntent(t: string): "tyre" | "wheel" | null {
  const cleaned = t.replace(/[^a-z0-9\s]/g, " ").replace(CAT_FILLERS, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const words = cleaned.split(" ");
  const isTyre = (w: string) => /^(tyres?|tires?)$/.test(w);
  const isWheel = (w: string) => /^(wheels?|mags?|rims?|alloys?)$/.test(w);
  if (!words.every((w) => isTyre(w) || isWheel(w))) return null; // has a real query term → let search handle it
  return words.some(isWheel) && !words.some(isTyre) ? "wheel" : "tyre";
}

/** Scripted menu flows that just need a prompt or a canned answer (no catalogue
 *  search). Returns a bot reply with quick-reply buttons, or null to let the
 *  product search / keyword Q&A handle the message. */
function localFlow(raw: string): Msg | null {
  const t = raw.trim().toLowerCase();
  const hasSize = /\d{3}\s*[\/x]\s*\d{2}/.test(t);
  if (!hasSize && (t === MENU.size.toLowerCase() || t === "find by size" || t === "search by size")) {
    return { from: "bot", text: "Cool — what size do you need? 🔍 Type it like 205/55R16 (width / profile / rim). It's printed on your tyre's sidewall. Not sure? Tell me your car and I'll find it.", buttons: [MENU.vehicle, "I'm not sure of my size", MENU.human] };
  }
  if (!hasSize && (t === MENU.vehicle.toLowerCase() || t === "find by vehicle" || t === "by vehicle")) {
    return { from: "bot", text: "Sweet 🚗 — what do you drive? Give me the make, model & year, like “Toyota Hilux 2021” or “VW Polo 2018”, and I'll pull the right fitment and matching tyres.", buttons: [MENU.size, MENU.human] };
  }
  if (t === MENU.wheels.toLowerCase()) {
    return { from: "bot", text: "Nice — let's find mags! 🛞 Tell me your car (make, model & year, e.g. “Toyota Hilux 2021”) and I'll show wheels that fit its bolt pattern. Or tap to browse the whole range.", buttons: ["Show all mag wheels", MENU.size, MENU.human] };
  }
  if (/not sure.*size|don'?t know.*size|unsure.*size/.test(t)) {
    return { from: "bot", text: "No worries! Your size is on the tyre sidewall — a code like 205/55R16. Or just tell me your car (make, model, year) and I'll sort it. 🙂", buttons: [MENU.vehicle, MENU.human] };
  }
  if (t === MENU.info.toLowerCase() || /fitment.*delivery|delivery.*fitment/.test(t)) {
    return { from: "bot", text: "Here's the quick version 🚚🔧\n\n• Delivery: FREE nationwide on 2+ tyres (R200 for a single), about 1–4 working days.\n• Fitment: FREE at our Joburg partner centres (Supa Quick, HiQ, Dunlop Zone). Optional wheel alignment R450, balance & valve R100/tyre — we'll call to book your slot.", buttons: ["Payment & Happy Pay", "Warranties", "Returns", MENU.size] };
  }
  if (t === MENU.order.toLowerCase() || /track.*order|order status|where.*my order/.test(t)) {
    return { from: "bot", text: "Happy to help track your order 📦. Pop in your order number (it looks like TTM-12345) and I'll check — or I can connect you to the team to sort it fast.", buttons: [MENU.human] };
  }
  if (t === MENU.human.toLowerCase() || /talk to.*(human|someone|agent|sales|person)|speak to.*(human|someone|agent|sales|person)|real person|customer service/.test(t)) {
    return { from: "bot", text: "Of course — our team's ready to help 💬. WhatsApp or call 078 0088 788 (Mon–Fri 8:00–17:00, Sat 8:00–13:00), or email shop@thetyremall.co.za. Tap below to start a WhatsApp quote.", buttons: [WA_BUTTON, MENU.info] };
  }
  // Broad category words ("tyres", "wheels", "mags", "I need rims") with no
  // size / brand / vehicle — guide the user instead of the generic fallback.
  const cat = categoryIntent(t);
  if (cat === "tyre") {
    return {
      from: "bot",
      text: "Let's get you sorted! 🛞 To find the right tyres I just need one thing — your size or your car:\n\n• Type your size like 205/55R16 (it's printed on the sidewall), or\n• Tell me your car, e.g. “Toyota Hilux 2021”.\n\nAfter mags too? Just say “mags for my Hilux” and I'll pull those as well. 👍",
      buttons: [MENU.size, MENU.vehicle, MENU.wheels, MENU.human],
    };
  }
  if (cat === "wheel") {
    return {
      from: "bot",
      text: "Let's find you some mags! 🛞 Tell me your car — make, model & year, e.g. “Toyota Hilux 2021” — and I'll show wheels that fit its bolt pattern. Want matching tyres in the same go? Just say so and I'll sort both. 👍",
      buttons: [MENU.vehicle, MENU.size, MENU.human],
    };
  }
  return null;
}

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
  return "I'm not sure I caught that — tell me your car (make, model, year), your tyre size (like 205/55R16), or pick an option below. 🙂";
}

// ---- vehicle flow ----------------------------------------------------------
type FlowStep = "awaitingVehicle" | "awaitingModel" | "awaitingYear" | "awaitingTrim" | "awaitingSizeChoice";
interface Veh { step: FlowStep; make?: string; model?: string; year?: number; records?: VehicleRecord[]; record?: VehicleRecord }

const BROWSE_ALL = "🚗 Browse all vehicles";
const BROWSE_BOTH = "Browse all sizes";
const MAGS_FOR_CAR = "🛞 Mag wheels for this car";
const SESSION_KEY = "ttm-tyrone-veh";

const MAKE_ALIASES: Record<string, string> = {
  vw: "Volkswagen", vdub: "Volkswagen", "v-dub": "Volkswagen", merc: "Mercedes", benz: "Mercedes",
  "mercedes-benz": "Mercedes", chevy: "Chevrolet", beemer: "BMW", bimmer: "BMW",
  "range rover": "Land Rover", landrover: "Land Rover",
};

const wordInLow = (hay: string, needle: string) =>
  new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);

function findMake(t: string, makes: string[]): string | null {
  const low = t.toLowerCase();
  for (const [alias, real] of Object.entries(MAKE_ALIASES)) {
    if (wordInLow(low, alias) && makes.some((m) => m.toLowerCase() === real.toLowerCase())) return real;
  }
  for (const m of [...makes].sort((a, b) => b.length - a.length)) {
    if (wordInLow(low, m.toLowerCase())) return m;
  }
  return null;
}

function findModel(t: string, models: string[]): string | null {
  const low = t.toLowerCase();
  for (const m of [...models].sort((a, b) => b.length - a.length)) {
    if (m.length >= 2 && wordInLow(low, m.toLowerCase())) return m;
  }
  return null;
}

/** Scan every make's models for a distinctive model (e.g. "hilux") when no make
 *  was named. Returns the first strong hit. */
function findModelAnywhere(t: string, index: Record<string, string[]>): { make: string; model: string } | null {
  const low = t.toLowerCase();
  for (const make of Object.keys(index)) {
    for (const model of index[make]) {
      if (model.length >= 4 && wordInLow(low, model.toLowerCase())) return { make, model };
    }
  }
  return null;
}

/** Parse a free-text car into make/model/year using the live index. */
function parseVehicle(t: string, makes: string[], index: Record<string, string[]>): { make?: string; model?: string; year?: number } {
  const ym = t.match(/\b(19|20)\d{2}\b/);
  const year = ym ? Number(ym[0]) : undefined;
  let make = findMake(t, makes);
  let model = make ? findModel(t, index[make] ?? []) : null;
  if (!make) {
    const hit = findModelAnywhere(t, index);
    if (hit) { make = hit.make; model = hit.model; }
  }
  return { make: make ?? undefined, model: model ?? undefined, year };
}

/** True when the message is essentially JUST a tyre size (no brand/vehicle/other
 *  words) — so we confirm what was parsed before searching, catching mishears. */
function isBareSize(t: string): boolean {
  const residual = t.toLowerCase()
    .replace(/\d+/g, " ")
    .replace(/[\/x\-.,]/g, " ")
    .replace(/\b(zr|r|c|xl)\b/g, " ")
    .replace(/\b(tyre|tyres|tire|tires|size|sizes|for|a|an|my|the|some|please|pls|need|want|show|me|find|new|get|got|do|you|have|in|of|looking)\b/g, " ")
    .replace(/\s+/g, " ").trim();
  return residual.length === 0;
}

export function Tyrone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const { drawerOpen } = useCart(); // cart side-drawer — slide the dock clear of it
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"wheels" | null>(null); // wheel-context after tapping "Mag wheels"
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: GREETING, buttons: MAIN_MENU }]);
  const [typing, setTyping] = useState(false);
  // Vehicle flow state (persisted so a trip to /shop and back keeps the flow).
  const [veh, setVeh] = useState<Veh | null>(null);
  const makesRef = useRef<string[]>([]);
  const indexRef = useRef<Record<string, string[]>>({});
  const indexLoaded = useRef(false);
  // Typewriter reveal: `stream` is the bot message index currently being typed
  // out and how many characters are shown so far. Products/buttons for that
  // message hold back until the text finishes.
  const [stream, setStream] = useState<{ idx: number; n: number } | null>(null);
  const streamedRef = useRef(-1);
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

  // When a new bot message arrives (and the panel is open), type it out. The
  // greeting types on first open too. Honours reduced-motion by skipping it.
  useEffect(() => {
    if (!open) return;
    const idx = msgs.length - 1;
    if (idx < 0 || idx <= streamedRef.current) return;
    const m = msgs[idx];
    if (m.from !== "bot") return;
    streamedRef.current = idx;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (m.text && !reduce) setStream({ idx, n: 0 });
  }, [msgs, open]);

  // Advance the typewriter a few characters at a time.
  useEffect(() => {
    if (!stream) return;
    const full = msgs[stream.idx]?.text ?? "";
    if (stream.n >= full.length) { setStream(null); return; }
    const step = full.length > 150 ? 3 : 2;
    const id = window.setTimeout(() => {
      setStream((s) => (s ? { idx: s.idx, n: Math.min(full.length, s.n + step) } : null));
    }, 22);
    return () => window.clearTimeout(id);
  }, [stream, msgs]);

  // Load the make→models index once the chat opens (for free-text car parsing).
  async function loadIndex() {
    if (indexLoaded.current) return;
    indexLoaded.current = true;
    try {
      const d = await fetch("/api/vehicles?index=1").then((r) => r.json());
      makesRef.current = d.makes || [];
      indexRef.current = d.index || {};
    } catch { indexLoaded.current = false; }
  }
  useEffect(() => { if (open) loadIndex(); }, [open]);

  // Restore / persist the vehicle flow across navigations.
  useEffect(() => { try { const r = sessionStorage.getItem(SESSION_KEY); if (r) setVeh(JSON.parse(r)); } catch {} }, []);
  useEffect(() => {
    try { if (veh) sessionStorage.setItem(SESSION_KEY, JSON.stringify(veh)); else sessionStorage.removeItem(SESSION_KEY); } catch {}
  }, [veh]);

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

  function onButton(label: string) {
    // "Chat on WhatsApp" hands off to the existing WhatsApp quote panel.
    if (label === WA_BUTTON) { setOpen(false); setWaOpen(true); return; }
    send(label);
  }

  function botReply(msg: Msg, delay = 350) {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); setMsgs((m) => [...m, msg]); }, delay);
  }

  const HUMAN = MENU.human;
  const yearBtns = (years: number[]) => [...years.slice(0, 8).map(String), ...(years.length > 8 ? ["More years →"] : []), BROWSE_ALL, HUMAN];
  const trimLabel = (r: VehicleRecord) => `${r.trim || "Standard"}${r.generation ? ` · ${r.generation}` : ""}`;
  const rimLine = (r: VehicleRecord) =>
    r.rimOptions.length ? `\nRim ${r.rimOptions.join(" / ")}${r.pcd ? ` · PCD ${r.pcd.replace(/\*/g, "×")}` : " · bolt pattern to be verified"}` : "";

  async function fetchYears(make: string, model: string): Promise<number[]> {
    try { return (await fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`).then((r) => r.json())).years || []; } catch { return []; }
  }

  function startVehicleFlow() {
    loadIndex();
    setVeh({ step: "awaitingVehicle" });
    botReply({ from: "bot", text: "Sweet 🚗 — what do you drive? Give me the make, model & year, like “Toyota Hilux 2021” or “VW Polo 2018”. You can also browse the full list.", buttons: [BROWSE_ALL, HUMAN] });
  }

  async function startFromText(t: string) {
    await loadIndex();
    const { make, model, year } = parseVehicle(t, makesRef.current, indexRef.current);
    if (make && model && year) { await resolveRecords(make, model, year); return; }
    if (make && model) {
      const years = await fetchYears(make, model);
      setVeh({ step: "awaitingYear", make, model });
      botReply({ from: "bot", text: `A ${make} ${model} — nice! Which year?`, buttons: yearBtns(years) });
      return;
    }
    if (make) {
      const models = indexRef.current[make] || [];
      setVeh({ step: "awaitingModel", make });
      botReply({ from: "bot", text: `Which ${make} do you drive?`, buttons: [...models.slice(0, 8), ...(models.length > 8 ? ["See all models →"] : []), BROWSE_ALL, HUMAN] });
      return;
    }
    setVeh({ step: "awaitingVehicle" });
    botReply({ from: "bot", text: "I didn't catch your vehicle. Tell me the make, model & year — like “Toyota Hilux 2021” — or browse all vehicles.", buttons: [BROWSE_ALL, MENU.size, HUMAN] });
  }

  async function resolveRecords(make: string, model: string, year: number) {
    let records: VehicleRecord[] = [];
    try { records = (await fetch(`/api/vehicles?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${year}`).then((r) => r.json())).records || []; } catch {}
    if (!records.length) {
      const years = await fetchYears(make, model);
      setVeh({ step: "awaitingYear", make, model });
      botReply({ from: "bot", text: `I don't have ${year} for the ${make} ${model}.${years.length ? ` I do have: ${years.slice(0, 10).join(", ")}${years.length > 10 ? "…" : ""}. Which year?` : " Try browsing all vehicles."}`, buttons: yearBtns(years) });
      return;
    }
    if (records.length === 1) { showSizeChoice(records[0], make, model, year); return; }
    setVeh({ step: "awaitingTrim", make, model, year, records });
    botReply({ from: "bot", text: `Your ${year} ${make} ${model} comes in ${records.length} trims — which is yours?`, buttons: [...records.slice(0, 8).map(trimLabel), ...(records.length > 8 ? ["More trims →"] : []), HUMAN] });
  }

  function showSizeChoice(record: VehicleRecord, make: string, model: string, year: number) {
    setVeh({ step: "awaitingSizeChoice", make, model, year, record });
    const v = `${year} ${make} ${model}${record.trim ? ` ${record.trim}` : ""}`;
    if (record.tyreOptions.length <= 1) {
      const size = record.tyreOptions[0];
      if (!size) { botReply({ from: "bot", text: `I don't have a listed size for your ${v} yet — tap below and we'll confirm the fitment.`, buttons: [WA_BUTTON, HUMAN] }); setVeh(null); return; }
      const note = parseSize(size).nonStandard ? " (racing/competition size — matched as text)" : "";
      botReply({ from: "bot", text: `Your ${v} uses ${size}${note}. Confirm and I'll pull the tyres.${rimLine(record)}`, buttons: [`✅ Yes, show ${size}`, "Another size", HUMAN] });
    } else {
      const lines = record.tyreOptions.map((s, i) => `• ${s} — ${parseSize(s).nonStandard ? "racing/competition size — matched as text" : i === 0 ? "factory fitment" : "optional / plus size"}`).join("\n");
      botReply({ from: "bot", text: `Your ${v} came with ${record.tyreOptions.length} sizes:\n${lines}${rimLine(record)}\n\nWhich should I search?`, buttons: [...record.tyreOptions, BROWSE_BOTH, MAGS_FOR_CAR, HUMAN] });
    }
  }

  async function confirmSize(record: VehicleRecord, size: string, make: string, model: string, year: number) {
    const v = `${year} ${make} ${model}`;
    let total = 0; let products: TyroneProduct[] = [];
    try { const d = await fetch(`/api/tyrone?msg=${encodeURIComponent(size)}`).then((r) => r.json()); total = d.total ?? (d.products?.length ?? 0); products = d.products || []; } catch {}
    const links = [{ label: `See all ${size} tyres →`, href: sizeToShopHref(size, { type: "tyre", vehicle: v }) }];
    if (record.tyreOptions.length > 1) {
      links.push({ label: "Shop all sizes →", href: `/shop?${new URLSearchParams({ type: "tyre", sizes: record.tyreOptions.join("|"), vehicle: v }).toString()}` });
    }
    setVeh(null);
    botReply({ from: "bot", text: total ? `We've got ${total} ${total === 1 ? "tyre" : "tyres"} in ${size} for your ${v}. 👇` : `Here's ${size} for your ${v}:`, products, links, buttons: [HUMAN] }, 450);
  }

  /** Search a confirmed bare size and reply with real cards + a "see all" link. */
  async function searchSizeAndReply(size: string) {
    let data: { label?: string; note?: string; total?: number; products?: TyroneProduct[] } = {};
    try { data = await fetch(`/api/tyrone?msg=${encodeURIComponent(size)}`).then((r) => r.json()); } catch {}
    const products = data.products || [];
    const total = data.total ?? products.length;
    if (!products.length) {
      botReply({ from: "bot", text: `I couldn't find ${size} in stock right now — but we can special-order. Want me to connect you to the team? 🙂`, buttons: [WA_BUTTON, MENU.vehicle, HUMAN] }, 450);
      return;
    }
    botReply({
      from: "bot",
      text: `We've got ${total} ${total === 1 ? "tyre" : "tyres"} in ${size}. 👇`,
      products,
      links: [{ label: `See all ${size} tyres →`, href: sizeToShopHref(size, { type: "tyre" }) }],
      buttons: FOLLOWUPS,
    }, 450);
  }

  /** Mid-flow parser — runs before the generic intent table. Returns true when
   *  it handled the message (so send() stops), false to let normal handling run. */
  async function handleFlow(t: string): Promise<boolean> {
    if (!veh) return false;
    const low = t.toLowerCase();
    // escape hatches → drop the flow and let normal handling take over
    if (low === WA_BUTTON.toLowerCase() || low === HUMAN.toLowerCase() || (MAIN_MENU.some((l) => l.toLowerCase() === low) && low !== MENU.vehicle.toLowerCase())) { setVeh(null); return false; }
    if (low === BROWSE_ALL.toLowerCase() || t === "More years →" || t === "See all models →" || t === "More trims →") { setVeh(null); router.push("/vehicle-search"); return true; }

    const { step, make, model, year, records, record } = veh;

    if (step === "awaitingSizeChoice" && record && make && model && year != null) {
      if (t === BROWSE_BOTH) { setVeh(null); router.push(`/shop?${new URLSearchParams({ type: "tyre", sizes: record.tyreOptions.join("|"), vehicle: `${year} ${make} ${model}` }).toString()}`); return true; }
      if (t === MAGS_FOR_CAR) {
        const href = record.rimHrefs[0]?.href || "/shop?type=wheel";
        setVeh(null);
        botReply({ from: "bot", text: `Here are mags that fit your ${year} ${make} ${model}${record.pcd ? ` (PCD ${record.pcd.replace(/\*/g, "×")})` : ""}:`, links: [{ label: "See matching mag wheels →", href }], buttons: [HUMAN] });
        return true;
      }
      if (/^✅ yes, show /i.test(t)) { await confirmSize(record, record.tyreOptions[0], make, model, year); return true; }
      if (low === "another size") { setVeh(null); botReply({ from: "bot", text: "No worries — tell me your exact size (like 205/55R16), or browse all vehicles.", buttons: [MENU.size, BROWSE_ALL, HUMAN] }); return true; }
      const chosen = record.tyreOptions.find((s) => s.toLowerCase() === low || s.replace(/\s+/g, "").toLowerCase() === low.replace(/\s+/g, ""));
      if (chosen) { await confirmSize(record, chosen, make, model, year); return true; }
      botReply({ from: "bot", text: `Tap one of your sizes: ${record.tyreOptions.join(" or ")}.`, buttons: [...record.tyreOptions, BROWSE_BOTH, HUMAN] });
      return true;
    }

    if (step === "awaitingTrim" && records && make && model && year != null) {
      const chosen = records.find((r) => trimLabel(r).toLowerCase() === low) || records.find((r) => (r.trim || "").toLowerCase() === low);
      if (chosen) { showSizeChoice(chosen, make, model, year); return true; }
      botReply({ from: "bot", text: "Pick your trim from the list:", buttons: [...records.slice(0, 8).map(trimLabel), ...(records.length > 8 ? ["More trims →"] : []), HUMAN] });
      return true;
    }

    if (step === "awaitingYear" && make && model) {
      const ym = t.match(/\b(19|20)\d{2}\b/);
      if (ym) { await resolveRecords(make, model, Number(ym[0])); return true; }
      const years = await fetchYears(make, model);
      botReply({ from: "bot", text: `Which year is your ${make} ${model}?`, buttons: yearBtns(years) });
      return true;
    }

    if (step === "awaitingModel" && make) {
      const models = indexRef.current[make] || [];
      const chosen = findModel(t, models) || models.find((m) => m.toLowerCase() === low);
      if (chosen) {
        const ym = t.match(/\b(19|20)\d{2}\b/);
        if (ym) { await resolveRecords(make, chosen, Number(ym[0])); return true; }
        const years = await fetchYears(make, chosen);
        setVeh({ step: "awaitingYear", make, model: chosen });
        botReply({ from: "bot", text: `Great — a ${make} ${chosen}. Which year?`, buttons: yearBtns(years) });
        return true;
      }
      botReply({ from: "bot", text: `Which ${make} model? Pick one:`, buttons: [...models.slice(0, 8), ...(models.length > 8 ? ["See all models →"] : []), BROWSE_ALL, HUMAN] });
      return true;
    }

    if (step === "awaitingVehicle") { await startFromText(t); return true; }
    return false;
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setInput("");

    const low = t.toLowerCase();

    // ---- vehicle flow — runs BEFORE the generic intent table ----
    if (veh && (await handleFlow(t))) return;
    // entry: the "Find tyres by vehicle" button / phrasing
    if (low === MENU.vehicle.toLowerCase() || low === "find by vehicle" || low === "by vehicle" || low === "find tyres by vehicle") { startVehicleFlow(); return; }
    // entry: a recognised car in free text (not a bare tyre size)
    if (!/\d{3}\s*[\/x]\s*\d{2}/.test(t)) {
      await loadIndex();
      if (parseVehicle(t, makesRef.current, indexRef.current).make) { await startFromText(t); return; }
    }

    // ---- bare size: confirm what we parsed before searching (catches mishears) ----
    const confirmMatch = t.match(/^✅ show (.+)$/i);
    if (confirmMatch) { await searchSizeAndReply(confirmMatch[1].trim()); return; }
    if (low === "that's not right" || low === "thats not right") {
      botReply({ from: "bot", text: "No worries — type your size again (like 205/55R16), or tell me your car and I'll find the right fitment.", buttons: [MENU.vehicle, MENU.human] });
      return;
    }
    const bareSize = isBareSize(t) ? detectTyreSize(t) : null;
    if (bareSize) {
      const p = parseSize(bareSize);
      const parsed = p.width && p.rim ? `Width ${p.width}${p.profile ? ` · Profile ${p.profile}` : ""} · Rim ${p.rim}` : bareSize;
      botReply({ from: "bot", text: `Got it — I read that as ${parsed} (${bareSize}). Shall I show those tyres?`, buttons: [`✅ Show ${bareSize}`, "That's not right", HUMAN] });
      return;
    }

    // Track "mag wheels" context so a plain vehicle afterwards searches wheels.
    if (low === MENU.wheels.toLowerCase()) setMode("wheels");
    else if (MAIN_MENU.some((l) => l.toLowerCase() === low)) setMode(null);

    // Scripted menu flow (prompt or canned answer, no catalogue search)?
    const flow = localFlow(t);
    if (flow) {
      setTyping(true);
      window.setTimeout(() => { setTyping(false); setMsgs((m) => [...m, flow]); }, 350);
      return;
    }

    // If we're in wheel-context and the user gave a plain car/size (no wheel or
    // tyre word), bias the search toward wheels; then clear the context.
    const hasWheelOrTyreWord = /\b(mag|mags|wheel|wheels|rim|rims|alloy|alloys|tyre|tyres)\b/i.test(t);
    // Fix misheard/approx brand names so typed + voice both find products.
    const fixed = correctBrands(t);
    const query = mode === "wheels" && !hasWheelOrTyreWord ? `${fixed} mags` : fixed;
    if (mode === "wheels") setMode(null);

    setTyping(true);
    const started = Date.now();
    const fallbackText = matchRule(t);
    const isFallback = fallbackText.startsWith("I'm not sure I caught that");
    let reply: Msg = { from: "bot", text: fallbackText, buttons: isFallback ? [MENU.vehicle, MENU.size, MENU.human] : FOLLOWUPS };
    let firstProduct: TyroneProduct | undefined;
    try {
      const res = await fetch(`/api/tyrone?msg=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (Array.isArray(data.products) && data.products.length) {
        reply = { from: "bot", text: `${data.label}${data.note ? " — " + data.note : ""}:`, products: data.products, buttons: FOLLOWUPS };
        firstProduct = data.products[0];
      } else if (data.message) {
        reply = { from: "bot", text: data.message, buttons: [WA_BUTTON, MENU.size, MENU.human] };
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
      {/* launchers — WhatsApp bottom-LEFT, the AI Tyre Guy bottom-RIGHT */}
      {/* Each launcher is hidden only while ITS OWN panel is open, so the other
          stays visible to switch straight across. Only one chat open at a time
          (opening one closes the other). */}
      {!waOpen && (
        <button
          onClick={() => { setWaOpen(true); setOpen(false); }}
          className="fixed bottom-4 left-4 z-50 grid size-12 place-items-center rounded-full bg-[#25D366] text-black shadow-xl shadow-black/40 ring-1 ring-black/10 transition-transform hover:scale-105"
          aria-label="WhatsApp / get a quote"
        >
          <WhatsApp width={26} height={26} />
        </button>
      )}
      {!open && (
        <button
          onClick={() => { setOpen(true); setWaOpen(false); }}
          className={`btn-chrome fixed bottom-4 z-50 flex items-center gap-2 rounded-full py-2 pl-2 pr-4 shadow-xl shadow-black/40 transition-all duration-300 hover:scale-105 ${drawerOpen ? "right-4 max-sm:hidden sm:right-[calc(28rem+1rem)]" : "right-4"}`}
          aria-label="Let the AI Tyre Guy help you"
        >
          <span className="relative grid size-8 place-items-center rounded-full bg-ink text-volt">
            <Avatar />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-pay" />
          </span>
          <span className="text-sm font-extrabold">Let the AI Tyre Guy help you</span>
        </button>
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
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.from === "user"
                      ? "rounded-br-sm bg-volt text-volt-ink"
                      : "rounded-bl-sm bg-surface text-fg"
                  }`}
                >
                  {stream && stream.idx === i ? (
                    <>{m.text.slice(0, stream.n)}<span className="tyrone-caret" /></>
                  ) : (
                    m.text
                  )}
                </div>
                {m.products && m.products.length > 0 && !(stream && stream.idx === i) && (
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
                {m.from === "bot" && m.links && m.links.length > 0 && !(stream && stream.idx === i) && (
                  <div className="mt-2 flex w-full flex-col gap-2">
                    {m.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="btn btn-volt h-10 w-full justify-center px-4 text-xs"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
                {m.from === "bot" && m.buttons && m.buttons.length > 0 && i === msgs.length - 1 && !typing && !(stream && stream.idx === i) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.buttons.map((b) => (
                      <button
                        key={b}
                        onClick={() => onButton(b)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-volt hover:text-volt"
                      >
                        {b}
                      </button>
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
              notePlacement="top"
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
