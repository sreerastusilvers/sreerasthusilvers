import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { SmartImage } from '@/components/ui/smart-image';
import { dismissCartFeedback, useCartFeedback, type CartFeedbackEvent } from './cartFeedback';

/**
 * The one add-to-cart confirmation for the whole store.
 *
 * Desktop (lg+): a compact panel anchored top-right, just under the sticky
 * header, with the item, the cart subtotal and View cart / Checkout.
 * Phones and tablets: the same content as a bottom sheet, swipe down to close.
 *
 * It never takes focus. Screen readers hear the result through a polite live
 * region; keyboard users can jump into it with Alt+C, and Escape closes it and
 * returns focus. It closes by itself after a few seconds, but holds while the
 * pointer is over it, while it has focus, or while the tab is hidden.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const ADDED_MS = 4000;
const ERROR_MS = 6000;
const DESKTOP_QUERY = '(min-width: 1024px)';
const BRAND = '#832729';

const formatPrice = (value: number) => `₹${value.toLocaleString('en-IN')}`;

const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );

/** Bottom edge of whichever site header is stuck at the top right now. */
const headerBottom = () => {
  let bottom = 0;
  document.querySelectorAll('header').forEach((header) => {
    const rect = header.getBoundingClientRect();
    if (rect.height > 0 && rect.top < 160 && rect.bottom > bottom) bottom = rect.bottom;
  });
  return Math.min(Math.max(bottom, 0), 220);
};

/** Give the header cart badges a small bump so the count change is noticed. */
const bumpCartBadges = () => {
  document.querySelectorAll<HTMLElement>('[data-cart-badge]').forEach((badge) => {
    if (badge.getClientRects().length === 0 || typeof badge.animate !== 'function') return;
    badge.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }],
      { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  });
};

const CartConfirmation = () => {
  const event = useCartFeedback();
  const { items, subtotal, totalItems, isCartOpen, openCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [top, setTop] = useState(84);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const panelRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<Animation | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const eventId = event?.id ?? 0;

  // New event: place the panel, remember where focus was, bump the badge and
  // tell screen readers. Totals are read after the cart state has committed.
  useEffect(() => {
    if (!event) return;
    setTop(headerBottom() + 12);

    const active = document.activeElement as HTMLElement | null;
    if (active && !panelRef.current?.contains(active)) returnFocusRef.current = active;

    if (event.kind === 'added' && !reduceMotion) requestAnimationFrame(bumpCartBadges);

    // Totals are only quoted once the saved cart has loaded; a click in the
    // first moment after page load would otherwise announce a partial cart.
    const text = event.kind === 'added'
      ? `Added ${event.quantity > 1 ? `${event.quantity} of ` : ''}${event.item.name} to your cart.` +
        (cartLoading ? '' : ` Your cart has ${totalItems} ${totalItems === 1 ? 'item' : 'items'}, subtotal ${formatPrice(subtotal)}.`)
      : `${event.title}. ${event.message}`;
    setAnnouncement('');
    const frame = requestAnimationFrame(() => setAnnouncement(text));
    return () => cancelAnimationFrame(frame);
    // Only when a new event arrives; totals are read at that moment on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // The countdown is the progress bar's own animation: one clock for both
  // what the shopper sees and when the panel closes.
  useEffect(() => {
    const bar = barRef.current;
    if (!event || !bar || typeof bar.animate !== 'function') return;
    const animation = bar.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration: event.kind === 'error' ? ERROR_MS : ADDED_MS, easing: 'linear', fill: 'forwards' },
    );
    animation.onfinish = () => dismissCartFeedback();
    timerRef.current = animation;
    return () => {
      animation.onfinish = null;
      animation.cancel();
      if (timerRef.current === animation) timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, isDesktop]);

  const paused = hovered || focusWithin || dragging || tabHidden;
  useEffect(() => {
    const animation = timerRef.current;
    if (!animation) return;
    if (paused) animation.pause();
    else if (animation.playState === 'paused') animation.play();
  }, [paused, eventId, isDesktop]);

  // Hover and focus state die with the panel; without this a panel closed
  // while hovered would leave the next one paused forever.
  useEffect(() => {
    if (event) return;
    setHovered(false);
    setFocusWithin(false);
    setDragging(false);
  }, [event]);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Leaving the page or opening the cart drawer makes the panel redundant.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    dismissCartFeedback();
  }, [location.pathname]);

  useEffect(() => {
    if (isCartOpen) dismissCartFeedback();
  }, [isCartOpen]);

  // Alt+C moves focus into the panel (it is never taken automatically).
  useEffect(() => {
    if (!event) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') {
        const target = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')
          ?? panelRef.current?.querySelector<HTMLElement>('button');
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event]);

  const close = (restoreFocus: boolean) => {
    const hadFocus = panelRef.current?.contains(document.activeElement) ?? false;
    dismissCartFeedback();
    if (restoreFocus && hadFocus && returnFocusRef.current?.isConnected) {
      returnFocusRef.current.focus();
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    }
  };

  const goToCart = () => {
    dismissCartFeedback();
    if (isDesktop) openCart();
    else navigate('/checkout');
  };

  const goToCheckout = () => {
    dismissCartFeedback();
    if (!user) navigate('/login', { state: { from: { pathname: '/checkout' } } });
    else navigate('/checkout');
  };

  const sharedProps = {
    ref: panelRef,
    role: 'region' as const,
    'aria-label': 'Cart update',
    'aria-keyshortcuts': 'Alt+C',
    onKeyDown,
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onFocus: () => setFocusWithin(true),
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
    },
  };

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <AnimatePresence>
        {event && isDesktop && (
          <motion.section
            key="cart-confirmation-desktop"
            {...sharedProps}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-8px) scale(0.97)' }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, transform: 'translateY(0px) scale(1)' }}
            exit={reduceMotion
              ? { opacity: 0, transition: { duration: 0.15 } }
              : { opacity: 0, transform: 'translateY(-4px) scale(0.98)', transition: { duration: 0.15, ease: EASE_OUT } }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            style={{ top, transformOrigin: 'top right' }}
            className="fixed right-4 xl:right-6 z-[60] w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_16px_48px_-16px_rgba(0,0,0,0.28)] dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.7)]"
            data-testid="cart-confirmation"
          >
            <PanelBody
              event={event}
              items={items}
              subtotal={subtotal}
              totalItems={totalItems}
              cartLoading={cartLoading}
              compact={false}
              onClose={() => close(true)}
              onSecondary={event.kind === 'error' ? () => close(true) : goToCart}
              onPrimary={event.kind === 'error' ? goToCart : goToCheckout}
              secondaryLabel={event.kind === 'error' ? 'OK' : 'View cart'}
              primaryLabel={event.kind === 'error' ? 'View cart' : 'Checkout'}
            />
            <ProgressBar barRef={barRef} hidden={!!reduceMotion} />
          </motion.section>
        )}

        {event && !isDesktop && (
          <motion.section
            key="cart-confirmation-mobile"
            {...sharedProps}
            initial={reduceMotion ? { opacity: 0 } : { y: '110%' }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion
              ? { opacity: 0, transition: { duration: 0.15 } }
              : { y: '110%', transition: { duration: 0.2, ease: EASE_OUT } }}
            transition={{ duration: 0.32, ease: EASE_DRAWER }}
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.7 }}
            dragSnapToOrigin
            onDragStart={() => setDragging(true)}
            onDragEnd={(_, info) => {
              setDragging(false);
              if (info.offset.y > 56 || info.velocity.y > 450) dismissCartFeedback();
            }}
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', touchAction: 'none' }}
            className="fixed inset-x-3 z-[70] mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.35)] dark:shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.8)]"
            data-testid="cart-confirmation"
          >
            <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-muted-foreground/30" />
            <PanelBody
              event={event}
              items={items}
              subtotal={subtotal}
              totalItems={totalItems}
              cartLoading={cartLoading}
              compact
              onClose={() => close(true)}
              onSecondary={() => close(true)}
              onPrimary={goToCart}
              secondaryLabel={event.kind === 'error' ? 'OK' : 'Keep shopping'}
              primaryLabel={event.kind === 'error' ? 'View cart' : 'Go to checkout'}
            />
            <ProgressBar barRef={barRef} hidden={!!reduceMotion} />
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
};

const ProgressBar = ({ barRef, hidden }: { barRef: React.MutableRefObject<HTMLDivElement | null>; hidden: boolean }) => (
  <div aria-hidden="true" className={`h-[3px] bg-border/50 ${hidden ? 'opacity-0' : ''}`}>
    <div ref={barRef} className="h-full origin-left bg-[#832729]/70 dark:bg-[#e3a9aa]/70" />
  </div>
);

interface PanelBodyProps {
  event: CartFeedbackEvent;
  items: ReturnType<typeof useCart>['items'];
  subtotal: number;
  totalItems: number;
  cartLoading: boolean;
  compact: boolean;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}

const PanelBody = ({
  event, items, subtotal, totalItems, cartLoading, compact, onClose, onPrimary, onSecondary, primaryLabel, secondaryLabel,
}: PanelBodyProps) => {
  const isError = event.kind === 'error';
  const item = event.item;
  // Prefer the live cart line: the cart re-prices against the live silver
  // rate, so its figure is the one checkout will charge.
  const line = item ? items.find((i) => i.id === item.id) : undefined;
  const unitPrice = line?.price ?? item?.price ?? 0;
  const addedQty = event.kind === 'added' ? event.quantity : 0;
  const lineQty = event.kind === 'added' ? (line?.quantity ?? event.lineQuantity) : line?.quantity ?? 0;
  const details = [item?.weight, item?.purity].filter(Boolean) as string[];

  const buttonBase = `inline-flex items-center justify-center min-w-0 whitespace-nowrap rounded-full ${compact ? 'px-4' : 'px-5'} text-sm font-medium transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover ${compact ? 'h-12' : 'h-11'}`;

  return (
    <motion.div
      key={event.id}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={compact ? 'px-4 pb-4 pt-2' : 'px-4 pb-4 pt-3.5'}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${isError ? 'bg-amber-600' : 'bg-emerald-600'}`}
          aria-hidden="true"
        >
          {isError ? <AlertCircle className="h-4 w-4" strokeWidth={2.5} /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
        <p className="text-sm font-semibold text-foreground">
          {isError ? event.title : 'Added to your cart'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cart update"
          className={`-mr-2 ml-auto grid ${compact ? "h-11 w-11" : "h-9 w-9"} place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {item && (
        <div className="mt-3 flex gap-3">
          <div className={`${compact ? 'h-14 w-14' : 'h-16 w-16'} shrink-0 overflow-hidden rounded-lg bg-muted`}>
            <SmartImage src={item.image} alt="" preset="thumb" priority className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{item.name}</p>
            {!isError && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[`Qty ${addedQty}`, ...details].join(' · ')}
                {lineQty > addedQty && <> · {lineQty} in cart</>}
              </p>
            )}
            {!isError && (
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                {formatPrice(unitPrice * addedQty)}
              </p>
            )}
          </div>
        </div>
      )}

      {isError && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{event.message}</p>
      )}

      {!isError && (
        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">
            {cartLoading ? 'Cart subtotal' : `Cart subtotal (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`}
          </span>
          {/* Until the saved cart has loaded the totals would be partial. */}
          <span className="font-semibold tabular-nums text-foreground">
            {cartLoading ? <span className="font-normal text-muted-foreground">Updating…</span> : formatPrice(subtotal)}
          </span>
        </div>
      )}

      <div className={`mt-3 grid gap-2 ${compact && !isError ? 'grid-cols-[auto_minmax(0,1fr)]' : 'grid-cols-2'}`}>
        <button
          type="button"
          onClick={onSecondary}
          className={`${buttonBase} border border-border bg-background text-foreground hover:bg-muted`}
        >
          {secondaryLabel}
        </button>
        <button
          type="button"
          data-autofocus
          onClick={onPrimary}
          className={`${buttonBase} text-white hover:brightness-110`}
          style={{ backgroundColor: BRAND }}
        >
          {primaryLabel}
        </button>
      </div>
    </motion.div>
  );
};

export default CartConfirmation;
