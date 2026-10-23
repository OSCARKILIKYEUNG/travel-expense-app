import { fromRefExpense, toRefExpense, toRefTrip } from '../adapters/refDataAdapter';
import { isValidISODate, parseRate, resolveToday } from '../proto/ref/refRules';
import { toHome } from '../utils/currency';
import { formatDateToDisplay } from '../utils/date';
import { normalizeDate } from '../utils/duplicates';
import { getAccountingCode, getTripCurrencyCode } from '../utils/tripMoney';

/**
 * Default notebook fallback rate (1 JPY -> HKD) matching mockRefTrip.
 */
export const DEFAULT_REF_RATE = 0.0526;

/**
 * Default empty day entry shape for `trip.days[iso]`.
 */
export const EMPTY_DAY = Object.freeze({
  title: '',
  note: '',
  sticker: null,
  journal: '',
  itinerary: [],
});

/**
 * Convert store exchange rate (`1 home = X foreign`, e.g. `exchangeRates.JPY = 19.23`
 * where `toHome` computes `hkd = originalAmount / rate`) into the notebook/proto rate
 * (`1 foreign = r home`, where `AddForm` computes `hkd = originalAmount * r`).
 *
 * Formula: `refRate = Number(1 / foreignPerHome)`
 *
 * @param {unknown} foreignPerHome
 * @param {number} [fallback=DEFAULT_REF_RATE]
 * @returns {number}
 */
export function foreignPerHomeToRefRate(foreignPerHome, fallback = DEFAULT_REF_RATE) {
  const n = Number(foreignPerHome);
  if (Number.isFinite(n) && n > 0) {
    return Number(1 / n);
  }
  return fallback;
}

/**
 * Convert a notebook/proto rate (`1 foreign = r home`, e.g. `0.0526`) back into the
 * persisted store `exchangeRates` convention (`1 home = X foreign`, e.g. `1 / 0.0526`).
 *
 * @param {unknown} refRate
 * @returns {number | null}
 */
export function refRateToForeignPerHome(refRate) {
  const r = parseRate(refRate);
  if (r === null) return null;
  return Number(1 / r);
}

/**
 * Resolve the effective `1 tripCurrency -> accountingCurrency` multiplier for `AddForm`
 * and `SettingsView`.
 *
 * Priority:
 * 1. If `tripCurrency === accountingCurrency`, returns `1`.
 * 2. If `exchangeRates[tripCurrency]` (or `trip.exchangeRates[tripCurrency]`) is a valid
 *    positive number (`units foreign per 1 home`), computes `Number(1 / rate)`.
 *    If `trip.settings.rate` is also set and matches within `1e-6`, returns `trip.settings.rate`
 *    to preserve clean user-entered decimals (e.g. `0.0526`).
 * 3. Else if `trip.settings.rate` is a valid positive number, returns it.
 * 4. Else returns `fallback` (`0.0526`).
 *
 * @param {Record<string, any> | null | undefined} trip
 * @param {Record<string, any> | null | undefined} [exchangeRates]
 * @param {number} [fallback=DEFAULT_REF_RATE]
 * @returns {number}
 */
export function tripRate(trip, exchangeRates, fallback = DEFAULT_REF_RATE) {
  const tripCurr = getTripCurrencyCode(trip);
  const accCurr = getAccountingCode(trip);
  if (tripCurr === accCurr) return 1;

  const rates =
    exchangeRates && typeof exchangeRates === 'object'
      ? exchangeRates
      : trip?.exchangeRates && typeof trip.exchangeRates === 'object'
        ? trip.exchangeRates
        : null;

  const explicitRate = parseRate(trip?.settings?.rate);
  const rawStoreRate = Number(rates?.[tripCurr]);

  if (Number.isFinite(rawStoreRate) && rawStoreRate > 0) {
    const derived = Number(1 / rawStoreRate);
    if (explicitRate !== null && Math.abs(derived - explicitRate) < 1e-6) {
      return explicitRate;
    }
    return derived;
  }

  if (explicitRate !== null) {
    return explicitRate;
  }

  return fallback;
}

export const resolveTripRate = tripRate;

/**
 * Merge a single day patch into a `trip.days` map using the default day shape
 * `{ title: '', note: '', sticker: null, journal: '', itinerary: [] }`.
 * Returns the full next `days` object ready for `updateTrip(tripId, { days: nextDays })`.
 *
 * @param {Record<string, any> | null | undefined} days
 * @param {string} iso
 * @param {Record<string, any> | null | undefined} patch
 * @returns {Record<string, any>}
 */
export function mergeDayPatch(days, iso, patch) {
  const baseDays = days && typeof days === 'object' && !Array.isArray(days) ? days : {};
  if (!iso) return { ...baseDays };
  const prevDay =
    baseDays[iso] && typeof baseDays[iso] === 'object' && !Array.isArray(baseDays[iso])
      ? baseDays[iso]
      : {};
  return {
    ...baseDays,
    [iso]: {
      ...EMPTY_DAY,
      ...prevDay,
      ...(patch && typeof patch === 'object' ? patch : {}),
    },
  };
}

/**
 * Map a notebook form payload into a persisted store expense record.
 * - Preserves `existing` fields (for edits) or `scanBase` fields (for new AI-scanned drafts,
 *   keeping `isEdit === false` while preserving `items`, `sourceHash`, `aiDetectedMarket`,
 *   `receiptType`, tax/refund fields, `nameEn`, etc.).
 * - Form-edited fields (`amount`/`originalAmount`, `currency`, `store`, `place`, `category`,
 *   `date`, `time`, `payer`, `payment`, `assignedTo`, `note`) win over `scanBase`/`existing`.
 * - Formats `date` via `normalizeDate` + `formatDateToDisplay` (`YYYY年M月D日`) to match classic
 *   `AddExpense` / `ExpenseList` / `EditExpenseDialog`, or `''` when undated.
 * - Computes `hkdAmount` and `rate` consistent with classic `toHome` when `exchangeRates` is available.
 *
 * @param {Record<string, any>} data
 * @param {{
 *   existing?: Record<string, any> | null,
 *   scanBase?: Record<string, any> | null,
 *   tripCurrency?: string,
 *   exchangeRates?: Record<string, any> | null,
 *   now?: Date
 * }} [options]
 */
export function preparePersistedExpense(
  data,
  {
    existing = null,
    scanBase = null,
    tripCurrency = 'JPY',
    exchangeRates = null,
    now = new Date(),
  } = {},
) {
  const input = data && typeof data === 'object' ? data : {};
  const hasId = input.id !== undefined && input.id !== null && input.id !== '';
  const isEdit = Boolean(hasId && existing);
  const mergeBase = existing || scanBase || null;
  const ts = now instanceof Date && !Number.isNaN(now.getTime()) ? now.getTime() : Date.now();
  const isoNow =
    now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();

  const savedId =
    existing && existing.id !== undefined
      ? existing.id
      : hasId
        ? input.id
        : `exp-${ts}`;

  const rawDateInput = input.date !== undefined ? input.date : mergeBase?.date;
  const isoDate = rawDateInput ? normalizeDate(rawDateInput) || '' : '';
  const displayDate = isoDate ? formatDateToDisplay(isoDate) : '';

  const mapped = fromRefExpense(
    {
      ...input,
      id: savedId,
      date: displayDate,
      ...(scanBase ? { scanned: true } : {}),
    },
    { existing: mergeBase },
  );

  const currency = String(mapped.currency || tripCurrency || 'JPY').toUpperCase();
  const rawStoreRate = Number(exchangeRates?.[currency]);
  const hasStoreRate = Number.isFinite(rawStoreRate) && rawStoreRate > 0;
  const storeRate = hasStoreRate
    ? rawStoreRate
    : Number(mapped.rate) > 0
      ? Number(mapped.rate)
      : 1;

  const hkdAmount = hasStoreRate
    ? toHome(mapped.originalAmount, currency, exchangeRates)
    : mapped.hkdAmount;

  const createdAt =
    isEdit && existing?.createdAt !== undefined
      ? existing.createdAt
      : input.createdAt || isoNow;

  const record = {
    ...mapped,
    id: savedId,
    currency,
    rate: storeRate,
    hkdAmount,
    createdAt,
  };
  if ('aiDateMissing' in record) {
    delete record.aiDateMissing;
  }

  const lastPayment =
    record.payment === 'cash' || record.payment === 'card' ? record.payment : undefined;

  return {
    record,
    refRecord: toRefExpense(record),
    isEdit,
    lastPayment,
    isoDate,
  };
}

/**
 * Adapt a real or mock trip into a safe renderable `refTrip` for `NotebookApp` / `Home`.
 * Guarantees `startDate` and `endDate` are valid `YYYY-MM-DD` strings (so `.split('-')` in
 * `Home.jsx` never throws) and populates `settings.rate` via `tripRate`.
 *
 * @param {Record<string, any> | null | undefined} realTrip
 * @param {{
 *   people?: string[],
 *   exchangeRates?: Record<string, any> | null,
 *   today?: string
 * }} [options]
 * @returns {Record<string, any>}
 */
export function adaptTripForNotebook(realTrip, { people, exchangeRates, today } = {}) {
  const adapted = toRefTrip(realTrip, { people });
  const safeToday = isValidISODate(today) ? today : resolveToday('');

  const rawStart = isValidISODate(adapted.startDate)
    ? adapted.startDate
    : normalizeDate(adapted.startDate);
  const safeStart = rawStart && isValidISODate(rawStart) ? rawStart : safeToday;

  const rawEnd = isValidISODate(adapted.endDate)
    ? adapted.endDate
    : normalizeDate(adapted.endDate);
  const safeEnd =
    rawEnd && isValidISODate(rawEnd) && rawEnd >= safeStart ? rawEnd : safeStart;

  const rate = tripRate(realTrip || adapted, exchangeRates);

  return {
    ...adapted,
    startDate: safeStart,
    endDate: safeEnd,
    settings: {
      ...adapted.settings,
      rate,
    },
  };
}
