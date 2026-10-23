/**
 * Pure total-card logic and URL variant resolver for the 帳本 (Ledger) screen.
 */

/**
 * Split an HKD amount into its currency prefix and rounded en-US grouped digits.
 * @param {number} n
 * @returns {{ prefix: 'HK$', digits: string }}
 */
export function splitHKD(n) {
  const rounded = Math.round(Number(n) || 0);
  return {
    prefix: 'HK$',
    digits: rounded.toLocaleString('en-US'),
  };
}

/**
 * Resolve the total-card visual variant ('a' train ticket | 'b' postmark diary page)
 * from a URL `location.search` string.
 * Returns `'b'` only when `total` is `'b'` or `'B'`; everything else returns `'a'`.
 * @param {string} [search]
 * @returns {'a' | 'b'}
 */
export function resolveTotalVariant(search) {
  const raw = String(search || '');
  const qIndex = raw.indexOf('?');
  const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : raw;
  const params = new URLSearchParams(qs);
  const val = params.get('total');
  return val === 'b' || val === 'B' ? 'b' : 'a';
}

/**
 * Compute the 帳本 total summary for the filtered view and trip-level budget bar.
 * @param {{
 *   shown?: Array<{ hkdAmount?: number, originalAmount?: number, currency?: string }>,
 *   all?: Array<{ hkdAmount?: number }>,
 *   budget?: number | null,
 *   filtered?: boolean,
 * }} [opts]
 * @returns {{
 *   hkd: number,
 *   count: number,
 *   jpy: number,
 *   filtered: boolean,
 *   budget: null | {
 *     budget: number,
 *     spent: number,
 *     pct: number,
 *     barPct: number,
 *     filteredPct: number | null,
 *     over: boolean,
 *     overBy: number,
 *   },
 * }}
 */
export function ledgerTotalSummary({ shown = [], all = [], budget = null, filtered = false } = {}) {
  const shownList = Array.isArray(shown) ? shown : [];
  const allList = Array.isArray(all) ? all : [];
  const isFiltered = Boolean(filtered);

  const hkd = shownList.reduce((sum, e) => sum + Number(e?.hkdAmount || 0), 0);
  const count = shownList.length;
  const jpy = shownList
    .filter((e) => e?.currency === 'JPY')
    .reduce((sum, e) => sum + Number(e?.originalAmount || 0), 0);

  const hasValidBudget = typeof budget === 'number' && Number.isFinite(budget) && budget > 0;
  if (!hasValidBudget) {
    return {
      hkd,
      count,
      jpy,
      filtered: isFiltered,
      budget: null,
    };
  }

  const spent = allList.reduce((sum, e) => sum + Number(e?.hkdAmount || 0), 0);
  const pct = Math.round((spent / budget) * 100);
  const barPct = Math.min(100, Math.max(0, pct));
  const filteredPct = isFiltered ? Math.min(100, Math.max(0, Math.round((hkd / budget) * 100))) : null;
  const over = spent > budget;
  const overBy = Math.max(0, spent - budget);

  return {
    hkd,
    count,
    jpy,
    filtered: isFiltered,
    budget: {
      budget,
      spent,
      pct,
      barPct,
      filteredPct,
      over,
      overBy,
    },
  };
}
