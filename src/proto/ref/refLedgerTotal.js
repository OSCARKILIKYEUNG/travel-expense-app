/**
 * Pure total-card logic for the 帳本 (Ledger) screen.
 */
import { getDefaultAssignee, resolveAssigneeDisplay } from '../../utils/people';
import {
  getPartialMatchPersonShareHKD,
  getPartialMatchPersonShareOriginal,
} from '../../utils/personShare';

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

function hasPartialPersonItems(expense, person, people) {
  return (expense?.items || []).some(
    (item) => item && (item.assignedTo || resolveAssigneeDisplay(expense.assignedTo, people)) === person,
  );
}

/**
 * Compute an expense's HKD and JPY contribution for the ledger total card.
 * When `person` is active (`!== '全部'`), matches classic `Dashboard.jsx` math:
 * - Whole-card assignee (`resolveAssigneeDisplay(e.assignedTo, people) === person`) -> full `hkdAmount` / `originalAmount`.
 * - Partial line-item assignee -> `getPartialMatchPersonShareHKD` / `getPartialMatchPersonShareOriginal`.
 */
export function ledgerExpenseShare(
  expense,
  { person = '全部', people = [], exchangeRates = null, defaultAssignee } = {},
) {
  if (!expense || typeof expense !== 'object') {
    return { hkd: 0, jpy: 0 };
  }

  const curr = String(expense.originalCurrency || expense.currency || '').toUpperCase();
  const fullHkd = Number(expense.hkdAmount || 0);
  const fullJpy = curr === 'JPY' ? Number(expense.originalAmount || 0) : 0;

  if (!person || person === '全部') {
    return { hkd: fullHkd, jpy: fullJpy };
  }

  const resolvedDefault = defaultAssignee ?? getDefaultAssignee(people);
  const whole = resolveAssigneeDisplay(expense.assignedTo, people) === person;
  if (whole) {
    return { hkd: fullHkd, jpy: fullJpy };
  }

  if (hasPartialPersonItems(expense, person, people)) {
    const hkd = getPartialMatchPersonShareHKD(
      expense,
      person,
      exchangeRates,
      resolvedDefault,
    );
    const jpy =
      curr === 'JPY'
        ? getPartialMatchPersonShareOriginal(expense, person, resolvedDefault)
        : 0;
    return { hkd, jpy };
  }

  return { hkd: 0, jpy: 0 };
}

/**
 * Compute the 帳本 total summary for the filtered view and trip-level budget bar.
 * @param {{
 *   shown?: Array<{ hkdAmount?: number, originalAmount?: number, currency?: string, assignedTo?: string, items?: Array<any> }>,
 *   all?: Array<{ hkdAmount?: number }>,
 *   budget?: number | null,
 *   filtered?: boolean,
 *   person?: string,
 *   people?: string[],
 *   exchangeRates?: Record<string, number> | null,
 *   defaultAssignee?: string,
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
export function ledgerTotalSummary({
  shown = [],
  all = [],
  budget = null,
  filtered = false,
  person = '全部',
  people = [],
  exchangeRates = null,
  defaultAssignee,
} = {}) {
  const shownList = Array.isArray(shown) ? shown : [];
  const allList = Array.isArray(all) ? all : [];
  const isFiltered = Boolean(filtered);
  const hasPersonFilter = Boolean(person && person !== '全部');

  let hkd = 0;
  let jpy = 0;
  for (const e of shownList) {
    if (hasPersonFilter) {
      const share = ledgerExpenseShare(e, {
        person,
        people,
        exchangeRates,
        defaultAssignee,
      });
      hkd += share.hkd;
      jpy += share.jpy;
    } else {
      hkd += Number(e?.hkdAmount || 0);
      const curr = String(e?.originalCurrency || e?.currency || '').toUpperCase();
      if (curr === 'JPY') {
        jpy += Number(e?.originalAmount || 0);
      }
    }
  }
  const count = shownList.length;

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
