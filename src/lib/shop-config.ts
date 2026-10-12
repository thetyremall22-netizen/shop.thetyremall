/**
 * Store rules & options — mirrors The Tyre Mall's WooCommerce product add-on form.
 */

/** Free nationwide delivery once this many tyres are in the cart. */
export const FREE_DELIVERY_MIN_TYRES = 2;

/** Flat courier fee (minor units, ZAR) for a single-tyre delivery. */
export const STANDARD_DELIVERY_FEE = 20000; // R200,00 (1 tyre only)

/** Wheel alignment add-on (minor units). */
export const ALIGNMENT_FEE = 45000; // R450,00

/** Balance & valve, per tyre (minor units). */
export const BALANCE_PER_TYRE = 10000; // R100,00 per tyre

/** Optional road-hazard cover (kept for compatibility). */
export const ROAD_HAZARD_FEE = 9900; // R99,00 per tyre

/** HappyPay sign-up / credit-check URL. */
export const HAPPYPAY_URL = "https://happypay.co.za";

/** Contact — WhatsApp (international format) and phone. */
export const SHOP_EMAIL = "shop@thetyremall.co.za";
export const SHOP_PHONE_DISPLAY = "078 0088 788";
export const SHOP_PHONE_TEL = "0780088788";
export const WHATSAPP_PHONE = "27780088788"; // +27 78 008 8788
export const WHATSAPP_LINK = "https://wa.link/k33vfb";
export function whatsappHref(text: string): string {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
}

export interface FitmentStore {
  id: string;
  name: string;
  area: string;
  address: string;
  phone: string;      // display
  phoneTel: string;   // digits for tel:
}

/** Real fitment partners (from The Tyre Mall's store list). */
export const FITMENT_STORES: FitmentStore[] = [
  { id: "supaquick-cresta", name: "Supa Quick Cresta", area: "Randburg", address: "Cnr Pendoring Rd & Beyers Naude Dr, Shop 1 & 2, Blackheath Pavilion, Randburg, 2195", phone: "011 431 3942", phoneTel: "0114313942" },
  { id: "supaquick-selby", name: "Supa Quick Selby", area: "Selby", address: "4 Trump Street, Selby, Johannesburg, 2001", phone: "011 493 7344", phoneTel: "0114937344" },
  { id: "dunlopzone-boksburg", name: "Dunlop Zone Boksburg", area: "Boksburg", address: "146 North Rand Rd, Bardene, Boksburg, 1459", phone: "011 026 0144", phoneTel: "0110260144" },
  { id: "dunlopzone-midrand", name: "Dunlop Zone Midrand", area: "Midrand", address: "Shop 5, Midrand Motor City, 139 Old Pretoria Rd, Halfway House Estate, Midrand, 1685", phone: "011 315 3043", phoneTel: "0113153043" },
  { id: "hiq-booysens", name: "Hi-Q Booysens", area: "Booysens", address: "65 Booysens Road, Booysens, Johannesburg, 2091", phone: "011 493 0308", phoneTel: "0114930308" },
  { id: "hiq-jhb-city", name: "Hi-Q Johannesburg City", area: "Johannesburg", address: "198 Marshall Street, City and Suburban, Johannesburg, 2094", phone: "011 334 4000", phoneTel: "0113344000" },
];

/** Back-compat alias for older imports. */
export const FITMENT_CENTRES = FITMENT_STORES.map((s) => ({
  id: s.id,
  name: s.name,
  area: s.area,
  address: s.address,
}));

export const FITMENT_FEE_PER_TYRE = 0; // store fitment is free at partner stores

export type DeliveryMethod = "delivery" | "fitment";

export interface PaymentMethod {
  id: string;
  name: string;
  tag: string;
  blurb: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "payfast", name: "PayFast", tag: "Card / Instant EFT", blurb: "Secure card & instant EFT payments." },
  { id: "happypay", name: "HappyPay", tag: "Pay over 2 months", blurb: "0% interest, no upfront. Instant credit check." },
  { id: "mobicred", name: "Mobicred", tag: "Buy now, pay later", blurb: "Revolving credit facility for online shopping." },
];
