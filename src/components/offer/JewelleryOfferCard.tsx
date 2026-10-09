import { Gift, Check } from 'lucide-react';
import { formatAmountINR } from '@/lib/formatPrice';
import type { CheckoutPricing } from '@/hooks/useCheckoutPricing';
import { cn } from '@/lib/utils';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * The jewellery offer as the shopper sees it in the cart and at checkout:
 * progress towards the next tier, the free item, and a picker when more than
 * one line could be the free one. Renders nothing while the offer is off.
 */
export function JewelleryOfferCard({ pricing, className }: { pricing: CheckoutPricing; className?: string }) {
  const { offer, offerSettings, offerGiftOptions, setOfferGift } = pricing;
  if (!offer.live) return null;

  const top = offerSettings.tiers[offerSettings.tiers.length - 1];
  const progressTarget = offer.nextTier?.minSpend || top?.minSpend || 1;
  const progress = Math.min(100, Math.round((offer.qualifyingSpend / progressTarget) * 100));
  const unlockedCredit = offer.unlocked?.credit || 0;

  let headline: string;
  let detail: string | null = null;
  if (offer.discount > 0) {
    const paysRest = offer.giftUnitPrice > offer.credit;
    headline = paysRest ? `${rupees(offer.discount)} off your free item` : 'Your free item is unlocked';
    detail = paysRest
      ? `Your ${rupees(offer.credit)} credit covers part of it. You pay the remaining ${rupees(offer.giftUnitPrice - offer.credit)}.`
      : `Worth ${rupees(offer.giftUnitPrice)}, free with your jewellery.`;
  } else if (offer.blockedByCoupon) {
    headline = `Your jewellery unlocks a free item worth up to ${rupees(offer.credit)}`;
    detail = 'This offer can’t be combined with a coupon. Remove the coupon to use it.';
  } else if (unlockedCredit > 0) {
    headline = `You’ve unlocked ${rupees(unlockedCredit)} of credit`;
    detail = `Add any product to your cart and it’s free up to ${rupees(unlockedCredit)}.`;
  } else if (offer.nextTier) {
    headline = `Add ${rupees(offer.shortfall)} more jewellery`;
    detail = `and get any product free, worth up to ${rupees(offer.nextTier.credit)}.`;
  } else {
    return null;
  }

  const upsell =
    offer.discount > 0 && offer.nextTier
      ? `Add ${rupees(offer.shortfall)} more jewellery to raise your credit to ${rupees(offer.nextTier.credit)}.`
      : null;

  return (
    <section
      aria-label={offerSettings.title}
      className={cn(
        'rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-400/25 dark:bg-amber-400/[0.07]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
          <Gift className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-300/80">
            {offerSettings.title}
          </p>
          <p className="mt-0.5 font-semibold text-gray-900 dark:text-zinc-100">{headline}</p>
          {detail && <p className="mt-0.5 text-gray-600 dark:text-zinc-400">{detail}</p>}
        </div>
      </div>

      {offer.discount === 0 && !offer.blockedByCoupon && unlockedCredit === 0 && (
        <div className="mt-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-amber-100 dark:bg-zinc-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Progress to the jewellery offer"
          >
            <div className="h-full rounded-full bg-amber-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-500">
            Jewellery in cart: {rupees(offer.qualifyingSpend)} of {rupees(progressTarget)}
          </p>
        </div>
      )}

      {offer.discount > 0 && offerGiftOptions.length > 1 && (
        <fieldset className="mt-3 min-w-0">
          <legend className="mb-1.5 text-xs font-medium text-gray-700 dark:text-zinc-300">Choose your free item</legend>
          <div className="space-y-1.5">
            {offerGiftOptions.map((o) => {
              const selected = o.productId === offer.giftProductId;
              return (
                <button
                  key={o.productId}
                  type="button"
                  onClick={() => setOfferGift(o.productId)}
                  aria-pressed={selected}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                    selected
                      ? 'border-amber-400 bg-white dark:border-amber-400/60 dark:bg-zinc-900'
                      : 'border-transparent bg-white/60 hover:bg-white dark:bg-zinc-900/50 dark:hover:bg-zinc-900',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 dark:border-zinc-600',
                    )}
                    aria-hidden
                  >
                    {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-800 dark:text-zinc-200">{o.name}</span>
                  <span className="shrink-0 text-xs font-medium text-green-700 dark:text-green-400">− {rupees(o.discount)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {upsell && <p className="mt-2.5 text-xs text-amber-900/80 dark:text-amber-200/80">{upsell}</p>}
    </section>
  );
}

/** "Free item (Jewellery offer)  − ₹X" for a bill summary. Matches the coupon row next to it. */
export function OfferSummaryRow({
  pricing,
  className = 'flex justify-between text-sm',
  labelClassName = 'text-green-600',
  valueClassName = 'text-green-600 font-medium tabular-nums',
}: {
  pricing: CheckoutPricing;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  if (pricing.offer.discount <= 0) return null;
  return (
    <div className={className}>
      <span className={labelClassName}>Free item (jewellery offer)</span>
      <span className={valueClassName}>− ₹ {formatAmountINR(pricing.offer.discount)}</span>
    </div>
  );
}
