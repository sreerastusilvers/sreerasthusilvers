/**
 * Admin-side client for /api/whatsapp-reply actions. Every call sends the
 * signed-in admin's Firebase ID token; the server re-checks the admin role.
 */
import { auth } from '@/config/firebase';
import type { TemplateDraft } from '@/components/admin/whatsapp/templateRules';

const ENDPOINT = '/api/whatsapp-reply';

export class WhatsAppApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;
  metaCode?: number | null;
  constructor(message: string, status: number, extra?: { fieldErrors?: Record<string, string>; metaCode?: number | null }) {
    super(message);
    this.status = status;
    this.fieldErrors = extra?.fieldErrors;
    this.metaCode = extra?.metaCode;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new WhatsAppApiError('Please sign in again.', 401);
  return { Authorization: `Bearer ${token}` };
}

async function post(action: string, payload: Record<string, unknown> = {}): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ action, ...payload }),
  });
}

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let resp: Response;
  try {
    resp = await post(action, payload);
  } catch {
    throw new WhatsAppApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const isJson = (resp.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await resp.json().catch(() => ({})) : {};
  if (!resp.ok || !isJson || data?.ok === false) {
    const message =
      data?.error ||
      (resp.status === 404 || !isJson
        ? 'The WhatsApp API is not available here. It runs on the deployed site (Vercel).'
        : `Request failed (HTTP ${resp.status}).`);
    throw new WhatsAppApiError(message, resp.status, { fieldErrors: data?.fieldErrors, metaCode: data?.metaCode });
  }
  return data as T;
}

export interface MetaTemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejectedReason: string | null;
  components: Array<Record<string, unknown>>;
  bodyText: string;
  paramCount: number;
}

export interface ConfigStatus {
  ok: boolean;
  partial?: boolean;
  env: Partial<Record<
    'WHATSAPP_TOKEN' | 'WHATSAPP_PHONE_ID' | 'WHATSAPP_WABA_ID' | 'WHATSAPP_VERIFY_TOKEN' | 'WHATSAPP_APP_SECRET' | 'FIREBASE_ADMIN_SDK_BASE64',
    boolean
  >>;
  webhookSeen?: boolean;
  graphVersion?: string;
}

export const whatsappAdminApi = {
  send: (payload: { phone: string; text?: string; template?: { name: string; language: string; params: string[] } }) =>
    call<{ ok: true; messageId: string | null }>('send', payload),

  markRead: (phone: string, messageId?: string | null) =>
    call<{ ok: true; receiptSent: boolean }>('mark-read', { phone, messageId: messageId || undefined }),

  listTemplates: (sync = true) =>
    call<{ ok: true; templates: MetaTemplateRow[]; sync: { upserted: number; removed: number } | null }>('templates-list', { sync }),

  createTemplate: (draft: TemplateDraft) =>
    call<{ ok: true; template: { id: string; name: string; language: string; category: string; status: string } }>(
      'templates-create',
      draft as unknown as Record<string, unknown>,
    ),

  deleteTemplate: (name: string, metaId?: string | null) =>
    call<{ ok: true; removed: number }>('templates-delete', { name, metaId: metaId || undefined }),

  configStatus: () => call<ConfigStatus>('config-status'),

  /** Downloads inbound media through the admin proxy and returns an object URL. */
  async mediaObjectUrl(mediaId: string): Promise<string> {
    let resp: Response;
    try {
      resp = await post('media', { mediaId });
    } catch {
      throw new WhatsAppApiError('Could not reach the server.', 0);
    }
    const type = resp.headers.get('content-type') || '';
    if (!resp.ok || type.includes('application/json')) {
      const data = await resp.json().catch(() => ({}));
      throw new WhatsAppApiError(data?.error || `Could not load media (HTTP ${resp.status}).`, resp.status);
    }
    return URL.createObjectURL(await resp.blob());
  },
};
