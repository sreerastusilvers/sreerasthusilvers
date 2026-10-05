import { useState } from 'react';
import { cn } from '@/lib/utils';
import { mediaPreviewUrl } from '@/lib/mediaUrl';
import { useAccountIdentity } from './useAccountIdentity';

interface UserAvatarProps {
  /** Rendered diameter in px. */
  size?: number;
  className?: string;
  /** Override the signed-in user's photo (e.g. while a new one is uploading). */
  src?: string | null;
  /** Decorative avatars sit next to the visible name, so they stay silent. */
  decorative?: boolean;
}

/**
 * Round profile photo for the signed-in customer. Tries the small stored
 * preview, then the full photo, then falls back to initials, so a broken or
 * expired Google photo URL never shows a broken image.
 */
const UserAvatar = ({ size = 40, className, src, decorative = true }: UserAvatarProps) => {
  const identity = useAccountIdentity();
  const photo = src === undefined ? identity.photoUrl : src;
  const candidates = [mediaPreviewUrl(photo), photo].filter((u): u is string => !!u);

  // Index into `candidates`, tied to the photo it was reached for so a new
  // photo starts fresh.
  const [failed, setFailed] = useState<{ photo: string | null; index: number }>({ photo, index: 0 });
  const index = failed.photo === photo ? failed.index : 0;
  const current = candidates[index];

  const style = { width: size, height: size };
  const ring = 'rounded-full ring-1 ring-border shrink-0 overflow-hidden';

  if (!current) {
    return (
      <span
        className={cn(
          ring,
          'inline-flex select-none items-center justify-center bg-primary font-semibold text-primary-foreground',
          className,
        )}
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.38)) }}
        {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': identity.name })}
      >
        {identity.initials}
      </span>
    );
  }

  return (
    <img
      key={current}
      src={current}
      alt={decorative ? '' : identity.name}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      decoding="async"
      className={cn(ring, 'bg-muted object-cover', className)}
      style={style}
      onError={() => setFailed({ photo, index: index + 1 })}
    />
  );
};

export default UserAvatar;
