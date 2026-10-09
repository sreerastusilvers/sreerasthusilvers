/**
 * Team access: which admin pages a staff login may open.
 *
 * A team member is a `users/{uid}` document with `role: 'staff'`, a
 * `staffRole` label and a `permissions` list of the keys below. The same keys
 * are checked in three places, so keep them in step:
 *   - here (sidebar + AdminRoute),
 *   - firestore.rules (`can('<key>')`),
 *   - api/whatsapp-reply.ts and api/media.ts (server actions).
 *
 * Pages not listed here (Team, Activity, Recycle bin, Dealers setup, Settings)
 * are owner-only.
 */

export type PermissionKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'customers'
  | 'coupons'
  | 'giftCards'
  | 'videoCalls'
  | 'newsletter'
  | 'silverRate'
  | 'commerce'
  | 'aiTools'
  | 'marketing'
  | 'whatsapp'
  | 'dealerChats'
  | 'content'
  | 'storage';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  hint: string;
  /** Admin routes (prefixes) this permission opens. */
  paths: string[];
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'dealerChats', label: 'Dealer chats', hint: 'Raise tickets and chat with manufacturers by their display name', paths: ['/admin/dealer-chats'] },
  { key: 'dashboard', label: 'Dashboard', hint: 'Sales and order figures', paths: ['/admin/dashboard'] },
  { key: 'products', label: 'Products', hint: 'Add, edit and remove products and categories', paths: ['/admin/products', '/admin/media'] },
  { key: 'orders', label: 'Orders', hint: 'View and update orders', paths: ['/admin/orders'] },
  { key: 'customers', label: 'Customers', hint: 'Customer list and details (personal data)', paths: ['/admin/customers'] },
  { key: 'coupons', label: 'Coupons', hint: 'Create and edit coupon codes', paths: ['/admin/coupons'] },
  { key: 'giftCards', label: 'Gift cards', hint: 'Issue and manage gift cards', paths: ['/admin/gift-cards'] },
  { key: 'videoCalls', label: 'Video calls', hint: 'Answer video call requests', paths: ['/admin/video-calls'] },
  { key: 'newsletter', label: 'Newsletter', hint: 'Newsletter subscribers', paths: ['/admin/newsletter'] },
  { key: 'silverRate', label: 'Silver rate', hint: 'Daily silver price', paths: ['/admin/silver-rate'] },
  { key: 'commerce', label: 'Commerce settings', hint: 'Delivery, GST, support and offers', paths: ['/admin/commerce-settings'] },
  { key: 'aiTools', label: 'AI prompts and image tools', hint: 'AI prompts and image compressor', paths: ['/admin/image-prompts', '/admin/image-compressor'] },
  { key: 'marketing', label: 'Marketing', hint: 'Announcements, notifications and WhatsApp templates', paths: ['/admin/marketing'] },
  { key: 'whatsapp', label: 'Customer WhatsApp inbox', hint: 'Chat with customers (shows their numbers)', paths: ['/admin/whatsapp'] },
  {
    key: 'content',
    label: 'Website content',
    hint: 'Banners, home page, showcases, testimonials, gallery, videos, reviews, site settings',
    paths: [
      '/admin/banners',
      '/admin/home-banners',
      '/admin/home-collections',
      '/admin/showcases',
      '/admin/testimonials',
      '/admin/gallery',
      '/admin/videos',
      '/admin/reviews',
      '/admin/site-settings',
    ],
  },
  { key: 'storage', label: 'Storage', hint: 'Image storage usage', paths: ['/admin/storage'] },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export type StaffRole = 'staff' | 'website_manager';

export const STAFF_ROLES: Array<{ value: StaffRole; label: string; hint: string; defaults: PermissionKey[] }> = [
  {
    value: 'staff',
    label: 'Staff',
    hint: 'Handles customer enquiries and talks to manufacturers through dealer chats.',
    defaults: ['dealerChats'],
  },
  {
    value: 'website_manager',
    label: 'Website manager',
    hint: 'Looks after the pages you pick. Everything they change or remove shows in Activity and the Recycle bin.',
    defaults: ['products', 'content'],
  },
];

export const staffRoleLabel = (r?: string | null) => STAFF_ROLES.find((x) => x.value === r)?.label || 'Team member';

/** The permission an admin route needs, or null when only the owner may open it. */
export function permissionForPath(pathname: string): PermissionKey | null {
  const path = pathname.replace(/\/+$/, '');
  for (const p of PERMISSIONS) {
    if (p.paths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return p.key;
  }
  return null;
}

export function cleanPermissions(list: unknown): PermissionKey[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((k): k is PermissionKey => PERMISSION_KEYS.includes(k as PermissionKey)))];
}

/** The first page a team member can open, for redirects after login. */
export function firstAllowedPath(perms: PermissionKey[]): string | null {
  for (const p of PERMISSIONS) if (perms.includes(p.key)) return p.paths[0];
  return null;
}
