// Order attribution ("where did this sale come from?"), like WooCommerce's.
// The browser records the visit's source; the server classifies it when it's
// shown, so improvements to the rules below apply to past orders too.
// No "server-only": the browser tracker uses the types and limits.

export interface Touch {
  at: number;            // when this visit started (ms)
  referrer: string;      // full referring URL ("" for typed-in / app)
  landing: string;       // first page of the visit, path + query
  utm: Partial<Record<"source" | "medium" | "campaign" | "term" | "content" | "id", string>>;
  clickIds: Partial<Record<"gclid" | "gbraid" | "wbraid" | "msclkid" | "fbclid" | "ttclid" | "srsltid", string>>;
}

export interface Attribution {
  /** The visit the sale is credited to (last non-direct visit, like WooCommerce). */
  touch: Touch;
  /** The very first visit we know of from this browser. */
  first?: Touch;
  sessionPages: number;  // pages viewed in the buying session
  visits: number;        // number of visits from this browser
  device?: string;       // Mobile / Tablet / Desktop (set by the server)
  staff?: boolean;       // placed while logged in to the admin
  tyrone?: string;       // Tyrone conversation id, if they chatted to Tyrone first
}

export const UTM_KEYS = ["source", "medium", "campaign", "term", "content", "id"] as const;
export const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "ttclid", "srsltid"] as const;

const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"], [/(^|\.)bing\.com$/, "Bing"], [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"], [/(^|\.)ecosia\.org$/, "Ecosia"], [/^search\.brave\.com$/, "Brave Search"],
  [/(^|\.)yandex\./, "Yandex"], [/(^|\.)baidu\.com$/, "Baidu"], [/(^|\.)startpage\.com$/, "Startpage"],
  [/(^|\.)ask\.com$/, "Ask"], [/(^|\.)aol\.com$/, "AOL"], [/(^|\.)qwant\.com$/, "Qwant"],
];
const AI: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|^chat\.openai\.com$/, "ChatGPT"], [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "Gemini"], [/^copilot\.microsoft\.com$|(^|\.)copilot\.cloud\.microsoft$/, "Microsoft Copilot"],
  [/(^|\.)claude\.ai$/, "Claude"], [/(^|\.)you\.com$/, "You.com"], [/(^|\.)poe\.com$/, "Poe"], [/(^|\.)meta\.ai$/, "Meta AI"],
  [/(^|\.)grok\.com$|^x\.ai$/, "Grok"], [/(^|\.)deepseek\.com$/, "DeepSeek"], [/(^|\.)mistral\.ai$/, "Mistral"],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|^fb\.me$|(^|\.)fb\.com$/, "Facebook"], [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)tiktok\.com$/, "TikTok"], [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"], [/^t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X (Twitter)"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"], [/(^|\.)pinterest\./, "Pinterest"], [/(^|\.)whatsapp\.com$|^wa\.me$/, "WhatsApp"],
  [/(^|\.)reddit\.com$/, "Reddit"], [/(^|\.)snapchat\.com$/, "Snapchat"],
];
// AI assistants sometimes tag their links instead of sending a referrer.
const AI_UTM: [RegExp, string][] = [[/chatgpt|openai/i, "ChatGPT"], [/perplexity/i, "Perplexity"], [/gemini/i, "Gemini"], [/copilot/i, "Microsoft Copilot"], [/claude/i, "Claude"]];

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
const match = (host: string, list: [RegExp, string][]) => list.find(([re]) => re.test(host))?.[1];

export type OriginType = "Paid ads" | "Organic search" | "AI assistant" | "Social" | "Email" | "Referral" | "Campaign" | "Direct";
export interface Origin { type: OriginType; source: string; label: string; medium?: string }

const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid_search|paid-social|paidsocial|cpm|display|ads?)$/i;

function classifyTouch(a: Attribution | null | undefined, ownHost: string): Origin {
  if (!a) return { type: "Direct", source: "Unknown", label: "Unknown (order placed before tracking)" };
  const t = a.touch;
  const host = hostOf(t.referrer);
  const internal = !host || host === ownHost || host.endsWith(`.${ownHost}`) || host === "localhost" || host === "127.0.0.1";
  const refSearch = host ? match(host, SEARCH) : undefined;

  // Paid clicks (ad click IDs) win.
  if (t.clickIds.gclid || t.clickIds.gbraid || t.clickIds.wbraid) return { type: "Paid ads", source: "Google Ads", label: "Google Ads", medium: "cpc" };
  if (t.clickIds.msclkid) return { type: "Paid ads", source: "Microsoft Ads", label: "Microsoft (Bing) Ads", medium: "cpc" };
  // Tagged links (utm_…).
  const us = t.utm.source?.trim();
  if (us) {
    const ai = match(us, AI_UTM);
    if (ai) return { type: "AI assistant", source: ai, label: `AI assistant: ${ai}` };
    const medium = t.utm.medium?.trim() || "";
    if (PAID_MEDIUM.test(medium)) return { type: "Paid ads", source: us, label: `Paid ads: ${us}${t.utm.campaign ? ` (${t.utm.campaign})` : ""}`, medium };
    if (/e-?mail|newsletter/i.test(medium) || /recovery|newsletter|mailchimp|klaviyo/i.test(us)) return { type: "Email", source: us, label: `Email: ${us}${t.utm.campaign ? ` (${t.utm.campaign})` : ""}`, medium };
    if (/social/i.test(medium)) return { type: "Social", source: us, label: `Social: ${us}`, medium };
    return { type: "Campaign", source: us, label: `Campaign: ${us}${medium ? ` / ${medium}` : ""}${t.utm.campaign ? ` (${t.utm.campaign})` : ""}`, medium };
  }
  if (t.clickIds.fbclid) return { type: "Social", source: "Facebook", label: "Social: Facebook / Instagram" };
  if (t.clickIds.ttclid) return { type: "Paid ads", source: "TikTok Ads", label: "TikTok Ads" };
  if (!internal) {
    const ai = match(host, AI);
    if (ai) return { type: "AI assistant", source: ai, label: `AI assistant: ${ai}` };
    if (refSearch) return { type: "Organic search", source: refSearch, label: `Organic search: ${refSearch}` };
    const social = match(host, SOCIAL);
    if (social) return { type: "Social", source: social, label: `Social: ${social}` };
    if (/mail\.|outlook\.|webmail/.test(host)) return { type: "Email", source: host, label: `Email (${host})` };
    return { type: "Referral", source: host, label: `Referral: ${host}` };
  }
  // Google Shopping / free listings add srsltid without a referrer.
  if (t.clickIds.srsltid) return { type: "Organic search", source: "Google", label: "Organic search: Google (Shopping / free listing)" };
  return { type: "Direct", source: "Direct", label: "Direct (typed in, bookmark or app)" };
}

/** "Google Ads", "Organic search: Google", "AI assistant: ChatGPT", "Referral: example.co.za", "Direct"…
 *  Orders placed by logged-in staff keep their real source, with a note. */
export function classifyOrigin(a: Attribution | null | undefined, ownHost = "thetyremall.co.za"): Origin {
  const o = classifyTouch(a, ownHost);
  return a?.staff ? { ...o, label: `${o.label} — placed by staff (logged in to the admin)` } : o;
}

/** Rough device type from the browser's user-agent text. */
export function deviceFromUA(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "Tablet";
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return "Mobile";
  return ua ? "Desktop" : "Unknown";
}

/** Clean what the browser sent (it's untrusted): known keys only, short strings. */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
  const touch = (v: unknown): Touch | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const utmIn = (o.utm && typeof o.utm === "object" ? o.utm : {}) as Record<string, unknown>;
    const idsIn = (o.clickIds && typeof o.clickIds === "object" ? o.clickIds : {}) as Record<string, unknown>;
    const utm: Touch["utm"] = {};
    for (const k of UTM_KEYS) { const s = str(utmIn[k], 150); if (s) utm[k] = s; }
    const clickIds: Touch["clickIds"] = {};
    for (const k of CLICK_KEYS) { const s = str(idsIn[k], 200); if (s) clickIds[k] = s; }
    return { at: Number(o.at) || 0, referrer: str(o.referrer, 500), landing: str(o.landing, 500), utm, clickIds };
  };
  const t = touch(r.touch);
  if (!t) return null;
  const first = touch(r.first) ?? undefined;
  const tyrone = typeof r.tyrone === "string" && /^[a-z0-9-]{8,64}$/i.test(r.tyrone) ? r.tyrone : undefined;
  return {
    touch: t, first, ...(tyrone ? { tyrone } : {}),
    sessionPages: Math.max(0, Math.min(10_000, Math.floor(Number(r.sessionPages) || 0))),
    visits: Math.max(0, Math.min(100_000, Math.floor(Number(r.visits) || 0))),
  };
}
