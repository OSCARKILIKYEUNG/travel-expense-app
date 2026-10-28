import i18n from '../i18n';
import { buildExpenseFromAI } from '../services/AIService';
import { formatDateToDisplay } from '../utils/date';
import { normalizeDate } from '../utils/duplicates';
import { SCAN_ERROR_DEFAULT_KEY } from './useReceiptScan';

export const FIXTURE_SCAN_DELAY_MS = 600;
export const FIXTURE_ERROR_KEY = SCAN_ERROR_DEFAULT_KEY;
export const FIXTURE_ERROR_MESSAGE = i18n.t(FIXTURE_ERROR_KEY);

export function getFixtureErrorMessage(tOrOptions) {
  if (typeof tOrOptions === 'function') return tOrOptions(FIXTURE_ERROR_KEY);
  if (tOrOptions && typeof tOrOptions.t === 'function') return tOrOptions.t(FIXTURE_ERROR_KEY);
  return i18n.t(FIXTURE_ERROR_KEY);
}

/**
 * Resolve the fixture scan mode from URL query or hash
 * (`scanfixture=dup` | `scanfixture=error` | `scanfixture=nodate` | `scan=nodate`).
 *
 * @param {string} [search]
 * @param {string} [hash]
 * @returns {'default' | 'dup' | 'error' | 'nodate'}
 */
export function resolveScanFixtureMode(
  search = typeof window !== 'undefined' ? window.location.search : '',
  hash = typeof window !== 'undefined' ? window.location.hash : '',
) {
  const rawSearch = String(search || '').replace(/^\?/, '');
  const rawHash = String(hash || '').replace(/^#/, '');
  const searchParams = new URLSearchParams(rawSearch);
  const hashParams = new URLSearchParams(rawHash);
  const rawFixture = String(
    searchParams.get('scanfixture') ??
      hashParams.get('scanfixture') ??
      searchParams.get('scanFixture') ??
      hashParams.get('scanFixture') ??
      '',
  )
    .trim()
    .toLowerCase();
  const rawScan = String(
    searchParams.get('scan') ?? hashParams.get('scan') ?? '',
  )
    .trim()
    .toLowerCase();
  const raw = rawFixture || (rawScan && rawScan !== '1' && rawScan !== 'true' ? rawScan : '');

  if (raw === 'dup' || raw === 'duplicate') return 'dup';
  if (raw === 'error' || raw === 'err') return 'error';
  if (
    raw === 'nodate' ||
    raw === 'no-date' ||
    raw === 'no_date' ||
    raw === 'missingdate' ||
    raw === 'missing-date'
  ) {
    return 'nodate';
  }
  return 'default';
}

/**
 * Check whether the current URL is running in `?proto=notebook` preview mode.
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isProtoNotebook(
  search = typeof window !== 'undefined' ? window.location.search : '',
) {
  const rawSearch = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(rawSearch);
  return String(params.get('proto') ?? '').trim().toLowerCase() === 'notebook';
}

/**
 * Build a fake `parseReceipt`-shaped response for a JPY Lawson receipt
 * (2 items, total 1680, date = form date, time 13:05).
 *
 * @param {{ date?: string }} [options]
 */
export function buildLawsonFixtureParseResult({ date = '2026-10-22' } = {}) {
  const iso = normalizeDate(date) || '2026-10-22';
  const displayDate = formatDateToDisplay(iso) || '2026年10月22日';
  return {
    detected_market: 'JP',
    receipt_type: 'tax_inclusive',
    store: 'ローソン 河口湖駅前店',
    store_original: 'ローソン 河口湖駅前店',
    store_en: 'LAWSON Kawaguchiko Station',
    location: '河口湖',
    location_en: 'Kawaguchiko',
    category: '飲食',
    date: displayDate,
    time: '13:05',
    currency: 'JPY',
    payment_method: '現金',
    subtotal: 1680,
    tax: 0,
    tax_refund: 0,
    discount: 0,
    total_amount: 1680,
    items: [
      {
        name: '炸雞塊',
        original_name: 'からあげクン',
        name_en: 'Karaage-kun',
        price: 248,
      },
      {
        name: '幕之內便當',
        original_name: '幕の内弁当',
        name_en: 'Makunouchi Bento',
        price: 1432,
      },
    ],
  };
}

/**
 * Build a fake `parseReceipt`-shaped response that duplicates an existing mock expense
 * so `splitBatchByDuplicates` flags it and `DuplicateReviewDialog` opens.
 *
 * @param {{ date?: string, existingExpenses?: Record<string, any>[] }} [options]
 */
export function buildDuplicateFixtureParseResult({
  date = '2026-10-22',
  existingExpenses = [],
} = {}) {
  const wantIso = normalizeDate(date) || '2026-10-22';
  const list = Array.isArray(existingExpenses) ? existingExpenses : [];
  const sameDayMatches = list.filter(
    (e) => e && e.date && normalizeDate(e.date) === wantIso && e.store,
  );
  // Prefer a concise store name on the target date so dialog summary lines stay compact at 375px
  const sortedSameDay = [...sameDayMatches].sort(
    (a, b) => String(a.store || '').length - String(b.store || '').length,
  );
  const target =
    sortedSameDay[0] ||
    list.find((e) => e && e.date && normalizeDate(e.date) && e.store) || {
      date: wantIso,
      store: '天上山纜車',
      place: '河口湖',
      category: '娛樂',
      originalAmount: 8250,
      currency: 'JPY',
      time: '12:10',
      payment: 'cash',
    };

  const targetIso = normalizeDate(target.date) || wantIso;
  const displayDate = formatDateToDisplay(targetIso) || '2026年10月22日';
  const total = Number(target.originalAmount) > 0 ? Number(target.originalAmount) : 8250;
  const firstPrice = Math.round(total / 2);
  const secondPrice = total - firstPrice;

  return {
    detected_market: 'JP',
    receipt_type: 'tax_inclusive',
    store: String(target.store || '天上山纜車'),
    store_original: String(target.storeOriginal || target.store || '天上山纜車'),
    store_en: String(target.storeEn || 'Mt. Fuji Panoramic Ropeway'),
    location: String(target.place || target.location || '河口湖'),
    location_en: String(target.locationEn || 'Kawaguchiko'),
    category: String(target.category || '娛樂'),
    date: displayDate,
    time: String(target.time || '13:05'),
    currency: String(target.currency || 'JPY').toUpperCase(),
    payment_method: target.payment === 'card' ? '信用卡' : '現金',
    subtotal: total,
    tax: 0,
    tax_refund: 0,
    discount: 0,
    total_amount: total,
    items: [
      {
        name: '成人來回票',
        original_name: '大人往復券',
        name_en: 'Adult Round-trip Ticket',
        price: firstPrice,
      },
      {
        name: '展望台小食套票',
        original_name: '展望台セット',
        name_en: 'Observatory Snack Set',
        price: secondPrice,
      },
    ],
  };
}

/**
 * Build a fake `parseReceipt`-shaped response for a JPY Lawson receipt with NO explicit date
 * so `buildExpenseFromAI` sets non-enumerable `aiDateMissing: true` and triggers the
 * scan date fallback + notice toast.
 */
export function buildNoDateFixtureParseResult() {
  const base = buildLawsonFixtureParseResult();
  return {
    ...base,
    date: '',
  };
}

/**
 * Build a full real expense record via `buildExpenseFromAI` from the fixture `parseReceipt` result.
 *
 * @param {{
 *   mode?: 'default' | 'dup' | 'error' | 'nodate',
 *   date?: string,
 *   existingExpenses?: Record<string, any>[],
 *   rate?: number,
 *   tripCurrency?: string,
 *   defaultAssignee?: string,
 *   allowedCategories?: string[] | null,
 *   sourceHash?: string,
 *   fallbackDate?: string,
 * }} [options]
 */
export function buildFixtureExpense({
  mode = 'default',
  date = '2026-10-22',
  existingExpenses = [],
  rate = 1 / 0.0526,
  tripCurrency = 'JPY',
  defaultAssignee = '共同',
  allowedCategories = null,
  sourceHash,
  fallbackDate = '',
} = {}) {
  if (mode === 'error') {
    throw new Error(getFixtureErrorMessage());
  }
  const rawResult =
    mode === 'dup'
      ? buildDuplicateFixtureParseResult({ date, existingExpenses })
      : mode === 'nodate'
        ? buildNoDateFixtureParseResult()
        : buildLawsonFixtureParseResult({ date });
  const currency = String(rawResult.currency || tripCurrency || 'JPY').toUpperCase();
  const effectiveRate = Number(rate) > 0 ? Number(rate) : 1 / 0.0526;
  const resolvedHash =
    sourceHash !== undefined
      ? sourceHash
      : mode === 'dup'
        ? 'fixture-dup-source-hash'
        : mode === 'nodate'
          ? 'fixture-nodate-source-hash'
          : 'fixture-lawson-1680-source-hash';

  return buildExpenseFromAI(
    rawResult,
    0,
    currency,
    effectiveRate,
    tripCurrency,
    defaultAssignee,
    allowedCategories,
    resolvedHash,
    fallbackDate,
  );
}
