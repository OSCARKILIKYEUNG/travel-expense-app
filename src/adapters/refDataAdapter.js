import { isValidISODate, parseHHMM } from '../proto/ref/refRules';
import { normalizeDate } from '../utils/duplicates';

/**
 * Normalize a raw payment method value into `'cash' | 'card' | ''`.
 * Accepts zh/en/ja variants (現金, 卡, 信用卡, cash, card, credit, debit, visa, etc.).
 * Unknown or empty inputs return `''`.
 *
 * @param {unknown} raw
 * @returns {'cash' | 'card' | ''}
 */
export function normalizePayment(raw) {
  if (raw == null || typeof raw === 'boolean' || typeof raw === 'number' || typeof raw === 'object') {
    return '';
  }
  const s = String(raw).normalize('NFKC').trim().toLowerCase();
  if (!s) return '';
  if (s === 'cash' || s === '現金' || s === '现金' || s === '現鈔') return 'cash';
  if (s === 'card' || s === '卡' || s === 'credit' || s === 'debit') return 'card';

  if (/cashless|non[-\s]?cash/.test(s)) {
    if (/(?:card|credit|debit|visa|master|jcb|amex|unionpay)|卡|クレジット|カード/.test(s)) {
      return 'card';
    }
    return '';
  }

  if (/(?:^|\b)cash(?:\b|$)|現金|现金|現鈔|現計|お預/.test(s)) {
    return 'cash';
  }

  if (
    /(?:^|\b)(?:card|credit|debit|visa|mastercard|master|jcb|amex|unionpay|suica|pasmo|icoca)(?:\b|$)|信用卡|刷卡|簽賬|簽帳|扣帳卡|借記卡|金融卡|銀行卡|クレジット|カード|卡/.test(
      s,
    )
  ) {
    return 'card';
  }

  return '';
}

/**
 * Extract and normalize an expense's time (`time` preferred, then `receiptTime`)
 * into zero-padded `'HH:MM'`, or `''` when absent/invalid.
 * Also accepts a raw time string directly.
 *
 * @param {unknown} e
 * @returns {string}
 */
export function normalizeExpenseTime(e) {
  if (e == null) return '';
  if (typeof e === 'string' || typeof e === 'number') {
    return parseHHMM(e) || '';
  }
  if (typeof e === 'object') {
    const fromTime = parseHHMM(e.time);
    if (fromTime) return fromTime;
    const fromReceiptTime = parseHHMM(e.receiptTime);
    if (fromReceiptTime) return fromReceiptTime;
  }
  return '';
}

/**
 * Map a persisted real expense record into the ref view-model shape.
 * Non-destructive: preserves existing keys and `date` format while populating
 * `place`, `location`, `payment`, `payer`, `time`, and `scanned`.
 *
 * @param {Record<string, any>} real
 * @returns {Record<string, any>}
 */
export function toRefExpense(real) {
  if (!real || typeof real !== 'object') {
    return {
      date: '',
      store: '',
      place: '',
      location: '',
      payment: '',
      payer: '',
      time: '',
      scanned: false,
      items: [],
    };
  }

  const place = String(real.place || real.location || '');
  const location = String(real.location || real.place || '');
  const payment = normalizePayment(real.payment) || normalizePayment(real.paymentMethod);
  const payer = real.payer != null ? String(real.payer).trim() : '';
  const time = normalizeExpenseTime(real);
  const date = real.date != null ? String(real.date) : '';
  const scanned =
    typeof real.scanned === 'boolean'
      ? real.scanned
      : Boolean(real.sourceHash || real.receiptType || real.aiDetectedMarket);
  const items = Array.isArray(real.items) ? real.items : [];

  return {
    ...real,
    date,
    place,
    location,
    payment,
    payer,
    time,
    scanned,
    items,
  };
}

function resolveNumericField(inputVal, baseVal) {
  if (typeof inputVal === 'number' && Number.isFinite(inputVal)) return inputVal;
  if (typeof inputVal === 'string') {
    const trimmed = inputVal.trim();
    if (trimmed === '') {
      return typeof baseVal === 'number' && Number.isFinite(baseVal) ? baseVal : 0;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof baseVal === 'number' && Number.isFinite(baseVal)) return baseVal;
  return undefined;
}

/**
 * Convert a ref view-model / form expense back into the persisted expense shape.
 * Spreads `existing` first so AI and legacy fields (`sourceHash`, `items`, `taxRefund`,
 * `receiptType`, `rate`, etc.) are never dropped. Writes both alias pairs:
 * `location` + `place` and `payment` + `paymentMethod`.
 *
 * @param {Record<string, any>} ref
 * @param {{ existing?: Record<string, any> | null }} [options]
 * @returns {Record<string, any>}
 */
export function fromRefExpense(ref, { existing } = {}) {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  const input = ref && typeof ref === 'object' ? ref : {};

  const store =
    input.store !== undefined
      ? String(input.store ?? '').trim()
      : base.store !== undefined
        ? String(base.store ?? '').trim()
        : '';

  const resolvedPlace =
    input.place !== undefined
      ? String(input.place ?? '')
      : input.location !== undefined
        ? String(input.location ?? '')
        : String(base.place ?? base.location ?? '');

  let rawPayment;
  if (input.payment !== undefined) {
    rawPayment = input.payment;
  } else if (input.paymentMethod !== undefined) {
    rawPayment = input.paymentMethod;
  } else if (base.payment !== undefined) {
    rawPayment = base.payment;
  } else {
    rawPayment = base.paymentMethod;
  }
  const payment = normalizePayment(rawPayment);

  const payer =
    input.payer !== undefined
      ? String(input.payer ?? '').trim()
      : base.payer !== undefined
        ? String(base.payer ?? '').trim()
        : '';

  let time = '';
  if (input.time !== undefined) {
    time = parseHHMM(input.time) || '';
  } else if (input.receiptTime !== undefined) {
    time = parseHHMM(input.receiptTime) || '';
  } else {
    time = normalizeExpenseTime(base);
  }

  let originalAmount = 0;
  if (input.originalAmount !== undefined && input.originalAmount !== '') {
    originalAmount = Number(input.originalAmount) || 0;
  } else if (input.amount !== undefined && input.amount !== '') {
    originalAmount = Number(input.amount) || 0;
  } else if (base.originalAmount !== undefined) {
    originalAmount = Number(base.originalAmount) || 0;
  }

  let hkdAmount = 0;
  if (input.hkdAmount !== undefined && input.hkdAmount !== '') {
    hkdAmount = Number(input.hkdAmount) || 0;
  } else if (base.hkdAmount !== undefined) {
    hkdAmount = Number(base.hkdAmount) || 0;
  }

  const date =
    input.date !== undefined
      ? String(input.date ?? '')
      : base.date !== undefined
        ? String(base.date ?? '')
        : '';

  const items = Array.isArray(input.items)
    ? input.items
    : Array.isArray(base.items)
      ? base.items
      : [];

  const merged = {
    ...base,
    ...input,
    store,
    location: resolvedPlace,
    place: resolvedPlace,
    payment,
    paymentMethod: payment,
    payer,
    time,
    date,
    originalAmount,
    hkdAmount,
    items,
  };

  for (const key of ['subtotal', 'tax', 'taxRefund', 'discount']) {
    const resolved = resolveNumericField(input[key], base[key]);
    if (resolved !== undefined) {
      merged[key] = resolved;
    }
  }

  if (!('amount' in base) && 'amount' in merged) {
    delete merged.amount;
  }

  return merged;
}

/**
 * Derive a trip's effective endDate:
 * - If `trip.endDate` is a valid ISO YYYY-MM-DD date, return it.
 * - Else return the maximum valid ISO date among `trip.startDate` and `trip.expenses` dates.
 * - If none, return `trip.startDate` or `null`.
 *
 * @param {Record<string, any> | null | undefined} trip
 * @returns {string | null}
 */
export function deriveEndDate(trip) {
  if (!trip || typeof trip !== 'object') return null;
  if (isValidISODate(trip.endDate)) return trip.endDate;

  const candidates = [];
  const startIso = isValidISODate(trip.startDate)
    ? trip.startDate
    : normalizeDate(trip.startDate);
  if (startIso && isValidISODate(startIso)) {
    candidates.push(startIso);
  }

  for (const exp of trip.expenses || []) {
    if (!exp?.date) continue;
    const iso = isValidISODate(exp.date) ? exp.date : normalizeDate(exp.date);
    if (iso && isValidISODate(iso)) {
      candidates.push(iso);
    }
  }

  if (candidates.length > 0) {
    candidates.sort();
    return candidates[candidates.length - 1];
  }

  return trip.startDate || null;
}

/**
 * Non-destructively ensure a trip object has `settings` (`people` default `['共同']`,
 * `budget` default `null`), `days` (default `{}`), and `endDate` (`null` if absent).
 *
 * @param {Record<string, any> | null | undefined} trip
 * @returns {Record<string, any>}
 */
export function ensureTripShape(trip) {
  const base = trip && typeof trip === 'object' ? trip : {};
  const rawSettings =
    base.settings && typeof base.settings === 'object' && !Array.isArray(base.settings)
      ? base.settings
      : {};
  const people =
    Array.isArray(rawSettings.people) && rawSettings.people.length > 0
      ? [...rawSettings.people]
      : ['共同'];
  const budget = rawSettings.budget !== undefined ? rawSettings.budget : null;
  const days =
    base.days && typeof base.days === 'object' && !Array.isArray(base.days)
      ? { ...base.days }
      : {};
  const endDate =
    base.endDate !== undefined && base.endDate !== '' ? base.endDate : null;
  const expenses = Array.isArray(base.expenses) ? [...base.expenses] : [];

  return {
    ...base,
    endDate,
    days,
    expenses,
    settings: {
      ...rawSettings,
      people,
      budget,
    },
  };
}

export const ensureTripDays = ensureTripShape;

/**
 * Build the redesign view-model trip from a real persisted trip:
 * applies `ensureTripShape`, maps `expenses` through `toRefExpense`,
 * applies optional `people` override, and derives `endDate` when unset.
 *
 * @param {Record<string, any> | null | undefined} realTrip
 * @param {{ people?: string[] }} [options]
 * @returns {Record<string, any>}
 */
export function toRefTrip(realTrip, { people } = {}) {
  const shaped = ensureTripShape(realTrip);
  const resolvedPeople =
    Array.isArray(people) && people.length > 0 ? [...people] : shaped.settings.people;
  const mappedExpenses = shaped.expenses.map((e) => toRefExpense(e));
  const endDate = deriveEndDate({ ...shaped, expenses: mappedExpenses });

  return {
    ...shaped,
    endDate,
    expenses: mappedExpenses,
    settings: {
      ...shaped.settings,
      people: resolvedPeople,
    },
  };
}
