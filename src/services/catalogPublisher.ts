import { auth } from '@/config/firebase';
import { callMediaApi } from './mediaStorage';

/**
 * Keeps the storefront catalog snapshot (catalog/products.json) in step with
 * Firestore.
 *
 * Call it after any write to a product document. Ids are batched briefly so a
 * bulk edit sends one request, and the server re-reads only those products (one
 * Firestore read each) - see `publish-catalog` in api/media.ts.
 *
 * A failure never blocks the write that triggered it: the snapshot is a cache.
 * Until the next change touches that product, shoppers may see its old details
 * (checkout still re-checks stock and price against Firestore). A full rebuild
 * is `node scripts/publish-catalog.mjs`.
 */

const BATCH_DELAY_MS = 800;
const MAX_IDS_PER_REQUEST = 25;

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = async () => {
  timer = null;
  const ids = [...pending];
  pending.clear();
  // Guests can't place orders or edit products, so there is nothing of theirs to publish.
  if (!ids.length || !auth.currentUser) return;

  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    try {
      await callMediaApi(
        { action: 'publish-catalog', productIds: ids.slice(i, i + MAX_IDS_PER_REQUEST) },
        // Survives the admin navigating away right after saving.
        { keepalive: true },
      );
    } catch (err) {
      console.warn('[catalog] snapshot refresh failed; the storefront may show old details for:', ids, err);
    }
  }
};

export const requestCatalogRefresh = (productIds: Array<string | null | undefined>) => {
  for (const id of productIds) if (id) pending.add(id);
  if (!pending.size) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), BATCH_DELAY_MS);
};
