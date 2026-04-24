import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Smart scroll behavior:
 *  - On forward (PUSH / REPLACE) navigation -> scroll to top.
 *  - On back/forward (POP) navigation -> restore the previously saved scroll
 *    position for that path (so clicking a footer link and pressing back
 *    returns the user to the footer, not the hero).
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  const positionsRef = useRef<Map<string, number>>(new Map());
  const lastKeyRef = useRef<string>(`${pathname}${search}`);

  // Track scroll position for the currently visible route.
  useEffect(() => {
    const key = `${pathname}${search}`;
    const handleScroll = () => {
      positionsRef.current.set(key, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [pathname, search]);

  // Decide where to scroll on navigation.
  useEffect(() => {
    const key = `${pathname}${search}`;

    // Save the scroll position of the page we're leaving.
    positionsRef.current.set(lastKeyRef.current, window.scrollY);
    lastKeyRef.current = key;

    if (navType === 'POP') {
      const saved = positionsRef.current.get(key) ?? 0;
      // Defer to next paint so the new page has rendered.
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, left: 0, behavior: 'auto' });
      });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [pathname, search, navType]);

  return null;
}
