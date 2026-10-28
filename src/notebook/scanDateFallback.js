import i18n from '../i18n';
import { isValidISODate } from '../proto/ref/refRules';
import { localISODate } from '../proto/shared/dates';
import { normalizeDate } from '../utils/duplicates';

export const SCAN_DATE_FALLBACK_SELECTED_KEY = 'notebook.scan.dateFallbackSelected';
export const SCAN_DATE_FALLBACK_TODAY_KEY = 'notebook.scan.dateFallbackToday';

function resolveTranslator(tOrOptions) {
  if (typeof tOrOptions === 'function') return tOrOptions;
  if (tOrOptions && typeof tOrOptions.t === 'function') return tOrOptions.t;
  return (key, opts) => i18n.t(key, opts);
}

function toValidISO(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidISODate(trimmed)) return trimmed;
  const normalized = normalizeDate(trimmed);
  return normalized && isValidISODate(normalized) ? normalized : null;
}

/**
 * Resolve the fallback ISO date and its source when an AI receipt has no explicit date:
 * - Uses `selectedDay` (ISO) when valid -> `{ date, source: 'selected' }`.
 * - Otherwise falls back to `today` (ISO if valid, else local date of `now`) -> `{ date, source: 'today' }`.
 *
 * @param {{
 *   selectedDay?: string | null,
 *   today?: string | null,
 *   now?: Date | string | number,
 * }} [options]
 * @returns {{ date: string, source: 'selected' | 'today' }}
 */
export function resolveScanFallbackDate({ selectedDay, today, now } = {}) {
  const validSelected = toValidISO(selectedDay);
  if (validSelected) {
    return { date: validSelected, source: 'selected' };
  }

  const validToday = toValidISO(today);
  if (validToday) {
    return { date: validToday, source: 'today' };
  }

  if (typeof now === 'string') {
    const validNowIso = toValidISO(now);
    if (validNowIso) {
      return { date: validNowIso, source: 'today' };
    }
    const parsedNow = new Date(now);
    if (!Number.isNaN(parsedNow.getTime())) {
      return { date: localISODate(parsedNow), source: 'today' };
    }
  }

  const dt =
    now instanceof Date && !Number.isNaN(now.getTime())
      ? now
      : typeof now === 'number' && Number.isFinite(now)
        ? new Date(now)
        : new Date();

  return { date: localISODate(dt), source: 'today' };
}

/**
 * Idempotently resolve the target fallback date and source ('selected' | 'today')
 * for a scan request in NotebookApp, including repeated AddForm auto-scan calls
 * under React StrictMode and direct-URL add-route scan entries.
 *
 * @param {{
 *   date?: string | null,
 *   dateSource?: 'selected' | 'today' | null,
 *   auto?: boolean,
 *   selectedDay?: string | null,
 *   routeDate?: string | null,
 *   routeDateSource?: 'selected' | 'today' | null,
 *   pending?: { date?: string, dateSource?: 'selected' | 'today' } | null,
 *   today?: string | null,
 *   defaultDate?: string,
 * }} [options]
 * @returns {{ date: string, dateSource: 'selected' | 'today' }}
 */
export function resolveScanRequestTarget({
  date,
  dateSource,
  auto = false,
  selectedDay = null,
  routeDate = null,
  routeDateSource = null,
  pending = null,
  today = null,
  defaultDate = '',
} = {}) {
  const explicitSource =
    dateSource === 'selected' || dateSource === 'today'
      ? dateSource
      : auto && (routeDateSource === 'selected' || routeDateSource === 'today')
        ? routeDateSource
        : auto && (pending?.dateSource === 'selected' || pending?.dateSource === 'today')
          ? pending.dateSource
          : undefined;

  const rawDateCandidate = (auto && pending?.date) || date || '';
  const formCandidateSelected =
    !auto &&
    rawDateCandidate &&
    rawDateCandidate !== today &&
    rawDateCandidate !== defaultDate
      ? rawDateCandidate
      : null;

  const resolved = resolveScanFallbackDate({
    selectedDay:
      explicitSource === 'selected'
        ? rawDateCandidate || selectedDay || (auto ? routeDate : null)
        : explicitSource === 'today'
          ? null
          : selectedDay || (auto ? routeDate : formCandidateSelected),
    today: explicitSource === 'today' ? rawDateCandidate || today : today,
  });

  const targetDate =
    toValidISO(rawDateCandidate) ||
    resolved.date ||
    defaultDate;
  const effectiveSource = explicitSource || resolved.source;

  return {
    date: targetDate,
    dateSource: effectiveSource,
  };
}

/**
 * Apply the fallback ISO date to each parsed receipt result that lacks an explicit AI date
 * (`aiDateMissing` truthy). Keeps `aiDateMissing` non-enumerable as before and leaves
 * receipts with explicit dates untouched.
 *
 * @param {Record<string, any>[]} results
 * @param {{
 *   date?: string,
 *   selectedDay?: string | null,
 *   today?: string | null,
 *   now?: Date | string | number,
 * }} [options]
 * @returns {{ results: Record<string, any>[], missingCount: number }}
 */
export function applyScanDateFallback(
  results,
  { date, selectedDay, today, now } = {},
) {
  if (!Array.isArray(results)) {
    return { results: [], missingCount: 0 };
  }

  const fallbackIso =
    toValidISO(date) ||
    resolveScanFallbackDate({ selectedDay, today, now }).date;

  let missingCount = 0;
  const nextResults = results.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (!item.aiDateMissing) {
      return item;
    }

    missingCount += 1;
    const nextItem = {
      ...item,
      date: fallbackIso,
    };
    if ('aiDateMissing' in nextItem) {
      delete nextItem.aiDateMissing;
    }
    if ('scanFallbackDate' in nextItem) {
      delete nextItem.scanFallbackDate;
    }
    Object.defineProperty(nextItem, 'aiDateMissing', {
      value: true,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(nextItem, 'scanFallbackDate', {
      value: fallbackIso,
      enumerable: false,
      configurable: true,
    });
    return nextItem;
  });

  return { results: nextResults, missingCount };
}

/**
 * Build the localized toast notice when one or more scanned receipts lacked a date
 * and fell back to the selected calendar day or today.
 * Returns `null` when `missingCount === 0` (all receipts had explicit dates).
 *
 * @param {{
 *   missingCount?: number,
 *   date?: string,
 *   source?: 'selected' | 'today',
 *   t?: ((key: string, opts?: Record<string, any>) => string) | { t?: (key: string, opts?: Record<string, any>) => string },
 * }} [options]
 * @returns {string | null}
 */
export function buildDateFallbackNotice({
  missingCount = 0,
  date = '',
  source = 'today',
  t,
} = {}) {
  const count = Number(missingCount) || 0;
  if (count <= 0) return null;

  const iso =
    toValidISO(date) ||
    resolveScanFallbackDate({ today: date }).date;
  const [, mStr, dStr] = iso.split('-');
  const month = Number(mStr);
  const day = Number(dStr);

  const effectiveSource = source === 'selected' ? 'selected' : 'today';
  const baseKey =
    effectiveSource === 'selected'
      ? SCAN_DATE_FALLBACK_SELECTED_KEY
      : SCAN_DATE_FALLBACK_TODAY_KEY;

  const translate = resolveTranslator(t);
  let msg = translate(baseKey, { count, month, day });

  if (count === 1 && typeof msg === 'string' && /^1\s/.test(msg)) {
    msg = translate(`${baseKey}_one`, { count, month, day });
  } else if (msg === baseKey) {
    const suffix = count === 1 ? '_one' : '_other';
    msg = translate(`${baseKey}${suffix}`, { count, month, day });
  }

  return msg;
}
