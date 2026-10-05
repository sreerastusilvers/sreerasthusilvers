/**
 * Add a line to the cart as saved in Firestore, re-checking stock against the
 * saved quantity. The on-screen check in addToCart can run before the saved
 * cart has loaded (it then compares against an empty or stale list), so the
 * write is the place that has to hold the stock limit.
 */
export interface SavedCartLine {
  id: string;
  quantity: number;
  stock?: number;
}

export interface MergeResult<T extends SavedCartLine> {
  items: Record<string, T>;
  /** How many units this add really put in the cart (0 when none fit). */
  added: number;
  /** The quantity already saved before this add. */
  before: number;
  /** Stock used for the limit, when known. */
  stock?: number;
}

export function mergeAddIntoSavedCart<T extends SavedCartLine>(
  saved: Record<string, T> | undefined | null,
  line: Omit<T, 'quantity'>,
  quantity: number,
): MergeResult<T> {
  const items: Record<string, T> = { ...(saved || {}) };
  const id: string = line.id;
  const current = items[id];
  const before = Math.max(0, Number(current?.quantity) || 0);
  const stock = typeof line.stock === 'number' ? line.stock : typeof current?.stock === 'number' ? current.stock : undefined;
  const wanted = before + quantity;
  const next = typeof stock === 'number' ? Math.min(wanted, Math.max(stock, 0)) : wanted;
  const added = Math.max(0, next - before);

  const stockField = typeof stock === 'number' ? { stock } : {};
  if (current) {
    // Never lower a saved quantity here; only the cart page does that.
    items[id] = { ...current, quantity: Math.max(next, before), ...stockField };
  } else if (added > 0) {
    items[id] = { ...line, quantity: added, ...stockField } as T;
  }
  return { items, added, before, stock };
}
