/**
 * Vercel serverless function — live silver spot price (INR per gram / 10g / kg).
 *
 * Endpoint: GET /api/silver-rate
 *
 * Public, no auth. Edge-cached for 10 minutes (s-maxage=600,
 * stale-while-revalidate=86400) so the upstream free APIs aren't hammered.
 *
 * Pipeline:
 *   1. Optional admin manual override at Firestore siteSettings/silverRate.
 *      If `manualOverride === true` and a positive `manualPricePerGramInr`
 *      is set, return that value and short-circuit the network calls.
 *   2. Fetch silver spot in USD/oz from gold-api.com (keyless, public).
 *   3. Fetch USD->INR FX from open.er-api.com (keyless, public).
 *   4. Convert: INR/g = (USD/oz * USD->INR) / 31.1034768.
 *
 * Response shape (always returned, even on partial failure):
 *   {
 *     pricePerGramInr: number,
 *     pricePer10gInr:  number,
 *     pricePerKgInr:   number,
 *     change24hPct:    number | null,
 *     source:          'live' | 'manual' | 'fallback',
 *     fetchedAt:       string (ISO),
 *     usdPerOz?:       number,
 *     usdToInr?:       number,
 *   }
 *
 * If both upstreams fail and there's no manual override, returns a hardcoded
 * fallback (₹95/g) with `source: 'fallback'` so the UI never crashes.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const FALLBACK_INR_PER_GRAM = 265;

/**
 * India-specific duty & tax multiplier applied on top of the international
 * USD spot price so the displayed rate aligns with MCX / Indian wholesale.
 *
 * Components (approx):
 *   Basic Customs Duty (BCD)         : 6%
 *   Agri Infra Dev Cess (AIDC)       : 5%
 *   Social Welfare Surcharge (SWS)   : 10% on BCD ≈ 0.6%
 *   GST                              : 3%
 *   ─────────────────────────────────────────────────
 *   Compound factor                  : ~1.153
 *
 * International spot × this factor ≈ MCX / Indian domestic wholesale price.
 * City-level retail (e.g. AP / Kakinada) adds another 2-5% over MCX.
 */
const INDIA_DUTY_MULTIPLIER = 1.153;

type SilverRatePayload = {
  pricePerGramInr: number;
  pricePer10gInr: number;
  pricePerKgInr: number;
  change24hPct: number | null;
  source: 'live' | 'manual' | 'fallback';
  fetchedAt: string;
  usdPerOz?: number;
  usdToInr?: number;
};

function setHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Cache aggressively at the edge; clients should still re-fetch on focus.
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400');
}

function tryInitAdmin(): admin.app.App | null {
  try {
    if (admin.apps.length) return admin.app();
    const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
    if (!b64) return null;
    const svc = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return admin.initializeApp({ credential: admin.credential.cert(svc) });
  } catch {
    return null;
  }
}

async function readManualOverride(): Promise<{ pricePerGramInr: number } | null> {
  const app = tryInitAdmin();
  if (!app) return null;
  try {
    const snap = await app.firestore().collection('siteSettings').doc('silverRate').get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const enabled = data.manualOverride === true;
    const price = Number(data.manualPricePerGramInr);
    if (enabled && Number.isFinite(price) && price > 0) {
      return { pricePerGramInr: price };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(url: string, ms: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSilverUsdPerOz(): Promise<{ price: number; change24hPct: number | null }> {
  // gold-api.com is keyless, returns: { price, prev_close_price, ... }
  const data = (await fetchJsonWithTimeout('https://api.gold-api.com/price/XAG', 5000)) as Record<string, unknown>;
  const price = Number(data.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Invalid silver price from gold-api');
  }
  const prev = Number(data.prev_close_price);
  const change = Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : null;
  return { price, change24hPct: change };
}

async function fetchUsdToInr(): Promise<number> {
  const data = (await fetchJsonWithTimeout('https://open.er-api.com/v6/latest/USD', 5000)) as Record<string, unknown>;
  const rates = (data.rates || {}) as Record<string, unknown>;
  const inr = Number(rates.INR);
  if (!Number.isFinite(inr) || inr <= 0) {
    throw new Error('Invalid INR rate from open.er-api');
  }
  return inr;
}

function buildPayload(pricePerGramInr: number, source: SilverRatePayload['source'], extras: Partial<SilverRatePayload> = {}): SilverRatePayload {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    pricePerGramInr: round(pricePerGramInr),
    pricePer10gInr: round(pricePerGramInr * 10),
    pricePerKgInr: round(pricePerGramInr * 1000),
    change24hPct: extras.change24hPct ?? null,
    source,
    fetchedAt: new Date().toISOString(),
    ...(extras.usdPerOz !== undefined ? { usdPerOz: extras.usdPerOz } : {}),
    ...(extras.usdToInr !== undefined ? { usdToInr: extras.usdToInr } : {}),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setHeaders(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Manual override wins.
  const manual = await readManualOverride();
  if (manual) {
    return res.status(200).json(buildPayload(manual.pricePerGramInr, 'manual'));
  }

  // 2. Live fetch.
  try {
    const [silver, usdToInr] = await Promise.all([fetchSilverUsdPerOz(), fetchUsdToInr()]);
    // Multiply by Indian duty factor (customs + AIDC + SWS + GST ≈ 15.3%)
    // so the result matches MCX/Indian domestic wholesale rates.
    const pricePerGramInr = (silver.price * usdToInr * INDIA_DUTY_MULTIPLIER) / GRAMS_PER_TROY_OUNCE;
    return res.status(200).json(
      buildPayload(pricePerGramInr, 'live', {
        change24hPct: silver.change24hPct,
        usdPerOz: silver.price,
        usdToInr,
      }),
    );
  } catch (err) {
    // 3. Last-resort fallback — never let the UI break.
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json(buildPayload(FALLBACK_INR_PER_GRAM, 'fallback'));
  }
}
