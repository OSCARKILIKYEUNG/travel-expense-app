import { addDays } from '../shared/dates';
import { normalizePayment } from '../../adapters/refDataAdapter';
import { expenseDateKey, sortExpenses } from '../../utils/date';
import { REF_CATEGORIES } from './mockRefTrip';
import { expenseAllocation, personOwed, resolvePayer, settlementParticipants } from './refShares';

function diffDays(fromIso, toIso) {
  const [y1, m1, d1] = String(fromIso).split('-').map(Number);
  const [y2, m2, d2] = String(toIso).split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Determine chart presentation mode relative to `trip.startDate` and `trip.endDate`.
 * @param {{ startDate?: string, endDate?: string }} trip
 * @param {string} today YYYY-MM-DD
 * @returns {'before' | 'during' | 'review'}
 */
export function chartsMode(trip, today) {
  const start = trip?.startDate;
  const end = trip?.endDate;
  if (!start || !end || !today) return 'during';
  if (today < start) return 'before';
  if (today > end) return 'review';
  return 'during';
}

/**
 * Compute remaining budget and daily allowance.
 * Returns null if budget is not a positive number.
 * @param {{ budget?: number|null, expenses?: Array, startDate?: string, endDate?: string, today?: string, settings?: { budget?: number|null } }} opts
 * @param {string} [maybeToday]
 * @returns {{ budget: number, spent: number, left: number, pct: number, over: boolean, daysLeft: number, perDay: number, lastDay: boolean } | null}
 */
export function remainingPerDay(opts = {}, maybeToday) {
  const rawBudget = opts?.budget !== undefined ? opts.budget : opts?.settings?.budget;
  if (typeof rawBudget !== 'number' || !Number.isFinite(rawBudget) || rawBudget <= 0) {
    return null;
  }
  const budget = rawBudget;
  const expenses = Array.isArray(opts?.expenses) ? opts.expenses : [];
  const startDate = opts?.startDate;
  const endDate = opts?.endDate;
  const today = maybeToday !== undefined ? maybeToday : opts?.today;

  const spent = expenses.reduce((sum, e) => sum + Number(e?.hkdAmount || 0), 0);
  const left = budget - spent;
  const pct = Math.round((spent / budget) * 100);
  const over = left < 0;

  const mode = chartsMode({ startDate, endDate }, today);
  let daysLeft = 0;
  if (startDate && endDate && today) {
    if (mode === 'before') {
      daysLeft = Math.max(0, diffDays(startDate, endDate) + 1);
    } else if (mode === 'during') {
      daysLeft = Math.max(0, diffDays(today, endDate));
    } else {
      daysLeft = 0;
    }
  }

  const lastDay = mode === 'during' && Boolean(today && endDate && today === endDate);
  const perDay = over ? 0 : daysLeft > 0 ? Math.floor(left / daysLeft) : lastDay ? left : 0;

  return {
    budget,
    spent,
    left,
    pct,
    over,
    daysLeft,
    perDay,
    lastDay,
  };
}

/**
 * Compare today's dated spend against the average daily dated spend across elapsed trip days.
 * @param {Array} expenses
 * @param {{ startDate?: string, endDate?: string }} trip
 * @param {string} today YYYY-MM-DD
 * @returns {{ today: number, avg: number, elapsedDays: number }}
 */
export function todayVsAverage(expenses, trip, today) {
  const list = Array.isArray(expenses) ? expenses : Array.isArray(expenses?.expenses) ? expenses.expenses : [];
  const tripObj = Array.isArray(expenses) ? trip : expenses;
  const todayStr = Array.isArray(expenses) ? today : trip;

  const todaySpend = list
    .filter((e) => e?.date && expenseDateKey(e.date) === todayStr)
    .reduce((sum, e) => sum + Number(e?.hkdAmount || 0), 0);

  const start = tripObj?.startDate;
  const end = tripObj?.endDate;
  if (!start || !end || !todayStr || todayStr < start) {
    return { today: todaySpend, avg: 0, elapsedDays: 0 };
  }

  const endBound = todayStr < end ? todayStr : end;
  const elapsedDays = Math.max(0, diffDays(start, endBound) + 1);
  if (elapsedDays === 0) {
    return { today: todaySpend, avg: 0, elapsedDays: 0 };
  }

  const datedInRange = list
    .filter((e) => {
      if (!e?.date) return false;
      const k = expenseDateKey(e.date);
      return k >= start && k <= endBound;
    })
    .reduce((sum, e) => sum + Number(e?.hkdAmount || 0), 0);

  return {
    today: todaySpend,
    avg: Math.round(datedInRange / elapsedDays),
    elapsedDays,
  };
}

/**
 * Split expenses by payment method ('cash' | 'card' | 'none').
 * @param {Array} expenses
 * @returns {{ cash: { total: number, count: number }, card: { total: number, count: number }, none: { total: number, count: number }, total: number }}
 */
export function paymentSplit(expenses) {
  const cash = { total: 0, count: 0 };
  const card = { total: 0, count: 0 };
  const none = { total: 0, count: 0 };

  for (const e of expenses || []) {
    const amt = Number(e?.hkdAmount || 0);
    const pay =
      e?.payment === 'cash' || e?.payment === 'card'
        ? e.payment
        : normalizePayment(e?.payment ?? e?.paymentMethod);
    if (pay === 'cash') {
      cash.total += amt;
      cash.count += 1;
    } else if (pay === 'card') {
      card.total += amt;
      card.count += 1;
    } else {
      none.total += amt;
      none.count += 1;
    }
  }

  return {
    cash,
    card,
    none,
    total: cash.total + card.total + none.total,
  };
}

/**
 * Group and sort non-zero category totals descending with rounded percentage.
 * @param {Array} expenses
 * @param {string[]} [categories]
 * @returns {Array<{ cat: string, total: number, count: number, pct: number }>}
 */
export function categorySplit(expenses, categories = REF_CATEGORIES) {
  const cats = Array.isArray(categories) && categories.length ? categories : REF_CATEGORIES;
  const map = {};
  for (const c of cats) {
    map[c] = { total: 0, count: 0 };
  }

  const list = Array.isArray(expenses) ? expenses : [];
  let grandTotal = 0;

  for (const e of list) {
    const amt = Number(e?.hkdAmount || 0);
    const key = map[e?.category] ? e.category : map.其他 ? '其他' : cats[cats.length - 1];
    map[key].total += amt;
    map[key].count += 1;
    grandTotal += amt;
  }

  return cats
    .map((cat) => ({
      cat,
      total: map[cat].total,
      count: map[cat].count,
      pct: grandTotal > 0 ? Math.round((map[cat].total / grandTotal) * 100) : 0,
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Build per-day stacked category rows from startDate through min(today, endDate) (or endDate in review; [] before trip).
 * @param {Array} expenses
 * @param {{ startDate?: string, endDate?: string }} trip
 * @param {string} today YYYY-MM-DD
 * @param {string[]} [categories]
 * @returns {{ rows: Array<{ iso: string, total: number, segments: Array<{ cat: string, total: number }>, isToday: boolean }>, max: number, avg: number }}
 */
export function dailyStacks(expenses, trip, today, categories = REF_CATEGORIES) {
  const mode = chartsMode(trip, today);
  if (mode === 'before' || !trip?.startDate || !trip?.endDate) {
    return { rows: [], max: 0, avg: 0 };
  }

  const cats = Array.isArray(categories) && categories.length ? categories : REF_CATEGORIES;
  const lastIso = mode === 'review' ? trip.endDate : today < trip.endDate ? today : trip.endDate;
  const list = Array.isArray(expenses) ? expenses : [];

  const rows = [];
  let cur = trip.startDate;
  let guard = 0;
  while (cur <= lastIso && guard < 120) {
    const dayItems = list.filter((e) => e?.date && expenseDateKey(e.date) === cur);
    const catTotals = {};
    for (const c of cats) catTotals[c] = 0;

    let dayTotal = 0;
    for (const e of dayItems) {
      const amt = Number(e?.hkdAmount || 0);
      const key = catTotals[e?.category] !== undefined ? e.category : catTotals.其他 !== undefined ? '其他' : cats[cats.length - 1];
      catTotals[key] += amt;
      dayTotal += amt;
    }

    const segments = cats
      .filter((c) => catTotals[c] > 0)
      .map((c) => ({ cat: c, total: catTotals[c] }));

    rows.push({
      iso: cur,
      total: dayTotal,
      segments,
      isToday: cur === today,
    });

    cur = addDays(cur, 1);
    guard += 1;
  }

  const max = rows.length ? Math.max(...rows.map((r) => r.total)) : 0;
  const sum = rows.reduce((s, r) => s + r.total, 0);
  const avg = rows.length ? Math.round(sum / rows.length) : 0;

  return { rows, max, avg };
}

/**
 * Return top `n` highest-HKD expenses; ties broken by `sortExpenses` order.
 * @param {Array} expenses
 * @param {number} [n=5]
 * @returns {Array}
 */
export function topExpenses(expenses, n = 5) {
  const ordered = sortExpenses(Array.isArray(expenses) ? expenses : []);
  return ordered
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const diff = Number(b.item?.hkdAmount || 0) - Number(a.item?.hkdAmount || 0);
      return diff !== 0 ? diff : a.idx - b.idx;
    })
    .slice(0, Math.max(0, n))
    .map((x) => x.item);
}

/**
 * Compute per-participant paid/owed/net balances and minimal greedy settlement transfers.
 * Paid uses resolvePayer (blank / unknown / 共同 -> first participant).
 * Owed uses allocation: own bucket plus an even split of 共同 and unknown buckets.
 * @param {Array} expenses
 * @param {string[]} people
 * @param {Record<string, number> | null} [exchangeRates]
 * @returns {{ rows: Array<{ person: string, paid: number, owed: number, net: number }>, transfers: Array<{ from: string, to: string, amount: number }> }}
 */
export function settleUp(expenses, people, exchangeRates = null) {
  const participants = settlementParticipants(people);

  if (participants.length === 0) {
    return { rows: [], transfers: [] };
  }

  const ledger = {};
  for (const p of participants) {
    ledger[p] = { paid: 0, owed: 0 };
  }

  for (const e of expenses || []) {
    const amt = Number(e?.hkdAmount || 0);
    const creditTo = resolvePayer(e, participants);
    if (ledger[creditTo]) ledger[creditTo].paid += amt;

    const owed = personOwed(e, people, exchangeRates);
    for (const p of participants) {
      ledger[p].owed += owed[p] || 0;
    }
  }

  const rows = participants.map((person) => {
    const paid = ledger[person].paid;
    const owed = ledger[person].owed;
    const net = paid - owed;
    return { person, paid, owed, net };
  });

  const debtors = rows
    .map((r, order) => ({ person: r.person, rem: -r.net, order }))
    .filter((d) => d.rem > 1e-9);
  const creditors = rows
    .map((r, order) => ({ person: r.person, rem: r.net, order }))
    .filter((c) => c.rem > 1e-9);

  const transfers = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort((a, b) => (Math.abs(b.rem - a.rem) > 1e-9 ? b.rem - a.rem : a.order - b.order));
    creditors.sort((a, b) => (Math.abs(b.rem - a.rem) > 1e-9 ? b.rem - a.rem : a.order - b.order));

    const debtor = debtors[0];
    const creditor = creditors[0];
    const matched = Math.min(debtor.rem, creditor.rem);
    const rounded = Math.round(matched);

    if (rounded >= 1) {
      transfers.push({
        from: debtor.person,
        to: creditor.person,
        amount: rounded,
      });
    }

    debtor.rem -= matched;
    creditor.rem -= matched;

    if (debtor.rem <= 1e-9) debtors.shift();
    if (creditor.rem <= 1e-9) creditors.shift();
  }

  return { rows, transfers };
}

/**
 * Bucket totals from expense allocation. 共同 is shown when it is in `people` or its total is above 0.
 * Count is the number of expenses with a positive share in that bucket.
 * `shares` are each participant's settleUp owed amount.
 * @param {Array} expenses
 * @param {string[]} people
 * @param {Record<string, number> | null} [exchangeRates]
 * @returns {{ total: number, rows: Array<{ person: string, total: number, count: number, pct: number }>, shares: Array<{ person: string, share: number }> }}
 */
export function assigneeSplit(expenses, people, exchangeRates = null) {
  const peopleList = (Array.isArray(people) ? people : [])
    .map((p) => String(p ?? '').trim())
    .filter(Boolean);

  const buckets = new Map();
  const ensure = (who) => {
    if (!buckets.has(who)) buckets.set(who, { total: 0, count: 0 });
    return buckets.get(who);
  };

  if (peopleList.includes('共同')) ensure('共同');
  for (const p of peopleList) {
    if (p !== '共同') ensure(p);
  }

  let grand = 0;
  const unknownOrder = [];
  for (const e of expenses || []) {
    grand += Number(e?.hkdAmount) || 0;
    const alloc = expenseAllocation(e, peopleList, exchangeRates);
    for (const [who, share] of Object.entries(alloc)) {
      if (!(share > 0)) continue;
      if (who !== '共同' && !buckets.has(who)) unknownOrder.push(who);
      const bucket = ensure(who);
      bucket.total += share;
      bucket.count += 1;
    }
  }

  const rowFor = (person) => {
    const { total, count } = buckets.get(person) || { total: 0, count: 0 };
    return {
      person,
      total,
      count,
      pct: grand > 0 ? Math.round((total / grand) * 100) : 0,
    };
  };

  const rows = [];
  const seen = new Set();
  const shared = buckets.get('共同');
  if (peopleList.includes('共同') || (shared && shared.total > 0)) {
    rows.push(rowFor('共同'));
    seen.add('共同');
  }
  for (const p of peopleList) {
    if (seen.has(p)) continue;
    seen.add(p);
    rows.push(rowFor(p));
  }
  for (const who of unknownOrder) {
    if (seen.has(who)) continue;
    seen.add(who);
    rows.push(rowFor(who));
  }

  const shares = settleUp(expenses, peopleList, exchangeRates).rows.map((r) => ({
    person: r.person,
    share: r.owed,
  }));

  return { total: grand, rows, shares };
}

/**
 * Build URL-encoded ledger route hash from filter/focus options.
 * @param {{ category?: string, payment?: string, payer?: string, person?: string, focus?: string }} [opts]
 * @returns {string}
 */
export function ledgerHash({ category, payment, payer, person, focus } = {}) {
  const params = new URLSearchParams();
  if (category && category !== '全部') params.set('cat', category);
  if (payment && payment !== '全部') params.set('pay', payment);
  if (payer && payer !== '全部') params.set('payer', payer);
  if (person && person !== '全部') params.set('person', person);
  if (focus) params.set('focus', focus);
  const qs = params.toString();
  return qs ? `ledger&${qs}` : 'ledger';
}
