/**
 * Meta (Facebook) Pixel, so Meta ads can measure views, carts and purchases.
 *
 * - Off unless VITE_META_PIXEL_ID is set: nothing is loaded, every call is a no-op.
 * - fbevents.js loads lazily on the first trackable page, so a visit that only
 *   touches admin/delivery pages never loads it.
 * - PageView is sent by MetaPixelRouteTracker (src/components/analytics), not by
 *   fbevents' own history.pushState hook, which is switched off to avoid doubles.
 * - Meta's "automatic configuration" (button-text capture and automatic
 *   advanced matching from form fields) is off: no personal data leaves here.
 *   The params types below only allow product/order fields for the same reason.
 *
 * Kept free of imports so scripts/tests/meta-pixel.test.mjs can load it in Node.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export type PixelEvent = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase';

/** Only product and order facts. Never names, phones, emails or addresses. */
export interface PixelParams {
  content_ids?: string[];
  content_type?: 'product';
  content_name?: string;
  value?: number;
  currency?: 'INR';
  quantity?: number;
  num_items?: number;
}

const PIXEL_ID: string = String(
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_META_PIXEL_ID) ?? '',
).trim();

const PURCHASE_STORAGE_KEY = 'meta_pixel_purchases';
const PURCHASE_MEMORY = new Set<string>();

let initialised = false;

export const isMetaPixelEnabled = (): boolean => PIXEL_ID.length > 0;

/**
 * Pages Meta must never see: staff areas, and auth links whose URL carries a
 * one-time code (Firebase `oobCode`) that would otherwise be sent to Meta.
 */
const BLOCKED_PREFIXES = ['/admin', '/delivery', '/deliverypartner'];
const BLOCKED_EXACT = new Set([
  '/reset-password',
  '/auth/reset-password',
  '/auth/action',
  '/__/auth/action',
  '/verify-email',
  '/auth/verify-email',
]);

export function isTrackablePath(pathname: string): boolean {
  const path = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (BLOCKED_EXACT.has(path)) return false;
  return !BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

const currentPathTrackable = (): boolean =>
  typeof window !== 'undefined' && isTrackablePath(window.location.pathname);

/** Standard Meta base code, plus the SPA and privacy switches described above. */
function init(): boolean {
  if (!isMetaPixelEnabled() || typeof window === 'undefined') return false;
  if (initialised && window.fbq) return true;
  initialised = true;

  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as Fbq;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    window.fbq = n;
    if (!window._fbq) window._fbq = n;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  // Must be set before fbevents.js runs (it reads them on load).
  window.fbq.disablePushState = true;
  window.fbq.allowDuplicatePageViews = true;
  window.fbq('set', 'autoConfig', false, PIXEL_ID);
  window.fbq('init', PIXEL_ID);
  return true;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function clean(params: PixelParams): PixelParams {
  const out: PixelParams = { ...params };
  if (typeof out.value === 'number') {
    if (!Number.isFinite(out.value)) delete out.value;
    else out.value = round2(out.value);
  }
  if (out.content_ids) out.content_ids = out.content_ids.filter(Boolean).map(String);
  return out;
}

/** Send one standard event. `eventID` lets Meta drop duplicates of the same event. */
export function track(event: PixelEvent, params: PixelParams = {}, eventID?: string): void {
  if (!currentPathTrackable() || !init()) return;
  const payload = clean(params);
  if (eventID) window.fbq!('track', event, payload, { eventID });
  else window.fbq!('track', event, payload);
}

export function trackPageView(): void {
  track('PageView');
}

export interface PixelProduct {
  id: string;
  name: string;
  price: number;
}

export function trackViewContent(p: PixelProduct): void {
  track('ViewContent', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    value: p.price,
    currency: 'INR',
  });
}

export function trackAddToCart(p: PixelProduct, quantity: number): void {
  track('AddToCart', {
    content_ids: [p.id],
    content_type: 'product',
    content_name: p.name,
    value: p.price * quantity,
    currency: 'INR',
    quantity,
  });
}

export interface PixelLine {
  id: string;
  quantity: number;
}

const summarise = (lines: PixelLine[]) => ({
  content_ids: Array.from(new Set(lines.map((l) => l.id))),
  num_items: lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0),
});

export function trackInitiateCheckout(lines: PixelLine[], cartTotal: number): void {
  if (lines.length === 0) return;
  track('InitiateCheckout', {
    ...summarise(lines),
    content_type: 'product',
    value: cartTotal,
    currency: 'INR',
  });
}

function purchaseAlreadySent(orderId: string): boolean {
  if (PURCHASE_MEMORY.has(orderId)) return true;
  try {
    const list = JSON.parse(window.localStorage.getItem(PURCHASE_STORAGE_KEY) || '[]');
    return Array.isArray(list) && list.includes(orderId);
  } catch {
    return false;
  }
}

function rememberPurchase(orderId: string): void {
  PURCHASE_MEMORY.add(orderId);
  try {
    const raw = JSON.parse(window.localStorage.getItem(PURCHASE_STORAGE_KEY) || '[]');
    const list: string[] = Array.isArray(raw) ? raw : [];
    list.push(orderId);
    window.localStorage.setItem(PURCHASE_STORAGE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    /* storage blocked: the in-memory set and Meta's eventID dedupe still apply */
  }
}

/**
 * Call ONLY after the payment is verified server-side. Fires at most once per
 * order on this device; eventID = order number lets Meta dedupe the rest.
 * Returns true when the event was sent.
 */
export function trackPurchase(orderId: string, lines: PixelLine[], paidTotal: number): boolean {
  if (!orderId || !isMetaPixelEnabled() || !currentPathTrackable()) return false;
  if (purchaseAlreadySent(orderId)) return false;
  rememberPurchase(orderId);
  track(
    'Purchase',
    { ...summarise(lines), content_type: 'product', value: paidTotal, currency: 'INR' },
    orderId,
  );
  return true;
}
