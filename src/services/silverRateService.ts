/**
 * Client-side helper for /api/silver-rate.
 *
 * - Reads from localStorage immediately for first paint (no flash).
 * - Fetches fresh data on demand, caches with a 10 min TTL.
 * - Dispatches a 'silver-rate-updated' window event after every successful
 *   fetch so multiple widget instances sync without prop-drilling.
 */

export type SilverRate = {
  pricePerGramInr: number;
  pricePer10gInr: number;
  pricePerKgInr: number;
  change24hPct: number | null;
  source: 'live' | 'manual' | 'fallback';
  fetchedAt: string;
  usdPerOz?: number;
  usdToInr?: number;
};

const CACHE_KEY = 'silverRate.cache.v3';
const CACHE_TTL_MS = 10 * 60 * 1000;
const EVENT_NAME = 'silver-rate-updated';

type CacheEnvelope = { rate: SilverRate; cachedAt: number };

function readCache(): CacheEnvelope | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope;
    if (!parsed || typeof parsed.cachedAt !== 'number' || !parsed.rate) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rate: SilverRate) {
  if (typeof window === 'undefined') return;
  try {
    const env: CacheEnvelope = { rate, cachedAt: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(env));
  } catch {
    /* ignore quota errors */
  }
}

export function getCachedSilverRate(): SilverRate | null {
  return readCache()?.rate ?? null;
}

const GRAMS_PER_TROY_OUNCE = 31.1034768;
// India import duty factor (BCD 6% + AIDC 5% + SWS 0.6% + GST 3% ≈ 15.3%)
// aligns international spot with MCX / Indian domestic wholesale rates.
const INDIA_DUTY_MULTIPLIER = 1.153;

/** Direct browser fetch from public APIs — used as fallback when the Vercel
 *  /api/silver-rate endpoint is unavailable (e.g. local vite dev). */
async function fetchDirectly(): Promise<SilverRate> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const [silverRes, fxRes] = await Promise.allSettled([
      fetch('https://api.gold-api.com/price/XAG', { signal: ctrl.signal }),
      fetch('https://open.er-api.com/v6/latest/USD', { signal: ctrl.signal }),
    ]);

    let usdPerOz: number | null = null;
    let prevCloseUsd: number | null = null;
    let usdToInr: number | null = null;

    if (silverRes.status === 'fulfilled' && silverRes.value.ok) {
      const d = await silverRes.value.json();
      if (typeof d?.price === 'number') usdPerOz = d.price;
      if (typeof d?.prev_close_price === 'number') prevCloseUsd = d.prev_close_price;
    }
    if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
      const d = await fxRes.value.json();
      if (typeof d?.rates?.INR === 'number') usdToInr = d.rates.INR;
    }

    if (usdPerOz && usdToInr) {
      const pricePerGramInr = (usdPerOz * usdToInr * INDIA_DUTY_MULTIPLIER) / GRAMS_PER_TROY_OUNCE;
      const change24hPct =
        prevCloseUsd && prevCloseUsd > 0
          ? ((usdPerOz - prevCloseUsd) / prevCloseUsd) * 100
          : null;
      return {
        pricePerGramInr,
        pricePer10gInr: pricePerGramInr * 10,
        pricePerKgInr: pricePerGramInr * 1000,
        change24hPct,
        source: 'live',
        fetchedAt: new Date().toISOString(),
        usdPerOz,
        usdToInr,
      };
    }
  } finally {
    clearTimeout(timer);
  }
  throw new Error('Direct silver rate fetch failed');
}

export async function fetchSilverRate(force = false): Promise<SilverRate> {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  let rate: SilverRate | null = null;

  // 1. Try Vercel serverless endpoint (works in production)
  try {
    const resp = await fetch('/api/silver-rate', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    rate = (await resp.json()) as SilverRate;
  } catch {
    // 2. Vercel endpoint unavailable (local dev) — fetch public APIs directly
    try {
      rate = await fetchDirectly();
    } catch {
      /* both paths failed */
    }
  }

  if (rate) {
    writeCache(rate);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: rate }));
    }
    return rate;
  }

  // 3. Return stale cache if available
  if (cached) return cached.rate;

  // 4. Hard fallback so the widget never crashes
  const fallback: SilverRate = {
    pricePerGramInr: 95,
    pricePer10gInr: 950,
    pricePerKgInr: 95000,
    change24hPct: null,
    source: 'fallback',
    fetchedAt: new Date().toISOString(),
  };
  return fallback;
}

export function subscribeSilverRate(handler: (rate: SilverRate) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const listener = (e: Event) => {
    const rate = (e as CustomEvent<SilverRate>).detail;
    if (rate) handler(rate);
  };
  window.addEventListener(EVENT_NAME, listener as EventListener);
  return () => window.removeEventListener(EVENT_NAME, listener as EventListener);
}
