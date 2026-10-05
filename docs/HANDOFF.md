# Handoff

## 2026-10-05 (evening): home autoplay, account sidebar + photo, cart confirmation, image viewer, WhatsApp templates + team inbox

Status: done. `npm run build` passes, and `api/` still has 12 files. Each part was browser-tested with Playwright at 390 px and 1440 px, in light and dark mode. Committed locally, not pushed. Firestore rules were changed but **not deployed**.

### 1. Home carousels and reels scroll by themselves
- `src/hooks/useAutoplayGate.ts` (new) and `src/hooks/useAutoScroll.ts` (rewritten).
- Every 3.5 s a row glides forward by one card.
- **Pauses** on hover, touch (resumes 2.5 s after the finger lifts), a manual swipe or scroll, keyboard focus, being off screen, or a hidden tab. Never runs under reduced motion.
- **Mobile reels** (`YouTubeShowcase`): hold still while a video plays or the popup is open. Videos never autoplay sound.
- **Used in:** TopDeals, BestSellers, TrendProducts, TrendProductSection, PromoSection, TestimonialsCarousel. HeroBanner keeps its own autoplay but now follows the same pause rules.
- **Root cause of the old stutter:** `index.css` sets `scroll-behavior: smooth` on `.overflow-x-auto`, which fought the old per-frame scroll.

### 2. Account: left sidebar and profile photo
- **New in `src/components/account/`:** AccountShell, AccountSidebar, UserAvatar, useAccountIdentity, useProfilePhoto.
- **Sidebar:** desktop only, from 1024 px up. Mobile keeps its old layout.
- **Photo:** uses the uploaded photo, then the Google photo, then initials.
  - Uploads are 400 px WebP, sent through `api/media.ts` (folder `avatars`, per user).
  - The URL is saved in `users/{uid}.avatar`.
  - Replacing or removing a photo deletes the old file.
- **Fixed:** Google sign-in used to overwrite an uploaded photo on every login.
- **`/profile` now redirects to `/account`:** the old page showed another client's branding ("Venkat Plus").

### 3. Add-to-cart confirmation
- **New in `src/components/cart/`:**
  - `cartFeedback.ts` and `CartConfirmation.tsx`: a panel top-right on desktop, a bottom sheet on phones. It shows the subtotal and has View cart / Checkout. It closes itself after 4 s.
  - Every add and every refusal in `CartContext` goes through it.
- The add buttons show "Added ✓".
- **`src/hooks/use-toast.ts` drops non-error "Added to cart" toasts.** About 70 older files, most of them unrouted pages, still fire their own toast. This filter stops shoppers seeing two confirmations.

### 4. Product image viewer (cropping fixed)
- **Root cause:** the main photo used `object-cover` in an `aspect-square` frame. It is now `object-contain`.
- **New full-screen viewer** (`src/components/ProductImageViewer.tsx`): zoom by pinch, wheel, double-tap or keys, pan, swipe and arrows. Escape closes it and focus is kept inside while open.
- **Product page fixes:**
  - It no longer shows a made-up description when a product has none.
  - The mobile Buy bar uses the live price.
  - Buy now no longer adds the item twice.
  - The quantity can't go above stock.
- **QuickView:** the wishlist button works, and the dead Compare button is gone.
- **Wishlist:** "Add to cart" now really adds the item.

### 5–6. WhatsApp: templates via the Meta API, team inbox, setup guide
- **`api/whatsapp-reply.ts`** is now an action dispatcher. Its actions are:
  - `send` (the default)
  - `mark-read`
  - `media`
  - `templates-list` (sync)
  - `templates-create`
  - `templates-delete`
  - `config-status` (returns only true/false for each setting)
- **`api/whatsapp-webhook.ts`:**
  - Sent, delivered and read ticks, and failure reasons.
  - Labels for media, location and contacts.
  - A resolved thread reopens when the customer writes again.
- **Admin → Marketing → Templates:**
  - A create form with a live preview, synced with Meta, status badges, and delete.
  - Manual entry is still available.
- **Admin → WhatsApp:**
  - Filters, search, assign, open/resolved, internal notes and quick replies.
  - A 24 h window countdown; it switches to template mode automatically when the window closes.
  - A setup-status checklist and an unread badge in the sidebar.
  - `?demo=1` shows demo data in dev only.
- **Rules:** new admin-only collection `whatsappSnippets`. **Not deployed.**
- **Owner guide:** `docs/WHATSAPP_SETUP.md`. New env var: `WHATSAPP_WABA_ID`.

### Owner to-do
- Follow `docs/WHATSAPP_SETUP.md`: Vercel env vars (including the new `WHATSAPP_WABA_ID`), the webhook, then redeploy.
- Deploy Firestore rules: `firebase login --reauth`, then `firebase deploy --only firestore:rules`. This is still pending from before, and now also includes `whatsappSnippets`.
- **[NEED] Confirm these product-page claims are true:** "Free Shipping", "2 Year Warranty", "Easy Returns".

### Not verified
- Meta was never called; tests used a mocked Graph API. The guide's Meta dashboard steps may name buttons slightly differently.
- Touch auto-scroll timing was tested in Chromium only. Check it on a real iPhone.

### Known issues, not fixed
- `WalletPage.tsx` isn't routed: `/wallet` shows PurchaseSummary.
- The 2FA card on `SecurityPage` stays light in dark mode.
- `/products` shows "Category not found".
- About 55 unrouted page files with old cart code. Candidates for deletion: `src/pages/Shop*`, `Silver*`, `categories/*`, `ProductDetailSection.tsx`, `CartExamples.tsx`.
- **CartContext:**
  - Adds made before the saved cart loads check stock against an empty cart.
  - The local-storage fallback saves the cart from before the add.
- The ProductCard quantity buttons are 28 px, below the 44 px minimum.
- The QuickView price isn't live.
- WhatsApp:
  - Template headers are text only.
  - Media sent by the team isn't supported.
  - Media over 4 MB can't be previewed.
  - The inbox shows at most 300 threads.

## 2026-10-05 (later): desktop category dropdown keyboard fixes

Status: done. Build passes. Tested with Playwright at 1440 px in light and dark mode (26/26 checks). Committed locally, not pushed.

- `src/components/CategoryIconNav.tsx`:
  - **Tab order:** Tab on an open tab now goes into its dropdown items, and Tab on the last item goes to the next tab. Shift+Tab goes back the same way. After the last tab, the browser's normal order takes over.
  - **Blur:** the dropdown closes when focus leaves both the tab and its dropdown. This includes tabbing out and clicking elsewhere.
  - **Escape** inside the dropdown closes it and puts focus back on its tab, without reopening it.
  - The `role="menu"`/`menuitem` roles are gone, because they promise arrow-key navigation that the dropdown never had. It now follows the disclosure pattern: `aria-expanded` plus `aria-controls` pointing at the dropdown `id`.
  - Dropdown items show an inset focus ring (`ring-ring`) in place of the faint background they had before.
- Mouse hover and click on items behave as before (the test checks that a click still opens `/category/jewellery?sub=womens`).
- Not covered: Safari, where clicking a button doesn't focus it. That case is handled with a `:hover` guard but was not tested.

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
- Minor follow-ups: both dropdown keyboard issues are now fixed (see the entry above).

### Not verified
- No real Gemini call was made. The assembled prompts were checked by intercepting the API request. The first real generations per product type should be reviewed by the team.

### Pre-existing, not touched
- `npx tsc` fails on `ignoreDeprecations: "6.0"` in `tsconfig.app.json` with TS 5.9, and there are older type errors in unrelated files (VideoCallRequestModal, *Collections pages, invoiceService, videoCallService, DeliveryDashboard).
