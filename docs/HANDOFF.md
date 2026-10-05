# Handoff

## 2026-10-05 — AI prompts for non-jewellery, image compressor, nav dropdown, mobile checkout

Status: done, build passes, browser-tested (Playwright, 390 px and 1440 px, light and dark). Reviewed and **committed locally** (not pushed).

### What changed
- **AI Prompts** (`src/services/geminiService.ts`, `src/pages/admin/AdminImagePrompts.tsx`)
  - New "What are you shooting?" picker: Jewellery / Furniture / Articles & Decor / Gifting / Pooja Items / Wedding.
  - Jewellery keeps the old model-wears-it prompts.
  - Every other type uses new lifestyle "in use" prompts. Each type has its own pools of scenes, people/actions and studio sets (`KIND_PROFILES`), plus `USE_CASE_RULE`: no "holding it up to the camera", true real-world scale, correct placement.
  - Optional "What is it and how big?" note, used for scene planning and scale.
  - Logo rule rewritten: one small transparent corner watermark at about 10% of the image width, never a box or banner. It now appears once per prompt (it used to be duplicated).
  - Fixed the earring "side profile" instruction, which contradicted the visibility rule.
- **Image Compressor**: new admin page at `/admin/image-compressor` (`src/lib/imageCompressor.ts`, `src/pages/admin/AdminImageCompressor.tsx`).
  - Binary-searches the WebP/JPG quality per resolution. Caps at 2400 px for 500 KB and 3200 px for 1 MB banners.
  - Downloads a ZIP via `fflate` (new dependency).
  - The Product form links to it.
- **Desktop category dropdown** (`src/components/CategoryIconNav.tsx`): the menu was clipped by the row's `overflow-x-auto`. It now renders once as a child of the sticky `<nav>`, lined up under the hovered tab, and closes on Escape or sideways scroll.
- **Mobile checkout** (`src/pages/Checkout.tsx`, `MobileCheckout`)
  - Payment is now step 3 on the same page; the old full-screen overlay is gone.
  - Step 2 shows a "Continue to Payment" button, and the single "Slide to Pay" is on step 3.
  - Step 3 shows the delivery address, every item and the full bill.
  - The Bill Summary now includes the coupon-discount row, which was missing on step 2.
- **Prices**: `src/lib/formatPrice.ts` (`formatAmountINR`) gives Indian grouping (₹ 2,35,100.00) in checkout, mobile cart, account and admin orders.

### Review (2026-10-05)
- Fixed: in mobile checkout, `handlePlaceOrder`'s early exits (no address, empty cart) now reset the Slide to Pay control. Before, it stayed in its "done" state with no way to retry. This is a logic-only change; there is no visual change.
- No secrets in the diff. Type check is clean for every changed file, and lint is clean apart from older warnings.
- Minor follow-ups, not fixed:
  - Desktop category dropdown: keyboard focus opens it, but its items come after all the tabs in tab order.
  - The dropdown doesn't close on blur (Escape works).

### Not verified
- No real Gemini call was made. The assembled prompts were checked by intercepting the API request. The first real generations per product type should be reviewed by the team.

### Pre-existing, not touched
- `npx tsc` fails on `ignoreDeprecations: "6.0"` in `tsconfig.app.json` with TS 5.9, and there are older type errors in unrelated files (VideoCallRequestModal, *Collections pages, invoiceService, videoCallService, DeliveryDashboard).
