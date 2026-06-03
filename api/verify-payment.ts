import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRazorpayCredentials, isValidPaymentSignature, setCors } from './razorpay-utils';

/**
 * POST /api/verify-payment
 *
 * Verifies the signature Razorpay returns to the browser after a successful
 * payment. The order is only considered paid when the recomputed HMAC matches.
 *
 * Body:    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: { verified: true } on match, 400 otherwise (never marks as paid).
 */
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

  let keySecret: string;
  try {
    ({ keySecret } = getRazorpayCredentials());
  } catch (error) {
    return res.status(500).json({
      verified: false,
      error: error instanceof Error ? error.message : 'Razorpay is not configured',
    });
  }

  const verified = isValidPaymentSignature({ orderId, paymentId, signature, keySecret });

  // ── Signature mismatch → 400, do NOT mark as paid ──
  if (!verified) {
    return res.status(400).json({ verified: false, error: 'Payment signature verification failed' });
  }

  return res.status(200).json({
    verified: true,
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
  });
}
