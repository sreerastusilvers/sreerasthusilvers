import crypto from 'crypto';
import type { VercelResponse } from '@vercel/node';

/**
 * Shared Razorpay helpers for the serverless payment endpoints.
 *
 * These talk to the Razorpay REST API directly over `fetch` with HTTP Basic
 * auth (key_id:key_secret) — the same dependency-free pattern the WhatsApp
 * functions use for Meta. No SDK import, so the function bundle is Node
 * built-ins only and can't fail to load on the serverless runtime.
 *
 * The key secret lives ONLY here on the server — it is read from
 * `RAZORPAY_KEY_SECRET` and is never returned to the browser. The key id
 * (`RAZORPAY_KEY_ID`) is public and safe to expose to checkout.js.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

/** Read + validate the Razorpay credentials from the environment. */
export function getRazorpayCredentials(): RazorpayCredentials {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured');
  }

  return { keyId, keySecret };
}

/**
 * CORS headers — mirrors the convention used by the other endpoints in /api
 * (see api/gemini-generate.ts).
 */
export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export interface CreateOrderInput {
  /** Amount in paise (integer, ≥ 100). */
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  [key: string]: unknown;
}

/**
 * Create an order via the Razorpay REST API.
 * Throws an Error with `.statusCode` set so callers can map 401 → 401.
 */
export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
  const { keyId, keySecret } = getRazorpayCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const resp = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      ...(input.notes ? { notes: input.notes } : {}),
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as {
    error?: { description?: string };
  } & RazorpayOrder;

  if (!resp.ok) {
    const err = new Error(
      data?.error?.description || `Razorpay API error (HTTP ${resp.status})`,
    );
    (err as Error & { statusCode?: number }).statusCode = resp.status;
    throw err;
  }

  return data;
}

/**
 * Verify a Razorpay payment signature.
 *
 * Razorpay signs `${order_id}|${payment_id}` with HMAC-SHA256 using the key
 * secret. We recompute it and compare in constant time so a payment can only
 * be marked paid when the signature genuinely matches.
 */
export function isValidPaymentSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const { orderId, paymentId, signature, keySecret } = args;

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(String(signature), 'utf8');

  // timingSafeEqual throws if the buffers differ in length — guard first.
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
