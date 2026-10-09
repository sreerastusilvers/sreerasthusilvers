import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import admin from 'firebase-admin';

/**
 * POST /api/verify-payment
 *
 * Verifies the signature Razorpay returns to the browser after a successful
 * payment, then RECORDS the payment as `payments/{razorpayPaymentId}`.
 *
 * Razorpay signs `${order_id}|${payment_id}` with HMAC-SHA256 using the key
 * secret; we recompute it and compare in constant time.
 *
 * Why the record (gap G1): the browser writes the order itself, and it used to
 * be free to write `paymentStatus: 'paid'` whether or not it had paid. The
 * Firestore rules now accept a paid order only when this record exists, belongs
 * to the same customer, matches the order's total and items, and has the order
 * stored under the payment id (so one payment buys one order). Only this
 * function can write the record.
 *
 * How it writes: the Firestore REST API, signed in as a service identity
 * (a custom token with the `paymentServer` claim, minted locally from the
 * service-account key). That is the same client path the browser uses; the
 * Admin SDK's own Firestore calls hit RESOURCE_EXHAUSTED on the Spark plan
 * (see api/create-order.ts).
 *
 * Header:  Authorization: Bearer <customer's Firebase ID token>
 * Body:    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: { verified: true, recorded } on a good signature, 400 otherwise.
 *          `recorded: false` means the payment is real but the record could not
 *          be written; checkout then saves the order as "payment pending, needs
 *          review" instead of losing it.
 */

const SERVICE_UID = 'razorpay-verifier';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const WEB_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

// Local emulator testing only: these are never set on Vercel.
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST;
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const RAZORPAY_API_BASE =
  (FIRESTORE_EMULATOR && process.env.RAZORPAY_TEST_API_BASE) || 'https://api.razorpay.com/v1';

const firestoreBase = () =>
  `${FIRESTORE_EMULATOR ? `http://${FIRESTORE_EMULATOR}` : 'https://firestore.googleapis.com'}` +
  `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const identityBase = () =>
  `${AUTH_EMULATOR ? `http://${AUTH_EMULATOR}/` : 'https://'}identitytoolkit.googleapis.com/v1`;

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isValidSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
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

function initAdmin() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_ADMIN_SDK_BASE64;
  if (b64) {
    const svc = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  } else {
    // Enough for verifyIdToken (Google's public keys) and for the emulator's
    // unsigned custom tokens. On Vercel, minting a real custom token needs the key.
    admin.initializeApp({ projectId: PROJECT_ID });
  }
}

/** The signed-in customer, from their Firebase ID token. */
async function callerUid(req: VercelRequest): Promise<string> {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new Error('No sign-in token was sent');
  initAdmin();
  try {
    return (await admin.auth().verifyIdToken(token)).uid;
  } catch {
    throw new Error('The sign-in token is not valid');
  }
}

/** Server-priced cart lines that /api/create-order left in the Razorpay order's notes. */
export function parseLines(notes: Record<string, unknown> | undefined): Array<{ productId: string; quantity: number }> {
  const count = Number(notes?.srs_line_count);
  if (!Number.isInteger(count) || count < 1) return [];
  const lines: Array<{ productId: string; quantity: number }> = [];
  for (let k = 0; notes && `srs_lines_${k}` in notes; k++) {
    for (const part of String(notes[`srs_lines_${k}`]).split(',')) {
      const [productId, qty] = part.split('*');
      const quantity = Number(qty);
      if (!productId || !Number.isInteger(quantity) || quantity < 1) return [];
      lines.push({ productId, quantity });
    }
  }
  return lines.length === count ? lines : [];
}

async function razorpayGet(path: string, keyId: string, keySecret: string): Promise<any> {
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const resp = await fetch(`${RAZORPAY_API_BASE}${path}`, { headers: { Authorization: `Basic ${auth}` } });
  if (!resp.ok) throw new Error(`Razorpay ${path.split('/')[1]} lookup failed (HTTP ${resp.status})`);
  return resp.json();
}

let serviceToken: { idToken: string; expiresAt: number } | null = null;

/** An ID token for the service identity the rules trust to write payments. */
async function getServiceIdToken(): Promise<string> {
  if (serviceToken && serviceToken.expiresAt > Date.now() + 60_000) return serviceToken.idToken;
  initAdmin();
  const customToken = await admin.auth().createCustomToken(SERVICE_UID, { paymentServer: true });
  const resp = await fetch(`${identityBase()}/accounts:signInWithCustomToken?key=${WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!resp.ok) throw new Error(`Service sign-in failed (HTTP ${resp.status})`);
  const data = (await resp.json()) as { idToken?: string; expiresIn?: string };
  if (!data.idToken) throw new Error('Service sign-in returned no token');
  serviceToken = { idToken: data.idToken, expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000 };
  return data.idToken;
}

interface PaymentRecord {
  userId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: string;
  status: string;
  lines: Array<{ productId: string; quantity: number }>;
}

const str = (v: string) => ({ stringValue: v });
const int = (v: number) => ({ integerValue: String(v) });

/**
 * Write the record once. Returns true when it is in place for this customer
 * (written now, or by an earlier retry of the same payment).
 */
async function writePaymentRecord(rec: PaymentRecord): Promise<boolean> {
  const idToken = await getServiceIdToken();
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  const fields = {
    userId: str(rec.userId),
    razorpayPaymentId: str(rec.razorpayPaymentId),
    razorpayOrderId: str(rec.razorpayOrderId),
    amountPaise: int(rec.amountPaise),
    currency: str(rec.currency),
    status: str(rec.status),
    lines: {
      arrayValue: {
        values: rec.lines.map((l) => ({
          mapValue: { fields: { productId: str(l.productId), quantity: int(l.quantity) } },
        })),
      },
    },
    createdAt: { timestampValue: new Date().toISOString() },
  };
  const id = encodeURIComponent(rec.razorpayPaymentId);
  const resp = await fetch(`${firestoreBase()}/payments?documentId=${id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fields }),
  });
  if (resp.ok) return true;
  if (resp.status !== 409) throw new Error(`Payment record write failed (HTTP ${resp.status})`);

  // Already there: a retry of the same payment is fine, anyone else's is not.
  const existing = await fetch(`${firestoreBase()}/payments/${id}`, { headers });
  if (!existing.ok) throw new Error(`Payment record read failed (HTTP ${existing.status})`);
  const doc = (await existing.json()) as { fields?: { userId?: { stringValue?: string } } };
  if (doc.fields?.userId?.stringValue !== rec.userId) {
    throw new Error('This payment is already recorded for another account');
  }
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  // ── Missing fields → 400 ──
  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      verified: false,
      error: 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required',
    });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ verified: false, error: 'Razorpay keys are not configured' });
  }

  // ── Signature mismatch → 400, do NOT mark as paid ──
  if (!isValidSignature(orderId, paymentId, signature, keySecret)) {
    return res.status(400).json({ verified: false, error: 'Payment signature verification failed' });
  }

  // The signature is genuine, so the customer HAS paid. From here on a failure
  // only means "could not record it": checkout still saves the order, flagged
  // for the shop to check against the Razorpay dashboard. Answering "not
  // verified" here would tell a paying customer they were not charged.
  let recorded = false;
  let recordError: string | undefined;
  try {
    const uid = await callerUid(req);
    const [payment, order] = await Promise.all([
      razorpayGet(`/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret),
      razorpayGet(`/orders/${encodeURIComponent(orderId)}`, keyId, keySecret),
    ]);
    if (payment?.order_id !== orderId) throw new Error('Payment does not belong to this order');
    if (payment?.status !== 'captured' && payment?.status !== 'authorized') {
      throw new Error(`Payment status is ${payment?.status || 'unknown'}`);
    }
    const lines = parseLines(order?.notes);
    if (lines.length === 0) throw new Error('Order has no priced cart lines');

    recorded = await writePaymentRecord({
      userId: uid,
      razorpayPaymentId: paymentId,
      razorpayOrderId: orderId,
      amountPaise: Number(payment.amount),
      currency: String(payment.currency || 'INR'),
      status: String(payment.status),
      lines,
    });
  } catch (error) {
    recordError = error instanceof Error ? error.message : 'Unknown error';
    console.error('[verify-payment] could not record payment', paymentId, recordError);
  }

  return res.status(200).json({
    verified: true,
    recorded,
    ...(recordError ? { recordError } : {}),
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
  });
}
