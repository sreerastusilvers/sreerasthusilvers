# Media storage (Cloudflare R2)

Every image upload goes through one server endpoint, `api/media.ts`. The browser never gets storage keys.

## How it works

| Piece | File |
| --- | --- |
| Upload, delete, usage endpoint (+ free-tier guard) | `api/media.ts` |
| Browser client: size checks, compression, previews | `src/services/mediaStorage.ts` |
| Preview URL helper (`__w600.webp`) | `src/lib/mediaUrl.ts` |
| Image component (uses previews in small slots) | `src/components/ui/smart-image.tsx` |
| Admin usage page | `src/pages/admin/AdminStorage.tsx` (`/admin/storage`) |
| Admin warning popup | `src/components/admin/StorageLimitWatcher.tsx` |

Rules:

- Images: JPG, PNG, WebP, **500 KB max**. Admin screens reject bigger files. Customer screens (review photos, profile picture) shrink photos in the browser first.
- PDFs (refund receipts only): 1 MB max.
- Products: **5 photos max**. The product form and `firestore.rules` both enforce this.
- Each photo is stored with a 600px preview next to it (`m<id>.jpg` + `m<id>__w600.webp`). Product cards load the preview.
- Review videos are turned off. A few phone videos would use up the free 10 GB.

Free-tier guard: before each upload the server checks usage for the current billing month.
- **80%** of any limit: admins see a popup.
- **95%**: uploads are refused (HTTP 429, code `LIMIT_REACHED`).

Limits are 10 GB storage, 1M Class A operations, and 10M Class B operations. The numbers come from the Cloudflare GraphQL analytics API when `CLOUDFLARE_ANALYTICS_TOKEN` is set. Without it, storage is measured by listing the bucket, and Class B can't be measured.

Deletes are free on R2. Deleting a product, or removing a photo and saving, deletes the file if no other product uses it.

## Keys

```
products/2026/09/m3f9c...e1.jpg          admin categories: <category>/<yyyy>/<mm>/<id>.<ext>
avatars/<uid>/2026/09/m81ab...77.webp    per-user categories: <category>/<uid>/<yyyy>/<mm>/<id>.<ext>
```

The keys don't depend on any provider. Firestore stores `R2_PUBLIC_URL + "/" + key`.

## Environment variables (Vercel → Settings → Environment Variables, and local `.env`)

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `R2_BILLING_CYCLE_DAY`, `CLOUDFLARE_ANALYTICS_TOKEN`, `CLOUDFLARE_ZONE_ID`. See `.env.example`.

`CLOUDFLARE_ANALYTICS_TOKEN` needs two permissions on the same token (Cloudflare dashboard → profile icon → API Tokens → edit the token → Add more → add a second permission group):
- **Account → Account Analytics → Read** — powers the live usage numbers on `/admin/storage`.
- **Zone → Cache Purge → Purge**, scoped to the zone that owns your `R2_PUBLIC_URL` domain — without this, deleting a photo removes it from R2 but a cached copy can keep being served from Cloudflare's edge for up to a year (deletes still work; they just aren't instant at the edge).

## Moving the files later

Applies both to switching from the r2.dev link to a custom domain and to moving to AWS S3 or another S3-compatible store:

1. Copy the bucket and keep the same keys. For example, with rclone: `rclone sync r2:ssstorage s3:new-bucket`. If only the domain changes, there's nothing to copy.
2. Point the env vars at the new store. `api/media.ts` uses plain S3 SigV4 (`aws4fetch`), so an S3 endpoint works after changing `bucketUrl` in `r2()`.
3. Rewrite the stored URLs:
   ```
   node scripts/rewrite-media-urls.mjs --from=<old R2_PUBLIC_URL> --to=<new base URL>          # dry run
   node scripts/rewrite-media-urls.mjs --from=<old R2_PUBLIC_URL> --to=<new base URL> --apply
   ```
4. Update `R2_PUBLIC_URL` on Vercel and redeploy.

Legacy Cloudinary URLs already in Firestore still render through `src/lib/cloudinaryUrl.ts`.
