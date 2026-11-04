# Handoff

Last updated: 2026-11-05. Older history: `docs/archive/HANDOFF-to-2026-10-13.md`.

## State
- **Meta Pixel added and pushed 2026-11-05 (`c5f00c5`, includes the /call block + staff-page reload). Live only after `VITE_META_PIXEL_ID` is set in Vercel and a redeploy.**
    - Code: `src/lib/metaPixel.ts`, `src/components/analytics/MetaPixelRouteTracker.tsx`.
    - Hooks in: `ProductDetail.tsx` (ViewContent), `CartContext.tsx` (AddToCart), `Checkout.tsx` (InitiateCheckout, and Purchase after `/api/verify-payment`, on mobile and desktop).
    - ID from `VITE_META_PIXEL_ID`, which is `1634038191551263` (set in `.env.local`, not in Vercel yet). If it's empty, nothing loads.
    - No events on `/admin`, `/delivery*` or auth-code pages. Automatic config is off, so no personal data is sent.
    - Purchase uses eventID = order number and is deduped (memory + localStorage `meta_pixel_purchases`).
    - Public redirects keep utm/fbclid (`NavigateKeepQuery`).
- **Verified 2026-11-05:**
    - `npm run build` passes; `npm run test:pixel` passes 9/9.
    - In the real Chrome ("Browser 6", localhost + emulators, Razorpay stubbed): PageView, ViewContent, AddToCart, InitiateCheckout and Purchase each reached facebook.com/tr once with id=1634038191551263.
    - That test sent one test Purchase of ₹7,497 (eid 51001892) from localhost to the real Pixel.
- **Gotcha:** headless Playwright gets no /tr beacons from this Pixel (Meta drops automated browsers). Verify in a real Chrome or in Events Manager → Test events.

## Next steps
1. Owner: add `VITE_META_PIXEL_ID=1634038191551263` in Vercel (Production), redeploy, then check Events Manager → Test events on sreerasthusilvers.com.
2. Owner: replace the leaked admin key (`FIREBASE_ADMIN_SDK_BASE64` in Vercel); see the archive, 2026-10-09 evening.
