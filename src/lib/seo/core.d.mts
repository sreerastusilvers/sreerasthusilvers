export const SITE_URL: string;
export const SITE_NAME: string;
export const DEFAULT_IMAGE: string;
export const LOGO_URL: string;
export const BUSINESS: Record<string, unknown>;
export const STATIC_PAGES: Record<string, { title: string; description: string; h1: string }>;
export const NOINDEX_PREFIXES: string[];

export type JsonLd = Record<string, unknown>;

export function clip(text: string, max: number): string;
export function absoluteUrl(path: string): string;
export function brandTitle(text: string): string;
export function formatInr(n: number): string;
export function storeJsonLd(): JsonLd;
export function websiteJsonLd(): JsonLd;
export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd;
export function isNoindexPath(pathname: string): boolean;
export function categorySeo(
  slug: string,
  name: string,
): { title: string; description: string; canonical: string; h1: string; jsonLd: JsonLd[] };
export function productSeo(
  p: any,
  extra?: {
    categoryPath?: string;
    categoryName?: string;
    rating?: { average: number; count: number } | null;
  },
): {
  title: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  h1: string;
  about: string;
  price: number | null;
  inStock: boolean;
  images: string[];
  jsonLd: JsonLd[];
};
export function productCategory(
  p: any,
  categories: { slug: string; name: string }[],
): { path: string; name: string } | null;
