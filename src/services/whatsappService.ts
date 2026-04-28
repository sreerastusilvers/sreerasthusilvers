/**
 * Client-side wrapper for the WhatsApp serverless endpoints.
 * Use these helpers instead of calling /api/whatsapp-* directly.
 */

const ADMIN_KEY_LS = 'adminNotificationKey';

interface TextOpts {
  to: string;
  text: string;
}
interface TemplateOpts {
  to: string;
  template: string;
  language?: string;
  params?: string[];
}
interface OtpStartOpts {
  to: string;
}
interface OtpVerifyOpts {
  otpRef: string;
  otp: string;
}

export const normalizePhoneNumber = (input?: string) => {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
};

const adminHeaders = () => {
  const key = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_KEY_LS) || '' : '';
  return key ? { 'x-admin-key': key } : {};
};

async function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = (await resp.json().catch(() => ({}))) as T;
  if (!resp.ok) {
    const msg = (data as any)?.error || `HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Send a free-form WhatsApp text (admin-gated). */
export const sendWhatsAppText = (opts: TextOpts) =>
  postJson<{ ok: boolean; messageId?: string }>(
    '/api/whatsapp-send',
    { kind: 'text', ...opts, to: normalizePhoneNumber(opts.to) },
    adminHeaders(),
  );

/** Send a pre-approved template message (admin-gated). */
export const sendWhatsAppTemplate = (opts: TemplateOpts) =>
  postJson<{ ok: boolean; messageId?: string }>(
    '/api/whatsapp-send',
    { kind: 'template', ...opts, to: normalizePhoneNumber(opts.to) },
    adminHeaders(),
  );

/**
 * Send one of the 4 approved order-notification templates without requiring
 * an admin key — the server allows these specific template names from any
 * authenticated user session.
 */
const sendOrderTemplate = (opts: TemplateOpts) =>
  postJson<{ ok: boolean; messageId?: string }>(
    '/api/whatsapp-send',
    { kind: 'template', ...opts, to: normalizePhoneNumber(opts.to) },
    // No admin header — the server allowlists these template names for public use
  );

/** Trigger an OTP send. Returns an opaque otpRef to be passed back to verify. */
export const startWhatsAppOtp = (opts: OtpStartOpts) =>
  postJson<{ ok: boolean; otpRef: string }>('/api/whatsapp-send', {
    kind: 'otp',
    ...opts,
    to: normalizePhoneNumber(opts.to),
  });

/** Verify an OTP entered by the user. */
export const verifyWhatsAppOtp = (opts: OtpVerifyOpts) =>
  postJson<{ ok: boolean; verified: boolean; to?: string }>('/api/whatsapp-verify-otp', opts);

/**
 * Convenience: send a localised order status alert.
 * Skips silently if the recipient phone is missing.
 *
 * NOTE: the user's standing rule excludes OTP / security-sensitive messages
 * from going through this generic broadcast — those use startWhatsAppOtp.
 *
 * @deprecated Use sendOrderStatusTemplate for template-based sends.
 */
export const sendOrderStatusAlert = async (params: {
  to?: string;
  orderId: string;
  status: string;
  customerName?: string;
}) => {
  if (!params.to) return { ok: false, skipped: true } as const;
  const friendly: Record<string, string> = {
    pending: 'received and is awaiting confirmation',
    processing: 'is being prepared',
    shipped: 'has been shipped',
    assigned: 'has been assigned to a delivery partner',
    picked: 'has been picked up by our delivery partner',
    outForDelivery: 'is out for delivery',
    delivered: 'has been delivered',
    cancelled: 'was cancelled',
    returnRequested: 'return request has been received',
    returnScheduled: 'return has been scheduled',
    returned: 'return is complete',
  };
  const phrase = friendly[params.status] || `status changed to ${params.status}`;
  const name = params.customerName ? params.customerName.split(' ')[0] : 'there';
  const text =
    `Hi ${name}, your Sreerasthu Silvers order #${params.orderId.slice(-6).toUpperCase()} ${phrase}. ` +
    `Track it any time in your account.`;
  try {
    return await sendWhatsAppText({ to: params.to, text });
  } catch (err) {
    console.warn('[whatsapp] order status send failed:', err);
    return { ok: false, error: (err as Error).message } as const;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-approved Meta template helpers
// All are fire-and-forget wrappers — they never throw, never block order flow.
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (orderId: string) => `#${orderId.slice(-6).toUpperCase()}`;

/**
 * Notify a customer that their order was placed successfully.
 * Template: order_placed  ({{1}} firstName, {{2}} orderId, {{3}} items, {{4}} total ₹)
 */
export const sendOrderPlacedTemplate = (opts: {
  to?: string;
  customerName: string;
  orderId: string;
  total: number;
  itemsSummary?: string;
}): Promise<unknown> => {
  if (!opts.to) return Promise.resolve({ ok: false, skipped: true });
  return sendOrderTemplate({
    to: opts.to,
    template: 'order_placed',
    language: 'en',
    params: [
      opts.customerName.split(' ')[0] || 'there',
      fmt(opts.orderId),
      opts.itemsSummary || 'your items',
      String(Math.round(opts.total)),
    ],
  }).catch((err) => {
    console.warn('[whatsapp] order_placed template failed:', err);
    return { ok: false, error: (err as Error).message };
  });
};

/**
 * Notify the store admin that a new order arrived.
 * Template: admin_new_order  ({{1}} orderId, {{2}} items, {{3}} total ₹, {{4}} customerName)
 */
export const sendAdminNewOrderTemplate = (opts: {
  to?: string;
  orderId: string;
  total: number;
  customerName: string;
  itemsSummary?: string;
}): Promise<unknown> => {
  if (!opts.to) return Promise.resolve({ ok: false, skipped: true });
  return sendOrderTemplate({
    to: opts.to,
    template: 'admin_new_order',
    language: 'en',
    params: [
      fmt(opts.orderId),
      opts.itemsSummary || 'items',
      String(Math.round(opts.total)),
      opts.customerName || 'a customer',
    ],
  }).catch((err) => {
    console.warn('[whatsapp] admin_new_order template failed:', err);
    return { ok: false, error: (err as Error).message };
  });
};

/**
 * Notify a delivery partner they have been assigned an order.
 * Template: delivery_assigned  ({{1}} partnerFirstName, {{2}} orderId, {{3}} items, {{4}} deliveryAddress)
 */
export const sendDeliveryAssignedTemplate = (opts: {
  to?: string;
  partnerName: string;
  orderId: string;
  deliveryAddress: string;
  itemsSummary?: string;
}): Promise<unknown> => {
  if (!opts.to) return Promise.resolve({ ok: false, skipped: true });
  return sendOrderTemplate({
    to: opts.to,
    template: 'delivery_assigned',
    language: 'en',
    params: [
      opts.partnerName.split(' ')[0] || 'there',
      fmt(opts.orderId),
      opts.itemsSummary || 'items',
      opts.deliveryAddress,
    ],
  }).catch((err) => {
    console.warn('[whatsapp] delivery_assigned template failed:', err);
    return { ok: false, error: (err as Error).message };
  });
};

/**
 * Send an order-status update to the customer using a pre-approved template.
 * Template: order_status_update  ({{1}} firstName, {{2}} orderId, {{3}} items, {{4}} statusPhrase)
 */
export const sendOrderStatusTemplate = (opts: {
  to?: string;
  customerName: string;
  orderId: string;
  status: string;
  itemsSummary?: string;
}): Promise<unknown> => {
  if (!opts.to) return Promise.resolve({ ok: false, skipped: true });
  const friendly: Record<string, string> = {
    pending: 'has been received and is awaiting confirmation',
    processing: 'is being prepared',
    packed: 'has been packed and is ready for dispatch',
    shipped: 'has been shipped',
    assigned: 'has been assigned to a delivery partner',
    picked: 'has been picked up by our delivery partner',
    outForDelivery: 'is out for delivery',
    delivered: 'has been delivered successfully',
    cancelled: 'has been cancelled',
    returnRequested: 'return request has been received',
    returnScheduled: 'return has been scheduled',
    returned: 'return is complete',
    refunded: 'has been refunded',
    deliveryFailed: 'delivery attempt failed — we will retry shortly',
  };
  const phrase = friendly[opts.status] || `status changed to ${opts.status}`;
  return sendOrderTemplate({
    to: opts.to,
    template: 'order_status_update',
    language: 'en',
    params: [
      opts.customerName.split(' ')[0] || 'there',
      fmt(opts.orderId),
      opts.itemsSummary || 'your order',
      phrase,
    ],
  }).catch((err) => {
    console.warn('[whatsapp] order_status_update template failed:', err);
    return { ok: false, error: (err as Error).message };
  });
};

export const WhatsApp = {
  sendText: sendWhatsAppText,
  sendTemplate: sendWhatsAppTemplate,
  startOtp: startWhatsAppOtp,
  verifyOtp: verifyWhatsAppOtp,
  sendOrderStatusAlert,
};

export default WhatsApp;
