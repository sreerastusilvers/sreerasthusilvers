/**
 * What the activity log and recycle bin record, and how they name it.
 * Pure (no Firestore) so pages and tests can import it freely.
 */

/** Top-level collection → the admin area it belongs to. */
export const SECTION_BY_COLLECTION: Record<string, string> = {
  products: 'Products',
  categories: 'Categories',
  orders: 'Orders',
  users: 'Customers & team',
  coupons: 'Coupons',
  giftCards: 'Gift cards',
  refunds: 'Refunds',
  banners: 'Hero banners',
  homeBanners: 'Collection banners',
  homeCollections: 'Our collections',
  homeVideos: 'Videos',
  showcases: 'Showcases',
  testimonials: 'Testimonials',
  gallery: 'Gallery',
  reviews: 'Reviews',
  siteSettings: 'Settings',
  newsletterSubscriptions: 'Newsletter',
  videoCallRequests: 'Video calls',
  videoCalls: 'Video calls',
  whatsappTemplates: 'WhatsApp templates',
  whatsappSnippets: 'WhatsApp quick replies',
  whatsappThreads: 'WhatsApp inbox',
  broadcastCampaigns: 'Marketing',
  dealers: 'Manufacturers',
  dealerPrivate: 'Manufacturers',
  dealerTickets: 'Dealer tickets',
  promptHistory: 'AI prompts',
  deliveryRatings: 'Delivery',
};

/**
 * Writes that are routine bookkeeping, not decisions: read receipts, the
 * catalogue publisher's timestamps, the log itself. Never logged or binned.
 */
const IGNORED_TOP = new Set([
  'activityLog',
  'recycleBin',
  'carts',
  'userTokens',
  'whatsappOtps',
  'admin',
  'counters',
]);
const IGNORED_SUB = new Set(['sessions', 'loginHistory', 'trustedDevices', 'auditLog', 'history', 'callerCandidates', 'calleeCandidates']);

export function splitPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  return {
    top: parts[0] || '',
    /** The collection the document sits in (last collection segment). */
    collection: parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '',
    docId: parts[parts.length - 1] || '',
  };
}

export function isAudited(path: string): boolean {
  const { top, collection } = splitPath(path);
  if (!top || IGNORED_TOP.has(top) || IGNORED_SUB.has(collection)) return false;
  // Unread counters and read receipts on chats change constantly; only notes and
  // deletions in a conversation are worth recording.
  if (top === 'whatsappThreads' && collection === top) return false;
  return true;
}

export function sectionFor(path: string): string {
  const { top } = splitPath(path);
  return SECTION_BY_COLLECTION[top] || top;
}

/** A human name for a document: its name, title or code, else the id. */
export function labelFor(data: Record<string, unknown> | undefined | null, docId: string): string {
  const d = data || {};
  for (const k of ['name', 'title', 'displayName', 'code', 'username', 'orderId', 'email', 'heading', 'label', 'question']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 120);
  }
  return docId;
}

/** Field names an update touched, without values (values can be personal data). */
export function changedFields(data: Record<string, unknown> | undefined | null): string[] {
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data)
    .filter((k) => !['updatedAt', 'updatedBy', 'createdAt'].includes(k))
    .slice(0, 25);
}
