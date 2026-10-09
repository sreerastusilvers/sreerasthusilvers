import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Gift, IndianRupee, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/errorMessage';
import {
  computeJewelleryOffer,
  isOfferLive,
  sanitizeOfferSettings,
  type JewelleryOfferSettings,
} from '@/lib/jewelleryOffer';
import { saveJewelleryOffer, subscribeJewelleryOffer } from '@/services/jewelleryOfferService';
import { getCategories } from '@/services/categoryService';

const toDateInput = (ms?: number | null) => {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const Card = ({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => (
  <div className="bg-white dark:bg-gray-900 border border-[#F5EFE6] dark:border-gray-800 rounded-2xl p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-900/20 grid place-items-center text-amber-700 dark:text-amber-400">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

/** Admin → Commerce → Offers: the jewellery spend offer (siteSettings/jewelleryOffer). */
export default function JewelleryOfferSettingsPanel() {
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<JewelleryOfferSettings | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [trial, setTrial] = useState({ jewellery: 100000, other: 20000 });

  useEffect(() => {
    // Load into the form once; later remote edits must not overwrite typing.
    let first = true;
    const unsub = subscribeJewelleryOffer((v) => {
      if (!first) return;
      first = false;
      setS(v);
    });
    getCategories()
      .then((cats) => setCategories([...new Set(cats.map((c) => c.name).filter(Boolean))]))
      .catch(() => setCategories(['Jewellery']));
    return unsub;
  }, []);

  if (!s) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
      </div>
    );
  }

  const update = (patch: Partial<JewelleryOfferSettings>) => setS((p) => (p ? { ...p, ...patch } : p));
  const setTier = (i: number, patch: Partial<{ minSpend: number; credit: number }>) =>
    update({ tiers: s.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const clean = sanitizeOfferSettings(s);
  const live = isOfferLive(clean);
  const example = computeJewelleryOffer(
    { ...clean, enabled: true, startsAt: null, endsAt: null },
    [
      { productId: 'jewellery', category: clean.qualifyingCategories[0] || 'Jewellery', unitPrice: trial.jewellery, quantity: 1 },
      { productId: 'other', category: '__not_counted__', unitPrice: trial.other, quantity: 1 },
    ],
    { giftProductId: 'other' },
  );

  const handleSave = async () => {
    if (clean.tiers.length === 0) {
      toast.error('Add at least one tier with a spend and a credit above zero.');
      return;
    }
    if (clean.qualifyingCategories.length === 0) {
      toast.error('Pick at least one category that counts towards the spend.');
      return;
    }
    if (clean.startsAt && clean.endsAt && clean.endsAt < clean.startsAt) {
      toast.error('The end date is before the start date.');
      return;
    }
    setSaving(true);
    try {
      await saveJewelleryOffer(s);
      setS(clean);
      toast.success(clean.enabled ? 'Offer saved and switched on' : 'Offer saved (switched off)');
    } catch (e) {
      toast.error('Could not save the offer', { description: describeError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Jewellery spend offer"
        subtitle="Buy jewellery above a tier and one product in the same order is free up to that tier's credit. If that product costs more, the credit comes off its price and the shopper pays the rest."
        icon={Gift}
      >
        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Offer is {s.enabled ? 'on' : 'off'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {s.enabled
                ? live
                  ? 'Shoppers see it in the cart and at checkout, and the server applies it to the payment.'
                  : 'Switched on, but today is outside its dates, so nobody gets it right now.'
                : 'Nobody gets the offer until you switch it on and save.'}
            </p>
          </div>
          <Switch checked={s.enabled} onCheckedChange={(v) => update({ enabled: v })} aria-label="Offer on or off" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="offer-title" className="text-xs">Name shown to shoppers</Label>
            <Input id="offer-title" value={s.title} maxLength={80} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="offer-start" className="text-xs">Starts (optional)</Label>
            <Input
              id="offer-start"
              type="date"
              value={toDateInput(s.startsAt)}
              onChange={(e) => update({ startsAt: e.target.value ? new Date(`${e.target.value}T00:00:00`).getTime() : null })}
            />
          </div>
          <div>
            <Label htmlFor="offer-end" className="text-xs">Ends (optional, includes that whole day)</Label>
            <Input
              id="offer-end"
              type="date"
              value={toDateInput(s.endsAt)}
              onChange={(e) => update({ endsAt: e.target.value ? new Date(`${e.target.value}T23:59:59`).getTime() : null })}
            />
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Tiers</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            The highest tier the jewellery reaches applies. The free item itself never counts towards the spend.
          </p>
          <div className="space-y-2">
            {s.tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
                <div className="min-w-[140px] flex-1">
                  <Label htmlFor={`tier-spend-${i}`} className="text-xs">Jewellery bought (₹, at least)</Label>
                  <Input id={`tier-spend-${i}`} type="number" min={0} inputMode="numeric" value={t.minSpend || ''} onChange={(e) => setTier(i, { minSpend: Number(e.target.value) })} />
                </div>
                <div className="min-w-[140px] flex-1">
                  <Label htmlFor={`tier-credit-${i}`} className="text-xs">Free product worth (₹, up to)</Label>
                  <Input id={`tier-credit-${i}`} type="number" min={0} inputMode="numeric" value={t.credit || ''} onChange={(e) => setTier(i, { credit: Number(e.target.value) })} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label={`Remove tier ${i + 1}`} onClick={() => update({ tiers: s.tiers.filter((_, j) => j !== i) })}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => update({ tiers: [...s.tiers, { minSpend: 0, credit: 0 }] })}>
            <Plus className="w-4 h-4" /> Add tier
          </Button>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Categories that count towards the spend</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">The free item can be any product in the store.</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set([...categories, ...s.qualifyingCategories])].map((name) => {
              const on = s.qualifyingCategories.some((c) => c.toLowerCase() === name.toLowerCase());
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    update({
                      qualifyingCategories: on
                        ? s.qualifyingCategories.filter((c) => c.toLowerCase() !== name.toLowerCase())
                        : [...s.qualifyingCategories, name],
                    })
                  }
                  className={`min-h-9 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                    on
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Allow with coupons</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              When off, a shopper who applies a coupon doesn't get the free item in that order.
            </p>
          </div>
          <Switch checked={s.combineWithCoupons} onCheckedChange={(v) => update({ combineWithCoupons: v })} aria-label="Allow with coupons" />
        </div>

        <div className="mt-4">
          <Label htmlFor="offer-terms" className="text-xs">Terms (optional, shown on jewellery product pages)</Label>
          <Textarea
            id="offer-terms"
            rows={3}
            value={s.terms || ''}
            onChange={(e) => update({ terms: e.target.value })}
            placeholder="For example: one free product per order."
          />
        </div>
      </Card>

      <Card title="Try it" subtitle="See what a shopper would get. Uses the tiers above, even before you save." icon={IndianRupee}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="try-j" className="text-xs">Jewellery in the cart (₹)</Label>
            <Input id="try-j" type="number" min={0} value={trial.jewellery} onChange={(e) => setTrial((t) => ({ ...t, jewellery: Number(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label htmlFor="try-o" className="text-xs">Price of the product they want free (₹)</Label>
            <Input id="try-o" type="number" min={0} value={trial.other} onChange={(e) => setTrial((t) => ({ ...t, other: Number(e.target.value) || 0 }))} />
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-800 dark:text-gray-200" aria-live="polite">
          {example.discount > 0
            ? `Credit ${inr(example.credit)}: ${inr(example.discount)} comes off the product, so the shopper pays ${inr(trial.jewellery + trial.other - example.discount)} in total${
                trial.other > example.credit ? ` (${inr(trial.other - example.credit)} of it for the product).` : ' and the product is free.'
              }`
            : example.nextTier
              ? `No credit yet. ${inr(example.shortfall)} more jewellery reaches the ${inr(example.nextTier.credit)} tier.`
              : 'Add a tier to see an example.'}
        </p>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save offer
        </Button>
      </div>
    </div>
  );
}
