import crypto from 'crypto';
import Razorpay from 'razorpay';
import type { VercelResponse } from '@vercel/node';

/**
 * Shared Razorpay helpers for the serverless payment endpoints.
 *
 * The key secret lives ONLY here on the server — it is read from
 * `RAZORPAY_KEY_SECRET` and is never returned to the browser. The key id
 * (`RAZORPAY_KEY_ID`) is public and safe to expose to checkout.js.
 */

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

/** Instantiate the Razorpay SDK client with the server credentials. */
export function createRazorpayClient(): Razorpay {
  const { keyId, keySecret } = getRazorpayCredentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
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
