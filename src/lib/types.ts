export type ProductType = "tyre" | "wheel" | "other";

export interface TyreSpecs {
  width?: string;
  profile?: string;
  rim?: string;
  size?: string;
  pcd?: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  sku: string;
  brand: string;
  type: ProductType;
  /** price in minor units (cents, ZAR) */
  price: number;
  regularPrice: number;
  salePrice: number;
  onSale: boolean;
  image: string | null;
  thumb: string | null;
  shortDescription: string;
  description: string;
  categories: string[];
  specs: TyreSpecs;
  inStock: boolean;
  stockQty: number | null;
  rating: number;
  reviews: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  count: number;
  image: string | null;
  primary: boolean;
}

export interface CatalogueMeta {
  productCount: number;
  brands: { name: string; count: number }[];
  widths: string[];
  profiles: string[];
  rims: string[];
  wheelRims: string[];
  wheelWidths: string[];
  wheelBrands: string[];
  pcds: string[];
  generatedAt: string;
}
