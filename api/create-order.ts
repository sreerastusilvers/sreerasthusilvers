import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/create-order
 *
 * Creates a Razorpay order so the browser can open Standard Checkout against
 * a real `order_id`.
 *
 * SECURITY: the order amount is computed HERE, from Firestore, and the client's
 * figure is only used as a cross-check. An earlier version took `amount`
 * straight from the request body and validated nothing but "is it >= 100 paise",
 * so anyone could open devtools and pay Rs.1 for a Rs.45,600 order - the
 * signature returned by Razorpay would verify perfectly, because it signs the
 * order, not the price. Every input below (product prices, delivery tiers, GST,
 * coupons, silver rate) is server-controlled data.
 *
 * Body:    { items: [{ productId, quantity }], paymentMethod?, couponCode?,
 *            currency?, receipt?, notes?, amount? (client's claim, checked) }
 * Returns: { order_id, amount, currency, key_id }
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';
/** Client and server both round; allow a rupee of drift before rejecting. */
const AMOUNT_TOLERANCE_PAISE = 100;

/**
 * Firestore access uses the REST API with the public web key, not the Admin SDK.
 *
 * On the Spark plan the Admin SDK's Firestore reads fail with
 * `8 RESOURCE_EXHAUSTED: Quota exceeded` (server-side API quota is zeroed
 * without billing), which would take checkout down entirely. Everything read
 * here - products, coupons, siteSettings - is already `allow read: if true`, so
 * the public key is sufficient and this works on both Spark and Blaze.
 *
 * Read-only and public does not mean untrusted: these documents are only
 * writable by admins, so they remain a trustworthy source of prices.
 */
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const WEB_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

const firestoreBase = () =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/** Unwrap Firestore's typed REST representation into plain JS. */
function decodeValue(v: any): any {
  if (v == null) return undefined;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  return undefined;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}

/** Returns the document's data, or null when it does not exist. */
async function getDoc(path: string): Promise<Record<string, any> | null> {
  const resp = await fetch(`${firestoreBase()}/${path}?key=${WEB_API_KEY}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Firestore read failed for ${path} (HTTP ${resp.status})`);
  const json = (await resp.json()) as { fields?: Record<string, any> };
  return decodeFields(json.fields || {});
}

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Pricing helpers: must mirror src/hooks/useCheckoutPricing.ts ─────────────

const DEFAULT_DELIVERY = {
  tiers: [{ minOrder: 0, charge: 50 }],
  freeDeliveryAbove: 999,
  codEnabled: true,
  codCharge: 0,
};
const DEFAULT_GST = { enabled: false, rate: 0 };

function computeDeliveryCharge(subtotal: number, s: any): number {
  if (s.freeDeliveryAbove > 0 && subtotal >= s.freeDeliveryAbove) return 0;
  const tiers = Array.isArray(s.tiers) && s.tiers.length ? s.tiers : DEFAULT_DELIVERY.tiers;
  const sorted = [...tiers].sort((a, b) => b.minOrder - a.minOrder);
  const tier = sorted.find((t) => subtotal >= t.minOrder) ?? tiers[0];
  return tier?.charge ?? 0;
}

/** The client forces `inclusive: false`, so GST always adds on top when enabled. */
function computeGstOnTop(subtotal: number, gst: any): number {
  if (!gst?.enabled || !(gst.rate > 0)) return 0;
  return Math.round((subtotal * gst.rate) / 100);
}

function computeSilverPrice(sp: any, ratePerGram: number): number {
  const x = (sp.weightGrams || 0) * ratePerGram;
  const y = x * ((sp.wastagePercent || 0) / 100);
  return Math.ceil(x + y + (sp.makingCharges || 0));
}

function couponDiscount(coupon: any, subtotal: number): number {
  if (coupon.type === 'percent') {
    let d = Math.floor((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount > 0) d = Math.min(d, coupon.maxDiscount);
    return d;
  }
  return Math.min(coupon.value, subtotal);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as {
    items?: Array<{ productId?: string; quantity?: unknown }>;
    paymentMethod?: string;
    couponCode?: string;
    amount?: unknown;
    currency?: unknown;
    receipt?: unknown;
    notes?: Record<string, string>;
  };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: 'items[] is required to price this order' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res
      .status(500)
      .json({ error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured' });
  }

  if (!PROJECT_ID || !WEB_API_KEY) {
    return res.status(500).json({ error: 'Firebase project id / web API key are not configured' });
  }

  // Validate every cart line before spending any network calls on it.
  for (const line of items) {
    const quantity = Number(line.quantity);
    if (!line.productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res
        .status(400)
        .json({ error: `Invalid cart line for product ${String(line.productId || '')}` });
    }
  }

  let serverTotal: number;
  try {
    // ── Settings (admin-managed documents, never client-supplied) ──
    const [deliveryDoc, gstDoc, silverDoc] = await Promise.all([
      getDoc('siteSettings/delivery'),
      getDoc('siteSettings/gst'),
      getDoc('siteSettings/silverRate'),
    ]);
    const delivery = { ...DEFAULT_DELIVERY, ...(deliveryDoc || {}) };
    const gst = { ...DEFAULT_GST, ...(gstDoc || {}) };
    const ratePerGram = Number(silverDoc?.manualPricePerGramInr) || 0;

    // ── Subtotal from stored product prices ──
    const products = await Promise.all(
      items.map((line) => getDoc(`products/${String(line.productId)}`)),
    );

    let subtotal = 0;
    for (let i = 0; i < items.length; i++) {
      const productId = String(items[i].productId);
      const p = products[i];
      if (!p) {
        return res.status(400).json({ error: `Product ${productId} no longer exists` });
      }
      if (p.flags?.isActive === false) {
        return res.status(400).json({ error: `Product ${productId} is no longer available` });
      }

      const sp = p.silverPricing;
      const unit =
        sp?.enabled && ratePerGram > 0 ? computeSilverPrice(sp, ratePerGram) : Number(p.price);
      if (!Number.isFinite(unit) || unit < 0) {
        return res.status(400).json({ error: `Product ${productId} has no valid price` });
      }
      subtotal += unit * Number(items[i].quantity);
    }

    // ── Coupon, re-validated server-side ──
    let discount = 0;
    const code = typeof body.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : '';
    if (code) {
      const resp = await fetch(`${firestoreBase()}:runQuery?key=${WEB_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'coupons' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'code' },
                op: 'EQUAL',
                value: { stringValue: code },
              },
            },
            limit: 1,
          },
        }),
      });
      const rows = resp.ok ? ((await resp.json()) as any[]) : [];
      const found = rows.find((r) => r?.document?.fields);
      const coupon = found ? decodeFields(found.document.fields) : null;
      const now = new Date();
      const usable =
        coupon &&
        coupon.active &&
        (!coupon.validFrom || coupon.validFrom <= now) &&
        (!coupon.validTo || coupon.validTo >= now) &&
        !(coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) &&
        subtotal >= (coupon.minOrderValue || 0);
      if (usable) discount = couponDiscount(coupon, subtotal);
    }

    const isCod = /cash|cod/i.test(body.paymentMethod || '');
    const deliveryCharge = computeDeliveryCharge(subtotal, delivery);
    const gstAmount = computeGstOnTop(subtotal, gst);
    const codCharge = isCod && delivery.codEnabled ? delivery.codCharge || 0 : 0;

    serverTotal = Math.max(0, subtotal + deliveryCharge + gstAmount + codCharge - discount);
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Could not price this order',
      detail: error instanceof Error ? error.message : 'Unknown pricing error',
    });
  }

  const amountInPaise = Math.round(serverTotal * 100);
  if (amountInPaise < 100) {
    return res.status(400).json({ error: 'Order total is below the ₹1.00 minimum' });
  }

  // Cross-check the client's figure. A mismatch means the two pricing paths have
  // diverged (a bug) or someone is tampering - either way, do not take payment.
  const claimed = Number(body.amount);
  if (Number.isFinite(claimed) && Math.abs(claimed - amountInPaise) > AMOUNT_TOLERANCE_PAISE) {
    return res.status(400).json({
      error: 'Order total mismatch. Please refresh your cart and try again.',
      detail: `client=${claimed} server=${amountInPaise}`,
    });
  }

  const currency = typeof body.currency === 'string' && body.currency ? body.currency : 'INR';
  const receipt =
    typeof body.receipt === 'string' && body.receipt ? body.receipt : `rcpt_${Date.now()}`;

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt,
        ...(body.notes ? { notes: body.notes } : {}),
      }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      id?: string;
      amount?: number;
      currency?: string;
      error?: { description?: string };
    };

    if (!resp.ok) {
      const detail = data?.error?.description || `Razorpay API error (HTTP ${resp.status})`;
      if (resp.status === 401) {
        return res.status(401).json({ error: 'Razorpay authentication failed', detail });
      }
      return res.status(500).json({ error: 'Failed to create Razorpay order', detail });
    }

    return res.status(200).json({
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: keyId,
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Failed to create Razorpay order',
      detail: error instanceof Error ? error.message : 'Unknown Razorpay error',
    });
  }
}
