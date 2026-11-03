import { fmtHKD, fmtJPY } from './refLogic.js';

/**
 * Compute trip budget usage, remaining HKD, and over-budget HKD for the Home 「旅費」 card.
 * @param {number | null | undefined} budget
 * @param {number | null | undefined} spent
 * @returns {null | {
 *   budget: number,
 *   spent: number,
 *   delta: number,
 *   remaining: number,
 *   over: boolean,
 *   overBy: number,
 *   amount: number,
 *   pct: number,
 *   barPct: number,
 * }}
 */
export function budgetRemaining(budget, spent = 0) {
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return null;
  const s = Number.isFinite(Number(spent)) ? Number(spent) : 0;
  const delta = b - s;
  const over = s > b;
  const remaining = over ? 0 : delta;
  const overBy = over ? s - b : 0;
  const pct = Math.round((s / b) * 100);
  const barPct = Math.min(100, Math.max(0, pct));

  return {
    budget: b,
    spent: s,
    delta,
    remaining,
    over,
    overBy,
    amount: over ? overBy : remaining,
    pct,
    barPct,
  };
}

/**
 * Resolve the trip's primary currency and formatted original-currency total for the Home 「旅費」 detail panel.
 * Returns `showDetail: false` when the trip currency is HKD or the original total is zero.
 * @param {Record<string, any> | null | undefined} trip
 * @returns {{
 *   tripCurrency: string,
 *   origTotal: number,
 *   origTotalLabel: string,
 *   showDetail: boolean,
 * }}
 */
export function resolveHomeCostDetail(trip) {
  const tripCurrency =
    String(trip?.tripCurrency || trip?.currency || 'JPY')
      .trim()
      .toUpperCase() || 'JPY';
  const expenses = Array.isArray(trip?.expenses) ? trip.expenses : [];
  const origTotal = Math.round(
    expenses
      .filter(
        (e) =>
          String(e?.currency || e?.originalCurrency || '')
            .trim()
            .toUpperCase() === tripCurrency,
      )
      .reduce((s, e) => s + (Number(e?.originalAmount) || 0), 0),
  );
  const origTotalLabel =
    origTotal > 0
      ? tripCurrency === 'JPY'
        ? fmtJPY(origTotal)
        : tripCurrency === 'HKD'
          ? fmtHKD(origTotal)
          : `${tripCurrency} ${origTotal.toLocaleString('en-US')}`
      : '';
  const showDetail = Boolean(origTotalLabel && tripCurrency !== 'HKD');

  return {
    tripCurrency,
    origTotal,
    origTotalLabel,
    showDetail,
  };
}
