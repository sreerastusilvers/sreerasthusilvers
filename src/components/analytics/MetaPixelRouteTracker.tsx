import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isMetaPixelEnabled, isMetaPixelLoaded, isTrackablePath, trackPageView } from '@/lib/metaPixel';

/**
 * Sends a Meta Pixel PageView on first load and on every client-side route
 * change. A short wait collapses redirect hops (/jewelry -> /category/jewellery)
 * into one PageView for the page the visitor actually lands on.
 * Admin/delivery/auth-code pages are skipped inside trackPageView.
 */
export function MetaPixelRouteTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!isMetaPixelEnabled()) return;
    // Meta's script must never run inside staff/private pages: if it was loaded
    // on a shop page and the visitor moves to one in the same tab, reload so
    // that page starts clean (the pixel only loads on trackable paths).
    if (!isTrackablePath(pathname)) {
      if (isMetaPixelLoaded()) window.location.reload();
      return;
    }
    const timer = window.setTimeout(trackPageView, 300);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

/**
 * <Navigate replace> that keeps the query string and hash, so ad links
 * (utm_*, fbclid) survive in-app redirects.
 */
export function NavigateKeepQuery({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
