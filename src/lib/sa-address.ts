// We only deliver within South Africa: a delivery address needs one of the nine
// provinces and a 4-digit SA postal code. Shared by checkout (browser) and the
// checkout API (server). No "server-only" on purpose.

export const SA_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
] as const;

const ALIASES: Record<string, string> = {
  ec: "Eastern Cape", "eastern cape": "Eastern Cape", "e cape": "Eastern Cape",
  fs: "Free State", "free state": "Free State", ofs: "Free State",
  gp: "Gauteng", gauteng: "Gauteng", gt: "Gauteng", jhb: "Gauteng", johannesburg: "Gauteng", pretoria: "Gauteng",
  kzn: "KwaZulu-Natal", "kwazulu-natal": "KwaZulu-Natal", "kwazulu natal": "KwaZulu-Natal", kwazulunatal: "KwaZulu-Natal", natal: "KwaZulu-Natal",
  lp: "Limpopo", limpopo: "Limpopo", np: "Limpopo",
  mp: "Mpumalanga", mpumalanga: "Mpumalanga",
  nw: "North West", "north west": "North West", "north-west": "North West", northwest: "North West",
  nc: "Northern Cape", "northern cape": "Northern Cape", "n cape": "Northern Cape",
  wc: "Western Cape", "western cape": "Western Cape", "w cape": "Western Cape", "cape town": "Western Cape",
};

/** The SA province name for what was typed/chosen, or null if it isn't one. */
export function saProvince(raw: string | undefined | null): string | null {
  const k = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  if (!k) return null;
  return ALIASES[k] ?? SA_PROVINCES.find((p) => p.toLowerCase() === k) ?? null;
}

export const isSaPostalCode = (raw: string | undefined | null) => /^\d{4}$/.test((raw ?? "").trim());

export const SA_DELIVERY_ERROR = "We only deliver within South Africa — please enter a South African delivery address (choose the province and use a 4-digit postal code).";
