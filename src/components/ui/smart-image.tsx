import { useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { cldUrl, cldSrcSet, type ImagePreset } from '@/lib/cloudinaryUrl';

const FALLBACK_SRC = '/placeholder.svg';

export interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string | undefined | null;
  /** Layout slot this image fills. Drives width, quality and srcset. */
  preset?: ImagePreset;
  /**
   * Set on images inside the initial viewport (hero, first grid row). Loads
   * eagerly with high priority instead of lazily.
   */
  priority?: boolean;
  fallbackSrc?: string;
}

/**
 * Drop-in `<img>` replacement that routes every source through the Cloudinary
 * transformer. Use this instead of a bare `<img>` for any URL that came out of
 * Firestore - see src/lib/cloudinaryUrl.ts for why.
 */
export const SmartImage = ({
  src,
  preset = 'card',
  priority = false,
  fallbackSrc = FALLBACK_SRC,
  className,
  alt = '',
  ...rest
}: SmartImageProps) => {
  const [failed, setFailed] = useState(false);

  const resolved = failed || !src ? fallbackSrc : cldUrl(src, preset);
  const srcSet = failed || !src ? undefined : cldSrcSet(src, preset);

  // React 18 does not map the camelCase `fetchPriority` prop to the DOM
  // attribute (that landed in React 19), so pass the lowercase attribute name
  // directly. Only set it when it carries meaning - "auto" is the default.
  const priorityAttr = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {};

  return (
    <img
      {...rest}
      {...priorityAttr}
      src={resolved}
      srcSet={srcSet}
      alt={alt}
      className={cn(className)}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      onError={() => setFailed(true)}
    />
  );
};

export default SmartImage;
