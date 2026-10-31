import { expenseDateKey, expenseDateLabel } from '../../utils/date';

export function resolveTripAccountingCurrency(trip) {
  const raw =
    trip?.accountingCurrency ||
    trip?.homeCurrency ||
    trip?.settings?.accountingCurrency ||
    trip?.settings?.homeCurrency ||
    'HKD';
  const code = String(raw).trim().toUpperCase().slice(0, 3);
  return /^[A-Z]{3}$/.test(code) ? code : 'HKD';
}

export function resolveTripForeignCurrency(trip) {
  const raw =
    trip?.tripCurrency ||
    trip?.currency ||
    trip?.settings?.tripCurrency ||
    'JPY';
  const code = String(raw).trim().toUpperCase().slice(0, 3);
  return /^[A-Z]{3}$/.test(code) ? code : 'JPY';
}

export function resolveTripRefRate(trip, fallback = 0.0526) {
  const explicit = Number(trip?.settings?.rate);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (resolveTripForeignCurrency(trip) === resolveTripAccountingCurrency(trip)) {
    return 1;
  }
  return fallback;
}

/**
 * Pure helper computing a settlement row (including hkdAmount and rate snapshot)
 * from repayment form inputs.
 *
 * @param {{
 *   id?: string,
 *   from?: string,
 *   to?: string,
 *   amount?: number | string,
 *   currency?: string,
 *   date?: string,
 *   note?: string,
 * }} [form]
 * @param {{
 *   accountingCurrency?: string,
 *   tripCurrency?: string,
 *   rate?: number,
 * }} [options]
 */
export function buildSettlementRow(
  form = {},
  { accountingCurrency = 'HKD', tripCurrency = 'JPY', rate = 0.0526 } = {},
) {
  const acc = String(accountingCurrency || 'HKD').trim().toUpperCase() || 'HKD';
  const _tripCurr = String(tripCurrency || 'JPY').trim().toUpperCase() || 'JPY';
  const currency = String(form?.currency || acc).trim().toUpperCase() || acc;
  const amount = Number(form?.amount) || 0;
  const isAccounting = currency === acc;
  const parsedRate = Number(rate);
  const snapshotRate = isAccounting
    ? 1
    : Number.isFinite(parsedRate) && parsedRate > 0
      ? parsedRate
      : 1;
  const hkdAmount = isAccounting
    ? Math.round(amount)
    : Math.round(amount * snapshotRate);

  const row = {
    from: String(form?.from ?? '').trim(),
    to: String(form?.to ?? '').trim(),
    amount,
    currency,
    hkdAmount,
    rate: snapshotRate,
    date: String(form?.date ?? '').trim(),
    note: form?.note == null ? '' : String(form.note).trim(),
  };
  if (form?.id) {
    row.id = form.id;
  }
  return row;
}

export function hasUnknownParticipant(settlement, participants = []) {
  const known = new Set(
    (Array.isArray(participants) ? participants : [])
      .map((p) => String(p ?? '').trim())
      .filter((p) => p && p !== '共同'),
  );
  const from = String(settlement?.from ?? '').trim();
  const to = String(settlement?.to ?? '').trim();
  return !from || !to || !known.has(from) || !known.has(to);
}

/**
 * Filter trip settlements for Ledger display:
 * - Hidden when category or payment filter is active (non-'全部').
 * - Payer filter: matches when payer === '全部' or s.from === payer.
 * - Person chip: matches when person === '全部' or s.from === person or s.to === person.
 * - Date filter: matches undated or date key.
 * - Search query: matches note, from, or to.
 */
export function filterSettlements(
  settlements = [],
  {
    person = '全部',
    category = '全部',
    date = '全部',
    query = '',
    payment = '全部',
    payer = '全部',
  } = {},
) {
  if (!Array.isArray(settlements) || settlements.length === 0) return [];
  if (category && category !== '全部') return [];
  if (payment && payment !== '全部') return [];

  const q = String(query || '').trim().toLowerCase();

  return settlements.filter((s) => {
    if (!s) return false;
    const from = String(s.from ?? '').trim();
    const to = String(s.to ?? '').trim();
    const note = String(s.note ?? '').trim();
    const sDateKey = s.date ? expenseDateKey(s.date) : '';

    if (payer && payer !== '全部' && from !== payer) return false;
    if (person && person !== '全部' && from !== person && to !== person) return false;
    if (date === 'undated' && sDateKey) return false;
    if (date && date !== '全部' && date !== 'undated' && sDateKey !== date) return false;
    if (q && !`${from} ${to} ${note}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Merge filtered settlements into groupLedger output for rendering only.
 * Never alters group `total` (which remains expense-only).
 */
export function mergeGroupsWithSettlements(expenseGroups = [], settlements = []) {
  const base = Array.isArray(expenseGroups)
    ? expenseGroups.map((g) => ({
        ...g,
        items: Array.isArray(g.items) ? [...g.items] : [],
        settlements: [],
      }))
    : [];
  if (!Array.isArray(settlements) || settlements.length === 0) {
    return base;
  }

  const byKey = new Map();
  for (const g of base) {
    byKey.set(g.key, g);
  }

  for (const s of settlements) {
    if (!s) continue;
    const iso = s.date ? expenseDateKey(s.date) : '';
    const key = iso || 'undated';
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        label: iso ? expenseDateLabel(iso) : '未有日期',
        iso: iso || null,
        items: [],
        settlements: [],
        total: 0,
      };
      byKey.set(key, g);
    }
    g.settlements.push(s);
  }

  const dated = [];
  let undated = null;
  for (const g of byKey.values()) {
    if (g.key === 'undated') {
      undated = g;
    } else {
      dated.push(g);
    }
  }
  dated.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  if (undated) dated.push(undated);
  return dated;
}
