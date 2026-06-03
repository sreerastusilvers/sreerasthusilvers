import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRazorpayClient, getRazorpayCredentials, setCors } from './razorpay-utils';

/**
 * POST /api/create-order
 *
 * Creates a Razorpay order so the browser can open Standard Checkout against
 * a real `order_id`. The amount is always validated server-side (the client
 * cannot create an order below the ₹1 / 100-paise minimum).
 *
 * Body:    { amount: number (paise), currency?: string, receipt?: string, notes?: object }
 * Returns: { order_id, amount, currency, key_id }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body || {}) as {
    amount?: unknown;
    currency?: unknown;
    receipt?: unknown;
    notes?: Record<string, string>;
  };

  // ── Validate amount (must be a whole number of paise, ≥ 100) ──
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 100) {
    return res
      .status(400)
      .json({ error: 'amount must be an integer of at least 100 paise (₹1.00)' });
  }

  const currency = typeof body.currency === 'string' && body.currency ? body.currency : 'INR';
  const receipt =
    typeof body.receipt === 'string' && body.receipt
      ? body.receipt
      : `rcpt_${Date.now()}`;

  // ── Ensure credentials exist before calling out ──
  let keyId: string;
  try {
    ({ keyId } = getRazorpayCredentials());
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Razorpay is not configured',
    });
  }

  // ── Create the order via the Razorpay API ──
  try {
    const client = createRazorpayClient();
    const order = await client.orders.create({
      amount,
      currency,
      receipt,
      ...(body.notes ? { notes: body.notes } : {}),
    });

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (error: unknown) {
    // Razorpay auth failures surface as statusCode 401 — relay that so callers
    // can distinguish bad keys from generic gateway errors.
    const statusCode = (error as { statusCode?: number })?.statusCode;
    const detail =
      (error as { error?: { description?: string } })?.error?.description ||
      (error instanceof Error ? error.message : 'Unknown Razorpay error');

    if (statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed', detail });
    }

    return res.status(500).json({ error: 'Failed to create Razorpay order', detail });
  }
}
