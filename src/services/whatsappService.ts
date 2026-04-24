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

export const WhatsApp = {
  sendText: sendWhatsAppText,
  sendTemplate: sendWhatsAppTemplate,
  startOtp: startWhatsAppOtp,
  verifyOtp: verifyWhatsAppOtp,
  sendOrderStatusAlert,
};

export default WhatsApp;
