import { useEffect, useMemo, useState } from 'react';
import {
  subscribeDeliverySettings,
  subscribeGstSettings,
  computeDeliveryCharge,
  computeGst,
  DEFAULT_DELIVERY,
  DEFAULT_GST,
  type DeliverySettings,
  type GstSettings,
  type DeliverableItem,
} from '@/services/siteSettingsService';
import {
  validateCoupon,
  subscribeCoupons,
  type Coupon,
} from '@/services/couponService';
import { getActiveProductsCached } from '@/services/productCache';

export interface CheckoutPricing {
  subtotal: number;
  deliveryCharge: number;
  freeDelivery: boolean;
  /**
   * What delivery would have cost without the free-delivery threshold. Lets the
   * summary show "~~₹150~~ FREE" with a real number instead of a hardcoded one.
   */
  deliveryBeforeFree: number;
  /** True while no address is chosen yet, so the quote may still rise. */
  deliveryEstimated: boolean;
  gstAmount: number;
  gstAddOnTop: boolean;
  discount: number;
  codCharge: number;
  total: number;
  appliedCoupon: Coupon | null;
  couponError: string | null;
  coupons: Coupon[];
  delivery: DeliverySettings;
  gst: GstSettings;
  applyCoupon: (code: string) => Promise<{ ok: boolean; reason?: string }>;
  removeCoupon: () => void;
  setIsCod: (v: boolean) => void;
}

export interface CheckoutPricingOptions {
  /** Product ids in the cart, so per-product delivery overrides are honoured. */
  productIds?: string[];
  /** Destination state from the selected address; unknown on the cart page. */
  destinationState?: string;
}

/**
 * Centralised pricing engine consumed by Checkout / MobileCheckout / cart. All
 * numbers come from admin-managed Firestore documents (siteSettings/*) so
 * editing them in /admin/commerce-settings reflects everywhere instantly.
 *
 * Coupons are validated against the `coupons` Firestore collection managed
 * via the admin panel - the single source of truth for coupon data.
 */
export function useCheckoutPricing(
  subtotal: number,
  isEmpty: boolean,
  paymentMethod: string,
  options: CheckoutPricingOptions = {}
): CheckoutPricing {
  const { productIds, destinationState } = options;

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [gst, setGst] = useState<GstSettings>(DEFAULT_GST);

  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeCoupons(setCoupons);
    const u2 = subscribeDeliverySettings(setDelivery);
    const u3 = subscribeGstSettings(setGst);
    return () => { u1?.(); u2?.(); u3?.(); };
  }, []);

  // Drop coupon if cart total drops below the coupon's minimum order value
  useEffect(() => {
    if (!appliedCoupon) return;
    if (appliedCoupon.minOrderValue && subtotal < appliedCoupon.minOrderValue) {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(`Coupon removed: minimum order of ₹${appliedCoupon.minOrderValue.toLocaleString('en-IN')} required`);
    }
  }, [subtotal, appliedCoupon]);

  /**
   * Per-product delivery overrides, resolved from the shared catalog cache.
   *
   * Cart lines only carry id/name/price, so the product's delivery config is
   * looked up here rather than duplicated into every `addToCart` call site.
   * The catalog is already cached for the session, so this costs no reads.
   */
  const idsKey = (productIds || []).join(',');
  const [deliveryByProduct, setDeliveryByProduct] = useState<Record<string, DeliverableItem>>({});

  useEffect(() => {
    let cancelled = false;
    if (!idsKey) {
      setDeliveryByProduct({});
      return;
    }
    getActiveProductsCached()
      .then((products) => {
        if (cancelled) return;
        const map: Record<string, DeliverableItem> = {};
        for (const p of products) {
          if (p.id && p.delivery) map[p.id] = { delivery: p.delivery };
        }
        setDeliveryByProduct(map);
      })
      .catch(() => {
        // Falls back to the universal charge - never blocks checkout.
      });
    return () => { cancelled = true; };
  }, [idsKey]);

  const deliveryItems = useMemo<DeliverableItem[]>(
    () => (productIds || []).map((id) => deliveryByProduct[id] || {}),
    [idsKey, deliveryByProduct] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pricing = useMemo(() => {
    if (isEmpty) {
      return {
        deliveryCharge: 0,
        freeDelivery: false,
        deliveryBeforeFree: 0,
        deliveryEstimated: false,
        gstAmount: 0,
        gstAddOnTop: false,
        codCharge: 0,
        total: 0,
      };
    }
    const { charge: deliveryCharge, freeDelivery } = computeDeliveryCharge(
      subtotal,
      delivery,
      deliveryItems,
      destinationState
    );
    const { charge: deliveryBeforeFree } = computeDeliveryCharge(
      subtotal,
      { ...delivery, freeDeliveryAbove: 0 },
      deliveryItems,
      destinationState
    );
    // `inclusive` is honoured here: when the admin says prices already contain
    // GST, `addOnTop` is false and the tax is shown as a breakdown of the
    // subtotal instead of being charged a second time. An earlier version
    // forced `inclusive: false`, so switching it on in the admin panel changed
    // the label but still added GST to the total.
    const { gstAmount, addOnTop } = computeGst(subtotal, gst);
    const total = subtotal + deliveryCharge + (addOnTop ? gstAmount : 0) - appliedDiscount;
    return {
      deliveryCharge,
      freeDelivery,
      deliveryBeforeFree,
      deliveryEstimated: !destinationState && deliveryCharge > 0,
      gstAmount,
      gstAddOnTop: addOnTop,
      codCharge: 0,
      total: Math.max(0, total),
    };
  }, [subtotal, isEmpty, delivery, gst, appliedDiscount, deliveryItems, destinationState]);

  return {
    subtotal,
    ...pricing,
    discount: appliedDiscount,
    appliedCoupon,
    couponError,
    coupons,
    delivery,
    gst,
    applyCoupon: async (code: string) => {
      const r = await validateCoupon(code, subtotal);
      if (r.valid && r.coupon) {
        setAppliedCoupon(r.coupon);
        setAppliedDiscount(r.discount || 0);
        setCouponError(null);
        return { ok: true };
      }
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(r.reason || 'Invalid coupon');
      return { ok: false, reason: r.reason };
    },
    removeCoupon: () => {
      setAppliedCoupon(null);
      setAppliedDiscount(0);
      setCouponError(null);
    },
    setIsCod: () => {}, // Cash on Delivery was retired; kept so callers still compile
  };
}
