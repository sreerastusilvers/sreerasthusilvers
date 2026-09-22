import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { couponHeadline, couponTerms, type Coupon } from '@/services/couponService';
import { toSlug } from '@/services/categoryService';
import { copyOfferCode, useBannerCoupons } from './useBannerCoupons';

/**
 * Site-wide offer ribbon, above the header.
 *
 * Until now a customer only discovered a coupon at the very last step, on the
 * checkout page. This puts the offers the admin has switched on ("Show in offer
 * banner") in front of them on every page, and tapping the code both copies it
 * and has checkout apply it automatically.
 *
 * Deliberately quiet: a slim band in the house maroon with a gold hairline,
 * rotating when there is more than one offer, pausing while hovered, and
 * dismissible for the visit. A new offer brings it back even after a dismiss.
 */

const DISMISS_KEY = 'ss:offerRibbonDismissed';
const ROTATE_MS = 5500;

/** Pages where the ribbon would be noise or would compete with the page itself. */
const HIDDEN_ON = ['/checkout', '/admin', '/delivery', '/signup', '/login', '/forgot-password'];

/** Where "Shop now" goes: the one category an offer is limited to, else everything. */
const shopLink = (c: Coupon) =>
  c.applicableCategories && c.applicableCategories.length === 1
    ? `/category/${toSlug(c.applicableCategories[0])}`
    : '/products';

const readDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISS_KEY) || '';
  } catch {
    return '';
  }
};

const OfferRibbon = () => {
  const { pathname } = useLocation();
  const offers = useBannerCoupons();
  const reduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // The set of offers the visitor dismissed. A different set - a new offer
  // switched on - shows the ribbon again.
  const signature = useMemo(() => offers.map((o) => o.id).join(','), [offers]);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (offers.length < 2 || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % offers.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [offers.length, paused]);

  // Keep the index valid when an offer is switched off mid-rotation.
  useEffect(() => {
    if (index >= offers.length) setIndex(0);
  }, [index, offers.length]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (offers.length === 0 || dismissed === signature) return null;

  const offer: Coupon = offers[Math.min(index, offers.length - 1)];
  const terms = couponTerms(offer);
  const isCopied = copied === offer.code;

  const onCopy = async () => {
    await copyOfferCode(offer.code);
    setCopied(offer.code);
    window.setTimeout(() => setCopied((c) => (c === offer.code ? null : c)), 2200);
  };

  const onDismiss = () => {
    setDismissed(signature);
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // Private mode: it stays hidden until the next page load, which is fine.
    }
  };

  return (
    <div
      role="region"
      aria-label="Current offers"
      className="offer-ribbon relative z-[60] overflow-hidden text-[#fbf3e4]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Engraved-line texture and the gold hairline that finishes the edge. */}
      <div aria-hidden className="offer-ribbon__engraving pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#e8c56a]/80 to-transparent"
      />

      <div className="relative mx-auto flex h-[38px] max-w-[1440px] items-center justify-center gap-2 px-10 sm:h-10 sm:gap-3 lg:h-[42px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={offer.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-w-0 items-center gap-2 sm:gap-3"
          >
            <span aria-hidden className="hidden text-[11px] text-[#e8c56a] sm:inline">✦</span>

            {offer.description?.trim() && (
              <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.28em] text-[#e8c56a] md:inline">
                {offer.description.trim()}
              </span>
            )}

            <span className="flex min-w-0 items-baseline gap-2">
              <span className="whitespace-nowrap font-heading text-[15px] italic leading-none [font-variant-numeric:lining-nums] sm:text-base">
                {couponHeadline(offer)}
              </span>
              {terms && (
                <span className="hidden truncate text-[11px] text-[#fbf3e4]/70 lg:inline">{terms}</span>
              )}
            </span>

            {/* The code, as a small gold ticket. Tapping it is the call to action. */}
            <button
              type="button"
              onClick={onCopy}
              className="offer-ticket group relative inline-flex flex-shrink-0 items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-[#e8c56a]/70 bg-[#e8c56a]/10 px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.18em] text-[#f3d98f] transition-colors hover:bg-[#e8c56a]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c56a]/70"
              aria-label={isCopied ? `Code ${offer.code} copied` : `Copy code ${offer.code}`}
            >
              <span aria-hidden className="offer-ticket__foil pointer-events-none absolute inset-0" />
              <span className="relative">{offer.code}</span>
              {isCopied ? (
                <Check className="relative h-3 w-3" aria-hidden />
              ) : (
                <Copy className="relative h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" aria-hidden />
              )}
            </button>

            {isCopied && (
              <span className="hidden whitespace-nowrap text-[11px] text-[#fbf3e4]/80 sm:inline">
                Copied · applied at checkout
              </span>
            )}

            {!isCopied && (
              <Link
                to={shopLink(offer)}
                className="hidden whitespace-nowrap text-[11px] font-medium text-[#fbf3e4] underline decoration-[#e8c56a]/60 underline-offset-4 transition-colors hover:text-[#f3d98f] md:inline"
              >
                Shop now →
              </Link>
            )}
          </motion.div>
        </AnimatePresence>

        <span className="sr-only" aria-live="polite">
          {isCopied ? `Code ${offer.code} copied. It will be applied at checkout.` : ''}
        </span>

        {offers.length > 1 && (
          <span aria-hidden className="absolute right-10 hidden items-center gap-1 xl:flex">
            {offers.map((o, i) => (
              <span
                key={o.id}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === index ? 'w-3 bg-[#e8c56a]' : 'w-1 bg-[#fbf3e4]/35'
                }`}
              />
            ))}
          </span>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-[#fbf3e4]/70 transition-colors hover:bg-white/10 hover:text-[#fbf3e4] sm:right-3"
          aria-label="Dismiss offers"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default OfferRibbon;
