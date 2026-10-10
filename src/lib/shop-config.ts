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

export interface FitmentStore {
  id: string;
  name: string;
  area: string;
}

/** Real Johannesburg fitment partners (from The Tyre Mall's live form). */
export const FITMENT_STORES: FitmentStore[] = [
  { id: "supaquick-selby", name: "Supa Quick Selby", area: "Selby" },
  { id: "supaquick-cresta", name: "Supa Quick Cresta", area: "Cresta" },
  { id: "hiq-booysens", name: "HiQ Booysens", area: "Booysens" },
  { id: "dunlopzone-boksburg", name: "Dunlop Zone Boksburg", area: "Boksburg" },
  { id: "dunlopzone-midrand", name: "Dunlop Zone Midrand", area: "Midrand" },
];

/** Back-compat alias for older imports. */
export const FITMENT_CENTRES = FITMENT_STORES.map((s) => ({
  id: s.id,
  name: s.name,
  area: s.area,
  address: `${s.name}, ${s.area}, Johannesburg`,
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
