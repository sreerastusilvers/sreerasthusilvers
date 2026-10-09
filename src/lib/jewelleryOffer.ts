/**
 * Jewellery spend offer: buy jewellery worth a tier's amount and one product in
 * the same order is free up to that tier's credit.
 *
 *   Jewellery ≥ ₹1,00,000 → ₹30,000 credit
 *   Jewellery ≥ ₹50,000   → ₹15,000 credit
 *   Jewellery ≥ ₹25,000   → ₹7,000 credit
 *
 * The credit is spent on ONE unit of ONE product (the "free item"). If that
 * product costs more than the credit, the credit comes off its price and the
 * customer pays the rest. Any product can be the free item; only lines in a
 * qualifying category count towards the spend, and the free unit itself never
 * counts (otherwise a ₹30,000 ring would "unlock" its own discount).
 *
 * PURE and dependency-free on purpose: api/create-order.ts carries an exact copy
 * of `computeJewelleryOffer` (Vercel functions here cannot import from src/),
 * and scripts/tests/jewellery-offer.test.mjs checks the two agree.
 */

export interface OfferTier {
  /** Qualifying spend needed, in rupees. */
  minSpend: number;
  /** Credit towards the free item, in rupees. */
  credit: number;
}

export interface JewelleryOfferSettings {
  enabled: boolean;
  title: string;
  tiers: OfferTier[];
  /** Category names or slugs whose items count towards the spend. */
  qualifyingCategories: string[];
  /** When false, applying a coupon switches the offer off for that order. */
  combineWithCoupons: boolean;
  /** Optional window, epoch milliseconds. */
  startsAt?: number | null;
  endsAt?: number | null;
  terms?: string;
}

export const DEFAULT_JEWELLERY_OFFER: JewelleryOfferSettings = {
  enabled: false,
  title: 'Jewellery Offer: a free product on us',
  tiers: [
    { minSpend: 25000, credit: 7000 },
    { minSpend: 50000, credit: 15000 },
    { minSpend: 100000, credit: 30000 },
  ],
  qualifyingCategories: ['Jewellery'],
  combineWithCoupons: false,
  startsAt: null,
  endsAt: null,
  terms: '',
};

export interface OfferLine {
  productId: string;
  category?: string | null;
  /** Price of one unit, in rupees. */
  unitPrice: number;
  quantity: number;
}

export interface OfferOptions {
  /** The product the customer picked as the free item; best one is chosen when absent. */
  giftProductId?: string | null;
  couponApplied?: boolean;
  now?: number;
}

export interface OfferResult {
  /** Switched on and inside its dates. */
  live: boolean;
  /** Qualifying spend, not counting the free unit. */
  qualifyingSpend: number;
  tier: OfferTier | null;
  credit: number;
  /**
   * Tier the cart's whole qualifying spend reaches. When no line can be the
   * free item yet (a lone ₹30,000 ring cannot pay for itself), this is the
   * credit an extra product would get.
   */
  unlocked: OfferTier | null;
  /** The next tier up and how much more jewellery reaches it. */
  nextTier: OfferTier | null;
  shortfall: number;
  giftProductId: string | null;
  giftUnitPrice: number;
  /** Rupees taken off the order total. */
  discount: number;
  /** The offer would apply but a coupon is used and they do not combine. */
  blockedByCoupon: boolean;
}

/** "Jewellery", "jewellery", "JEWELRY" and "jewelry" all compare equal. */
export function normCategory(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/jewelry/g, 'jewellery');
}

export function sanitizeOfferSettings(raw: unknown): JewelleryOfferSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const tiers = (Array.isArray(r.tiers) ? r.tiers : DEFAULT_JEWELLERY_OFFER.tiers)
    .map((t: any) => ({ minSpend: Math.max(0, num(t?.minSpend)), credit: Math.max(0, num(t?.credit)) }))
    .filter((t: OfferTier) => t.minSpend > 0 && t.credit > 0)
    .sort((a: OfferTier, b: OfferTier) => a.minSpend - b.minSpend);
  const cats = Array.isArray(r.qualifyingCategories)
    ? r.qualifyingCategories.map((c: unknown) => String(c ?? '').trim()).filter(Boolean)
    : DEFAULT_JEWELLERY_OFFER.qualifyingCategories;
  const ms = (v: any): number | null => {
    if (v == null || v === '') return null;
    if (typeof v?.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    enabled: r.enabled === true,
    title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : DEFAULT_JEWELLERY_OFFER.title,
    tiers,
    qualifyingCategories: cats,
    combineWithCoupons: r.combineWithCoupons === true,
    startsAt: ms(r.startsAt),
    endsAt: ms(r.endsAt),
    terms: typeof r.terms === 'string' ? r.terms : '',
  };
}

export function isOfferLive(s: JewelleryOfferSettings, now = Date.now()): boolean {
  if (!s.enabled || s.tiers.length === 0) return false;
  if (s.startsAt && now < s.startsAt) return false;
  if (s.endsAt && now > s.endsAt) return false;
  return true;
}

export function computeJewelleryOffer(
  settings: JewelleryOfferSettings,
  lines: OfferLine[],
  opts: OfferOptions = {},
): OfferResult {
  const now = opts.now ?? Date.now();
  const tiers = [...settings.tiers].sort((a, b) => a.minSpend - b.minSpend);
  const allowed = new Set(settings.qualifyingCategories.map(normCategory));
  const clean = lines
    .map((l) => ({
      productId: String(l.productId),
      qualifies: allowed.has(normCategory(l.category)),
      unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      quantity: Math.max(0, Math.floor(Number(l.quantity) || 0)),
    }))
    .filter((l) => l.quantity > 0);

  const totalSpend = clean.reduce((s, l) => s + (l.qualifies ? l.unitPrice * l.quantity : 0), 0);
  const tierFor = (spend: number) => {
    let hit: OfferTier | null = null;
    for (const t of tiers) if (spend >= t.minSpend) hit = t;
    return hit;
  };
  const nextFor = (spend: number) => tiers.find((t) => spend < t.minSpend) || null;

  const base: OfferResult = {
    live: isOfferLive(settings, now),
    qualifyingSpend: totalSpend,
    tier: null,
    credit: 0,
    unlocked: tierFor(totalSpend),
    nextTier: nextFor(totalSpend),
    shortfall: 0,
    giftProductId: null,
    giftUnitPrice: 0,
    discount: 0,
    blockedByCoupon: false,
  };
  base.shortfall = base.nextTier ? base.nextTier.minSpend - totalSpend : 0;
  if (!base.live || clean.length === 0) return base;

  // Score every line as the free item; the requested one wins when it is in the cart.
  const scored = clean
    .filter((l) => l.unitPrice > 0)
    .map((g) => {
      const spend = totalSpend - (g.qualifies ? g.unitPrice : 0);
      const tier = tierFor(spend);
      const credit = tier ? tier.credit : 0;
      return { g, spend, tier, credit, discount: Math.min(credit, g.unitPrice) };
    });
  if (scored.length === 0) return base;
  const requested = opts.giftProductId ? scored.find((x) => x.g.productId === String(opts.giftProductId)) : undefined;
  const best =
    requested ||
    [...scored].sort(
      (a, b) => b.discount - a.discount || (a.g.productId < b.g.productId ? -1 : a.g.productId > b.g.productId ? 1 : 0),
    )[0];

  if (!best.tier) return base;
  const next = nextFor(best.spend);
  const result: OfferResult = {
    ...base,
    qualifyingSpend: best.spend,
    tier: best.tier,
    credit: best.credit,
    nextTier: next,
    shortfall: next ? next.minSpend - best.spend : 0,
    giftProductId: best.g.productId,
    giftUnitPrice: best.g.unitPrice,
    discount: best.discount,
  };
  if (result.discount > 0 && opts.couponApplied && !settings.combineWithCoupons) {
    return { ...result, discount: 0, blockedByCoupon: true };
  }
  return result;
}
