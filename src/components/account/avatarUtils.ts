import type { User } from 'firebase/auth';
import { isManagedImageUrl } from '@/lib/mediaUrl';

/**
 * Profile photo rules.
 *
 * `users/{uid}.avatar` holds either a photo the customer uploaded (stored
 * through /api/media, or a legacy Cloudinary / Firebase Storage URL) or a copy
 * of their Google photo. An uploaded photo always wins; removing it falls back
 * to the Google photo, then to initials.
 */
export const isCustomAvatarUrl = (url: string | null | undefined): url is string =>
  !!url && (isManagedImageUrl(url) || url.includes('cloudinary') || url.includes('firebasestorage'));

/** The photo Google gave this account, if they ever signed in with Google. */
export const googlePhotoOf = (user: User | null | undefined): string | null =>
  user?.providerData.find((p) => p.providerId === 'google.com')?.photoURL || user?.photoURL || null;

/** "Govardhan Reddy" -> "GR", "govardhan" -> "G". */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  const first = Array.from(parts[0])[0] ?? '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? '' : '';
  return (first + last).toUpperCase() || 'U';
};

/** Size of the square avatar we upload (px). Shown at 112px max, so 2x+ for sharp screens. */
export const AVATAR_EDGE = 400;
