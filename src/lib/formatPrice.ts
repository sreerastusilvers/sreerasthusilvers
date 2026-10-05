/**
 * Indian-style grouping for rupee amounts: 235100 -> "2,35,100.00".
 * `toFixed(2)` has no separators, which makes big totals hard to read.
 */
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatAmountINR = (amount: number): string =>
  inr2.format(Number.isFinite(amount) ? amount : 0);
