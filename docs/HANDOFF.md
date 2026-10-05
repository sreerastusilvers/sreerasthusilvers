# Handoff

## 2026-10-05 (late night): home rows now drift continuously, alternating direction

Status: done, not committed. `npm run build` passes. The type-check shows 13 errors, all old, none in the changed files. Browser-checked with Playwright on the dev server at 390 px and 1440 px, light and dark.

- **Owner's complaint:** the home product rows "don't scroll / feel static".
    - **Root cause:** the old autoplay waited 3.5 s, hopped one card, then rested again.
    - Every pause restarted that 3.5 s wait, including going off screen while the page was scrolled and a touch (held for 2.5 s after lifting).
    - So in real use the rows looked still.
- **Now (`src/hooks/useAutoScroll.ts`):** a continuous drift at 40 px/s.
    - It eases in over 0.45 s and loops seamlessly through the duplicated cards.
    - **Mouse:** it stops the instant the mouse is over a row and starts again the instant it leaves.
    - **Finger:** it stops while touched and starts again about 0.3 s after the swipe settles.
    - The arrows still page by a card and then rest 1.6 s.
    - With reduced motion it stays still, as before.
- **Smoothness:** Chrome rounds `scrollLeft` to whole pixels, so the whole pixels go to `scrollLeft` and the leftover fraction goes to a `transform` on an inner track.
    - Measured: an even 0.667 px per frame at 60 fps, no stalled frames, no jump at the loop point.
    - So every row's cards are now wrapped in one inner `flex w-max gap-*` div (TopDeals ×2, BestSellers mobile, TrendProducts mobile, TrendProductSection, PromoSection, YouTubeShowcase). Keep that wrapper if you edit these rows.
    - Snap and smooth scrolling are switched off on a row while it autoplays.
- **Directions alternate (owner's ask: first row right to left):**

  | Row | Direction |
  |---|---|
  | TopDeals | R→L |
  | BestSellers | L→R |
  | TrendProducts (New Arrivals) | R→L |
  | TrendProductSection (Trending) | L→R |
  | PromoSection (Collections) | R→L |
  | YouTubeShowcase | L→R |

  Desktop shows the first three rows.
- The TopDeals desktop row now renders its cards twice, so it loops seamlessly.
- `useAutoplayGate.hold(ms?)` now takes an optional duration.
- **Not changed:**
    - FeaturedSection ("Editor's Picks"), a paged grid, not a row.
    - HeroBanner and Testimonials, which have their own autoplay.
- **Not verified:** real iOS Safari momentum scrolling and a 120 Hz phone. Check on a real phone after deploy.
- Section 1 of the "evening" entry below (one card every 3.5 s) is replaced by this.

## 2026-10-05 (late): removed 89 unused files

Status: done. The owner approved it. The 89 files in `docs/UNUSED_FILES.txt` were removed with `git rm`; all were tracked, none were missing. `npm run build` passes. The type-check (`npx tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 5.0`) now shows 13 errors, down from 20, and none are "cannot find module". Without the override flag, tsc stops at `ignoreDeprecations: "6.0"` in `tsconfig.app.json` line 25. No browser check was done: none of the files were imported from `src/main.tsx`, and the build confirms that.

## 2026-10-05 (night): announcements, product-page claims, known-issues list, leaked token

Status: done. `npm run build` passes and `api/` still has 12 files. The type-check shows the same 20 old errors as before, none in changed files. Tests pass: `scripts/tests/` has 21 + 14 + 8 cases (see its README). Playwright checks pass 25/25 at 390 px and 1440 px, light and dark; Meta, `/api/broadcast` and R2 were mocked. Committed locally, not pushed. Firestore rules not changed.

### 1. Marketing → Announcement (new first tab)
- **Files:** `src/components/admin/marketing/AnnouncementComposer.tsx` and `announcement.ts`.
- **How it works:** one WhatsApp template, `store_announcement`.
    - The text is "Hello {{1}}, … update from Sreerasthu Silvers: {{2}} …", with the footer "Reply STOP to stop these updates".
    - {{1}} is the customer's first name, filled per customer; {{2}} is whatever the admin types.
- **Template setup:** a "Create announcement template" button and a "Check status with Meta" button. A rejected template is resubmitted as `_v2`, `_v3`, and so on.
- **Audience:** all customers, or chosen customers from a searchable checkbox list.
- **Channels:** WhatsApp and/or website notification.
- **Before sending:**
    - A live preview.
    - A reach count: no number, replied STOP, or a duplicate number.
    - A confirm dialog.
- **`api/broadcast.ts` fixes:**
    - "Customers" missed every shopper: signup saves `role: 'user'` and the filter wanted `'customer'`. It now means everyone except admin and delivery accounts.
    - It now uses `whatsappNumber` first and adds 91 to bare 10-digit numbers.
    - It sends once per number.
    - It skips numbers that opted out.
    - It folds line breaks, which Meta rejects (error 132018).
    - It sends 8 messages at a time, with `maxDuration` 60.
    - It logs each sent message into the customer's inbox thread (existing threads are bumped; no empty threads are created).
- **STOP/START:** `api/whatsapp-webhook.ts` sets `whatsappThreads/{phone}.marketingOptOut`.
- **The Custom tab's picker** had the same role bug (fixed). Its search icon overlapped the placeholder (fixed).

### 2. Product-page claims (owner asked to replace them)
- **ProductDetail:** "Free Shipping / 2 Year Warranty / Easy Returns" are gone. The strip now shows:
    - the product's own purity ("92.5 Sterling Silver" or "99.9% Pure Silver", hidden when the product has none);
    - "Secure Checkout";
    - "See It on Video Call".
- **Home:** `FreeShippingBand` said "Free Shipping Over ₹20,000" and `FeatureIcons` said "Free shipping over ₹10,000". Both now use the 92.5 silver, secure checkout, video call and WhatsApp claims instead.
- **Checkout:** "7-Day Easy Returns" was kept. It matches the site's own refund policy page (7 days).

### 3. Known issues list from the evening entry
- **`/wallet`:** now a redirect to `/purchase-summary`. WalletPage was deliberately **not** routed: checkout can't spend a wallet balance, and its "redeem gift card" would use up the card for nothing.
- **2FA card (and nearby Security panels) in dark mode:** fixed.
- **`/products`:** lists the whole catalogue ("All Products"). `?tag=` still filters.
- **CartContext:** the add is saved in a Firestore transaction that re-checks stock against the saved quantity (`src/contexts/cartMerge.ts`). The local-storage fallback saves the latest items (`itemsRef`).
- **ProductCard quantity buttons:** a 44 px hit area through `before:-inset-2` (still 28 px visually), plus focus rings.
- **QuickView:** uses the live silver-rate price, the same as ProductCard, for both the price shown and the price added to the cart.
- **WhatsApp:**
    - **Picture-header templates:** a "Text / Picture" switch in Create new. The picture goes to R2 (category `media`, ≤500 KB JPEG), then the server sends it to Meta as the review sample (resumable upload; app ID from `WHATSAPP_APP_ID` or `GET /app`). The picture is saved as `headerImageUrl` and attached to every send (inbox, Custom, broadcast). Library → "Set picture" covers templates made in WhatsApp Manager. The server only fetches pictures from `R2_PUBLIC_URL`.
    - **Team media:** a paperclip in Reply mode (also paste). Photos are re-encoded to JPEG ≤3 MB; documents (PDF, Office, txt) up to 3 MB. New action `send-media`, which uploads to Meta's `/media` and then sends.
    - **Large media:** the `media` action serves 3.5 MB slices, which the admin page joins. The limit is now 25 MB.
    - **Inbox:** "Load older conversations" adds 300 more each time.
- **About 89 unused files:** deleted on 2026-10-05 (see the entry above).

### 4. Security: a WhatsApp token was committed
- `scripts/test-templates.mjs` had a hardcoded token fallback, committed since 2026-04-28 and pushed to GitHub. The fallback is removed. Checked 2026-10-05: the token belongs to the agency's **"Dream Team Posting"** app and a different phone number, **not** the store's (the store uses app `ssmessages` and the "Sreerasthu Silvers" number). It **still works**, so revoke it in the Dream Team business: Settings → System users → Revoke tokens. The store's token doesn't need replacing.

### Owner to-do
1. **Meta (Dream Team business, not the store):** revoke the leaked "Dream Team Posting" system-user token (see section 4).
1b. **Meta app `ssmessages` is Unpublished.** Sending already works. Publishing (privacy URL `https://www.sreerasthusilvers.com/privacy-policy`) is needed for incoming messages, ticks and STOP. Webhook callback: `https://www.sreerasthusilvers.com/api/whatsapp-webhook`. Use `www`, because the bare domain 307-redirects.
2. **Vercel and Meta setup:** the setup guide steps (env vars, webhook, Live mode). `WHATSAPP_APP_ID` is optional; it's only needed if a picture template says it can't find the app ID.
3. **Announcement:** Admin → Marketing → Announcement → "Create announcement template" once, then wait for Approved.
4. **Firestore rules:** still not deployed (from earlier entries).
5. **[NEED] Confirm with the client:**
    - Is all their silver jewellery 92.5? The home band and feature card now say so; the owner suggested it.
    - The "The Iconic Box … signature packaging" claim on the home page.
    - "In-store … appointments" on the home page.
    - One product is named "Silver Clad Photo Frame" but its purity says "999 pure silver".
    - The home collections show "NECKLACE / GOLD" and "DIAMOND NECKLACE / PURE DIAMOND" with no pictures. They look like placeholders on a silver store.

### Live check (2026-10-05, 14:06 UTC)
- WhatsApp is connected end to end on production:
    - all six env vars are set;
    - the webhook is verified;
    - a "Hi" from the owner's phone landed in `whatsappThreads`.
- **Vercel gotcha:** production was pinned (after an Instant Rollback), so the Redeploys built but did not go live until one was **Promoted**. If env changes don't show up on the live site, check that the newest deployment has the blue "Production" label.
- The announcement template has not been created yet (the owner does this from the admin).

### Not verified
- Real Meta was never called:
    - the resumable upload and `GET /app` for picture templates;
    - multipart `/media` uploads;
    - whether Meta's media CDN honours `Range` (the code works either way; tests cover both);
    - approval of the announcement template wording.
- A broadcast to a large list (8 at a time, 60 s limit; roughly 1,000+ messages should fit).

### Known issues, not fixed
- The 20 old TypeScript errors (unchanged).
- Firestore rules let a customer edit their own `users/{uid}/wallets` balance. Nothing uses wallets now; lock it down to admin-only when rules are next deployed (needs the emulator suite).
- Inbox: the sticky "Yesterday" day label can overlap a note bubble while scrolling.
- An admin choosing customers loads every user document (fine at today's ~30 customers; needs paging at thousands).

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
