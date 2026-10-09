import { Gift } from 'lucide-react';
import { useJewelleryOfferSettings } from '@/services/jewelleryOfferService';
import { isOfferLive, normCategory } from '@/lib/jewelleryOffer';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Product page: the offer's tiers, shown only on products that count towards it. */
export function JewelleryOfferNote({ category }: { category?: string | null }) {
  const s = useJewelleryOfferSettings();
  if (!isOfferLive(s)) return null;
  if (!s.qualifyingCategories.some((c) => normCategory(c) === normCategory(category))) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-400/25 dark:bg-amber-400/[0.07] md:p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-foreground">{s.title}</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {[...s.tiers].reverse().map((t) => (
              <li key={t.minSpend}>
                Jewellery above <span className="font-medium text-foreground">{rupees(t.minSpend)}</span>: any product free up to{' '}
                <span className="font-medium text-foreground">{rupees(t.credit)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Add both to your cart; the free item is picked at checkout. If it costs more, you pay only the difference.
            {s.terms ? ` ${s.terms}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
