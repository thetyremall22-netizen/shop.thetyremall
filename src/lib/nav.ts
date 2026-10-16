// Client-safe navigation data (only the small categories.json is imported here).
import categoriesData from "@/data/categories.json";
import type { Category } from "./types";

export const allCategories = categoriesData as unknown as Category[];

export const NAV_PRIMARY: { label: string; slug: string }[] = [
  { label: "Passenger", slug: "passenger-tyres" },
  { label: "SUV", slug: "suv-tyres" },
  { label: "4×4", slug: "4x4-tyres" },
  { label: "UHP", slug: "uhp-tyres" },
  { label: "Commercial", slug: "commercial-tyres" },
  { label: "Truck & Bus", slug: "truck-bus-tyres" },
  { label: "Runflat", slug: "runflat-tyres" },
  { label: "Mag Wheels", slug: "wheel-rims" },
  { label: "Bike", slug: "bike-tyres" },
];

export const PROMOS: string[] = [
  "FREE NATIONWIDE DELIVERY ON 2 OR MORE TYRES",
  "BUY NOW, PAY LATER — 0% INTEREST WITH HAPPYPAY",
  "SA'S LARGEST ONLINE TYRE RANGE — 7000+ TYRES IN STOCK",
  "OPTIONAL FITMENT AT JOHANNESBURG PARTNER CENTRES",
];
