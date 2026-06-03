import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/create-order
 *
 * Creates a Razorpay order so the browser can open Standard Checkout against
 * a real `order_id`. Talks to the Razorpay REST API directly over `fetch`
 * with HTTP Basic auth (key_id:key_secret) — the same dependency-free pattern
 * the WhatsApp functions use for Meta, so the function bundle is Node built-ins
 * only and can't fail to load on the serverless runtime.
 *
 * The amount is always validated server-side (the client cannot create an
 * order below the ₹1 / 100-paise minimum). The key secret never leaves here.
 *
 * Body:    { amount: number (paise), currency?: string, receipt?: string, notes?: object }
 * Returns: { order_id, amount, currency, key_id }
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

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
    typeof body.receipt === 'string' && body.receipt ? body.receipt : `rcpt_${Date.now()}`;

  // ── Credentials (server-only) ──
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res
      .status(500)
      .json({ error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured' });
  }

  // ── Create the order via the Razorpay REST API ──
  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const resp = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
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
      // Auth failures (bad keys) → 401 so callers can distinguish them.
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
