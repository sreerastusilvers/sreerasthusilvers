import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Product } from './productService';

/**
 * Session-scoped cache for the public product catalog.
 *
 * Before this, every storefront surface (each category page, each home section,
 * search, mobile grid) opened its own unbounded `onSnapshot` over the whole
 * products collection. With ~350 active products a single category page view
 * cost ~1000 document reads and held listeners open. The free tier is 50k
 * reads/day, so roughly 47 page views exhausted it.
 *
 * A storefront catalog does not need to be realtime - a shopper does not care
 * that a new bangle appeared without a refresh. So we read once, share the
 * result across every consumer, and re-read only after TTL or an admin write.
 *
 * Admin screens deliberately bypass this and keep using getAllProducts().
 */

const PRODUCTS_COLLECTION = 'products';
const TTL_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'ss:catalog:v1';
/** Above this, skip sessionStorage rather than risk a QuotaExceededError. */
const MAX_PERSIST_BYTES = 2_000_000;

type CacheEntry = { data: Product[]; at: number };

let memory: CacheEntry | null = null;
/** Dedupes concurrent callers so a page with 5 sections issues 1 query, not 5. */
let inFlight: Promise<Product[]> | null = null;

const isFresh = (entry: CacheEntry | null): entry is CacheEntry =>
  !!entry && Date.now() - entry.at < TTL_MS;

const readPersisted = (): CacheEntry | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    return isFresh(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const persist = (entry: CacheEntry) => {
  try {
    const serialized = JSON.stringify(entry);
    if (serialized.length > MAX_PERSIST_BYTES) return;
    sessionStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Private mode or quota exceeded - memory cache still applies.
  }
};

const fetchActiveProducts = async (): Promise<Product[]> => {
  const snapshot = await getDocs(
    query(collection(db, PRODUCTS_COLLECTION), where('flags.isActive', '==', true)),
  );

  const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);

  products.sort((a, b) => {
    const aTime = a.createdAt as any;
    const bTime = b.createdAt as any;
    if (!aTime || !bTime) return 0;
    return bTime.seconds - aTime.seconds;
  });

  return products;
};

/** All active products, from cache when possible. */
export const getActiveProductsCached = async (): Promise<Product[]> => {
  if (isFresh(memory)) return memory.data;

  const persisted = readPersisted();
  if (persisted) {
    memory = persisted;
    return persisted.data;
  }

  if (inFlight) return inFlight;

  inFlight = fetchActiveProducts()
    .then((data) => {
      const entry = { data, at: Date.now() };
      memory = entry;
      persist(entry);
      return data;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
};

/**
 * Drop-in replacement for the old `subscribeToProducts(cb, true)`.
 *
 * Keeps the unsubscribe-function shape so `useEffect` call sites work unchanged,
 * but resolves from cache and never opens a Firestore listener. The returned
 * function cancels delivery to a unmounted component.
 */
export const subscribeToActiveProducts = (callback: (products: Product[]) => void) => {
  let cancelled = false;

  getActiveProductsCached()
    .then((products) => {
      if (!cancelled) callback(products);
    })
    .catch((error) => {
      console.error('[productCache] catalog load failed:', error);
      if (!cancelled) callback([]);
    });

  return () => {
    cancelled = true;
  };
};

/**
 * Cache-backed replacement for `subscribeToProductsBySubcategory`. Filtering the
 * shared catalog in memory costs zero reads; the old version opened a separate
 * listener per subcategory page (59 of them across the app).
 */
export const subscribeToActiveProductsBySubcategory = (
  subcategory: string,
  callback: (products: Product[]) => void,
) => {
  const target = subcategory.toLowerCase();
  return subscribeToActiveProducts((products) =>
    callback(products.filter((p) => (p.subcategory || '').toLowerCase() === target)),
  );
};

type SectionFlag = 'isBestSeller' | 'isTopDeal' | 'isFeatured' | 'isNewArrival' | 'isTrendProduct';

/**
 * Cache-backed replacement for the home-page section listeners
 * (best sellers / top deals / featured / new arrivals / trends). The home page
 * ran five separate queries; now all five read the one cached catalog.
 */
export const subscribeToActiveProductsByFlag = (
  flag: SectionFlag,
  callback: (products: Product[]) => void,
  limitCount = 10,
) =>
  subscribeToActiveProducts((products) =>
    callback(products.filter((p) => p.flags?.[flag] === true).slice(0, limitCount)),
  );

/** Call after any admin write so the next read reflects it immediately. */
export const invalidateProductCache = () => {
  memory = null;
  inFlight = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
