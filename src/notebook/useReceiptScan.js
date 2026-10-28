import { useCallback, useRef, useState } from 'react';
import { toRefExpense } from '../adapters/refDataAdapter';
import { gateFilesBySourceHash, parseQueuedReceipts } from '../components/expense/uploadBatch';
import { STRIPE_UI_ENABLED } from '../config/features';
import i18n from '../i18n';
import { defaultTime, isValidISODate, parseHHMM } from '../proto/ref/refRules';
import { splitBatchByDuplicates, normalizeDate } from '../utils/duplicates';
import { buildAllowedExpenseCategories } from '../utils/expenseCategories';
import { isUploadBlocked } from '../utils/planView';
import { resolveParseQueue } from '../utils/sourceHash';
import {
  SCAN_DATE_FALLBACK_SELECTED_KEY,
  SCAN_DATE_FALLBACK_TODAY_KEY,
  applyScanDateFallback,
  buildDateFallbackNotice,
  resolveScanFallbackDate,
  resolveScanRequestTarget,
} from './scanDateFallback';

export {
  SCAN_DATE_FALLBACK_SELECTED_KEY,
  SCAN_DATE_FALLBACK_TODAY_KEY,
  applyScanDateFallback,
  buildDateFallbackNotice,
  resolveScanFallbackDate,
  resolveScanRequestTarget,
};

export const SCAN_LOADING_KEY = 'notebook.scan.loading';
export const SCAN_READY_KEY = 'notebook.scan.ready';
export const SCAN_ERROR_DEFAULT_KEY = 'notebook.scan.errorDefault';
export const SCAN_ERROR_TIMEOUT_KEY = 'notebook.scan.errorTimeout';
export const SCAN_ERROR_QUOTA_KEY = 'notebook.scan.errorQuota';

export const SCAN_LOADING_TEXT = i18n.t(SCAN_LOADING_KEY);
export const SCAN_READY_TEXT = i18n.t(SCAN_READY_KEY);
export const SCAN_DEFAULT_ERROR_TEXT = i18n.t(SCAN_ERROR_DEFAULT_KEY);

function resolveTranslator(tOrOptions) {
  if (typeof tOrOptions === 'function') return tOrOptions;
  if (tOrOptions && typeof tOrOptions.t === 'function') return tOrOptions.t;
  return (key, opts) => i18n.t(key, opts);
}

export function scanLoadingMessage(tOrOptions) {
  return resolveTranslator(tOrOptions)(SCAN_LOADING_KEY);
}

export function scanReadyMessage(tOrOptions) {
  return resolveTranslator(tOrOptions)(SCAN_READY_KEY);
}

/**
 * Select the i18n message key used when receipt upload is blocked by quota.
 * Matches classic `UploadArea` behavior (`STRIPE_UI_ENABLED` flag).
 *
 * @param {boolean} [stripeUiEnabled=STRIPE_UI_ENABLED]
 * @returns {'settings.billingUpgradePrompt' | 'upload.scanLimitReached'}
 */
export function blockedScanMessageKey(stripeUiEnabled = STRIPE_UI_ENABLED) {
  return stripeUiEnabled ? 'settings.billingUpgradePrompt' : 'upload.scanLimitReached';
}

/**
 * Pure check for whether opening the receipt picker is blocked by `planView`.
 * Returns `{ blocked, key, message, level }`.
 *
 * @param {Record<string, any> | null | undefined} planView
 * @param {{ stripeUiEnabled?: boolean, t?: (key: string) => string }} [options]
 */
export function checkScanBlocked(
  planView,
  { stripeUiEnabled = STRIPE_UI_ENABLED, t } = {},
) {
  if (!isUploadBlocked(planView)) {
    return {
      blocked: false,
      key: null,
      message: '',
      level: null,
    };
  }
  const key = blockedScanMessageKey(stripeUiEnabled);
  const message = typeof t === 'function' ? t(key) : key;
  return {
    blocked: true,
    key,
    message,
    level: 'warning',
  };
}

/**
 * Build the `deps` object passed to `parseQueuedReceipts(queue, deps)`,
 * matching classic `UploadArea.parseDeps()`.
 *
 * @param {{
 *   settings?: Record<string, any> | null,
 *   customCats?: string[],
 *   session?: { access_token?: string } | null,
 *   accessToken?: string,
 *   homeCurrencyCode?: string,
 *   tripCurrency?: string,
 *   exchangeRates?: Record<string, any> | null,
 *   defaultAssignee?: string,
 *   allowedCategories?: string[] | null,
 *   applyBillingSnapshot?: (snapshot: object) => void,
 *   refreshBilling?: () => Promise<any>,
 * }} [input]
 */
export function buildScanDeps({
  settings = null,
  customCats,
  session = null,
  accessToken,
  homeCurrencyCode = 'HKD',
  tripCurrency = 'JPY',
  exchangeRates = {},
  defaultAssignee = '共同',
  allowedCategories,
  applyBillingSnapshot,
  refreshBilling,
  fallbackDate = '',
} = {}) {
  const resolvedCustomCats = Array.isArray(customCats)
    ? customCats
    : settings?.customExpenseCategories || [];
  const resolvedAllowedCategories =
    allowedCategories !== undefined
      ? allowedCategories
      : buildAllowedExpenseCategories(
          settings || { customExpenseCategories: resolvedCustomCats },
        );

  return {
    customCats: resolvedCustomCats,
    accessToken: accessToken !== undefined ? accessToken : session?.access_token || '',
    homeCurrencyCode: homeCurrencyCode || 'HKD',
    tripCurrency: tripCurrency || 'JPY',
    exchangeRates: exchangeRates && typeof exchangeRates === 'object' ? exchangeRates : {},
    defaultAssignee: defaultAssignee || '共同',
    allowedCategories: resolvedAllowedCategories,
    applyBillingSnapshot,
    refreshBilling,
    fallbackDate: fallbackDate ? String(fallbackDate).trim() : '',
  };
}

/**
 * Select the i18n key for a short single-line AddForm scan error banner,
 * or return `null` when `rawError` is already a short custom string (<= 18 chars).
 *
 * @param {unknown} rawError
 * @returns {string | null}
 */
export function shortScanErrorKey(rawError) {
  if (!rawError) return SCAN_ERROR_DEFAULT_KEY;
  const text =
    typeof rawError === 'string'
      ? rawError.trim()
      : String(rawError?.message || rawError || '').trim();
  if (!text) return SCAN_ERROR_DEFAULT_KEY;
  if (/逾時|timeout|504/i.test(text)) {
    return SCAN_ERROR_TIMEOUT_KEY;
  }
  if (/免費|額度|用完|quota/i.test(text)) {
    return SCAN_ERROR_QUOTA_KEY;
  }
  if (text.length <= 18) {
    return null;
  }
  return SCAN_ERROR_DEFAULT_KEY;
}

/**
 * Format a concise single-line banner error message via `t()` / locale keys.
 *
 * @param {unknown} rawError
 * @param {((key: string) => string) | { t?: (key: string) => string }} [tOrOptions]
 * @returns {string}
 */
export function shortScanErrorMessage(rawError, tOrOptions) {
  const translate = resolveTranslator(tOrOptions);
  const key = shortScanErrorKey(rawError);
  if (key) {
    return translate(key);
  }
  return typeof rawError === 'string'
    ? rawError.trim()
    : String(rawError?.message || rawError || '').trim();
}

/**
 * Map a full real expense object (from `buildExpenseFromAI`) into `AddForm` state fields.
 * - Uses `toRefExpense` for field normalization (`place`, `payment`, `payer`, `time`).
 * - Keeps `defaultDate` (or existing form date) when the AI date is missing.
 * - Keeps `defaultTime(now)` (or existing form time) when the AI time is missing.
 * - Keeps `payer`, `payment`, and `assignedTo` form defaults unless AI supplied them.
 * - Marks `scanned: true` and omits `id` so the form remains an ADD draft.
 *
 * @param {Record<string, any> | null | undefined} realExpense
 * @param {{
 *   defaultDate?: string,
 *   now?: Date | string,
 *   currentForm?: Record<string, any> | null,
 *   payerDefault?: string,
 *   paymentDefault?: string,
 *   defaultAssignee?: string,
 * }} [options]
 * @returns {Record<string, any>}
 */
export function scanResultToFormFields(
  realExpense,
  {
    defaultDate = '',
    now = new Date(),
    currentForm = null,
    payerDefault = '',
    paymentDefault = 'cash',
    defaultAssignee = '共同',
  } = {},
) {
  const raw = realExpense && typeof realExpense === 'object' ? realExpense : {};
  const ref = toRefExpense(raw);
  const cur = currentForm && typeof currentForm === 'object' ? currentForm : {};

  let amount = cur.amount ?? '';
  if (raw.originalAmount !== undefined && raw.originalAmount !== null && raw.originalAmount !== '') {
    const numAmt = Number(raw.originalAmount);
    if (Number.isFinite(numAmt) && numAmt > 0) {
      amount = String(raw.originalAmount);
    }
  } else if (raw.amount !== undefined && raw.amount !== null && String(raw.amount).trim() !== '') {
    amount = String(raw.amount).trim();
  }

  const currency = String(
    ref.currency || raw.originalCurrency || cur.currency || 'JPY',
  )
    .trim()
    .toUpperCase();

  const rawStore = String(ref.store || '').trim();
  const store =
    rawStore && rawStore !== '未知店舖' ? rawStore : String(cur.store ?? '');

  const rawPlace = String(ref.place || ref.location || '').trim();
  const place =
    rawPlace && rawPlace !== '未知地點' ? rawPlace : String(cur.place ?? '');

  const rawCat = String(ref.category || '').trim();
  const category =
    rawCat && rawCat !== '未分類' ? rawCat : String(cur.category || '飲食');

  const aiDate = !raw.aiDateMissing && ref.date ? normalizeDate(ref.date) : null;
  const fallbackDate = raw.scanFallbackDate ? normalizeDate(raw.scanFallbackDate) : null;
  const curDate = cur.date ? normalizeDate(cur.date) || String(cur.date) : '';
  const defDate = defaultDate ? normalizeDate(defaultDate) || String(defaultDate) : '';
  const date = aiDate || fallbackDate || defDate || curDate || '';

  const aiTime = ref.time || parseHHMM(raw.time) || parseHHMM(raw.receiptTime) || '';
  const fallbackTime = (cur.time && parseHHMM(cur.time)) || defaultTime(now);
  const time = aiTime || fallbackTime;

  const payer = ref.payer || cur.payer || payerDefault || '';
  const payment = ref.payment || cur.payment || paymentDefault || 'cash';

  const assignedTo =
    raw.assignedTo && (!cur.assignedTo || raw.assignedTo !== '共同')
      ? String(raw.assignedTo)
      : cur.assignedTo || raw.assignedTo || defaultAssignee || '共同';

  const subtotal =
    raw.subtotal !== undefined && raw.subtotal !== null && Number(raw.subtotal) !== 0
      ? String(raw.subtotal)
      : String(cur.subtotal ?? '');
  const tax =
    raw.tax !== undefined && raw.tax !== null && Number(raw.tax) !== 0
      ? String(raw.tax)
      : String(cur.tax ?? '');
  const taxRefund =
    raw.taxRefund !== undefined && raw.taxRefund !== null && Number(raw.taxRefund) !== 0
      ? String(raw.taxRefund)
      : String(cur.taxRefund ?? '');
  const discount =
    raw.discount !== undefined && raw.discount !== null && Number(raw.discount) !== 0
      ? String(raw.discount)
      : String(cur.discount ?? '');
  const note = raw.note ? String(raw.note) : String(cur.note ?? '');

  const next = {
    ...cur,
    currency,
    amount,
    store,
    place,
    category,
    date,
    time,
    payer,
    payment,
    assignedTo,
    subtotal,
    tax,
    taxRefund,
    discount,
    note,
    scanned: true,
  };
  if ('id' in next) {
    delete next.id;
  }
  return next;
}

/**
 * Route a saved expense through production duplicate semantics:
 * - Edits (`isEdit: true`) -> `{ action: 'update', record, clean: [], conflicts: [] }`
 * - Manual adds (`isScanned: false`) -> `{ action: 'add', record, clean: [record], conflicts: [] }`
 * - Scanned adds (`isScanned: true`) -> runs `splitBatchByDuplicates([record], existingExpenses)`:
 *   - Clean -> `{ action: 'add', record, clean, conflicts: [] }`
 *   - Conflict -> `{ action: 'conflict', record, clean, conflicts }`
 *
 * @param {Record<string, any>} record
 * @param {Record<string, any>[]} [existingExpenses]
 * @param {{ isEdit?: boolean, isScanned?: boolean }} [options]
 */
export function routeScannedSave(
  record,
  existingExpenses = [],
  { isEdit = false, isScanned = true } = {},
) {
  if (isEdit) {
    return {
      action: 'update',
      record,
      clean: [],
      conflicts: [],
    };
  }
  if (!isScanned) {
    return {
      action: 'add',
      record,
      clean: record ? [record] : [],
      conflicts: [],
    };
  }
  const { clean, conflicts } = splitBatchByDuplicates(
    record ? [record] : [],
    Array.isArray(existingExpenses) ? existingExpenses : [],
  );
  if (conflicts.length > 0) {
    return {
      action: 'conflict',
      record,
      clean,
      conflicts,
    };
  }
  return {
    action: 'add',
    record,
    clean,
    conflicts: [],
  };
}

/**
 * React hook for the notebook receipt scanner pipeline:
 * 1. Synchronous `requestScan()` checks `isUploadBlocked(planView)` and clicks the hidden file input.
 * 2. `handleFileChange` opens/keeps `AddForm`, sets loading banner, gates by `gateFilesBySourceHash`,
 *    and runs `parseQueuedReceipts`.
 * 3. Exposes `scanState`, `scanDraft` (`scanBase` for save), and `hashConflicts` for `HashDuplicateDialog`.
 */
export function useReceiptScan({
  planView,
  expenses,
  settings,
  session,
  homeCurrencyCode,
  tripCurrency,
  exchangeRates,
  defaultAssignee,
  applyBillingSnapshot,
  refreshBilling,
  notify,
  t,
  onOpenForm,
  onToast,
  selectedDay,
  today,
} = {}) {
  const fileInputRef = useRef(null);
  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;
  const pendingParseRef = useRef([]);
  const reviewingRef = useRef(false);
  const pendingScanRef = useRef({ date: '', dateSource: 'today', fromForm: false });

  const [scanState, setScanState] = useState({
    status: 'idle',
    message: '',
    draft: null,
    token: 0,
  });
  const [scanDraft, setScanDraft] = useState(null);
  const [hashConflicts, setHashConflicts] = useState([]);

  const clearScan = useCallback(() => {
    setScanDraft(null);
    setScanState({ status: 'idle', message: '', draft: null, token: 0 });
  }, []);

  const translate = useCallback(
    (key, options) => (typeof t === 'function' ? t(key, options) : i18n.t(key, options)),
    [t],
  );

  const runParse = useCallback(
    async (queue) => {
      setScanState({
        status: 'loading',
        message: translate(SCAN_LOADING_KEY),
        draft: null,
        token: Date.now(),
      });
      const pending = pendingScanRef.current || {
        date: '',
        dateSource: undefined,
        fromForm: false,
      };
      const resolvedFallback = resolveScanFallbackDate({
        selectedDay:
          pending.dateSource === 'selected'
            ? pending.date || selectedDay
            : pending.dateSource === 'today'
              ? null
              : pending.date || selectedDay,
        today: pending.dateSource === 'today' ? pending.date || today : today,
      });
      const fallbackDate =
        pending.date && isValidISODate(pending.date)
          ? pending.date
          : resolvedFallback.date;
      const fallbackSource =
        pending.dateSource === 'selected' || pending.dateSource === 'today'
          ? pending.dateSource
          : resolvedFallback.source;

      const deps = buildScanDeps({
        settings,
        session,
        homeCurrencyCode,
        tripCurrency,
        exchangeRates,
        defaultAssignee,
        applyBillingSnapshot,
        refreshBilling,
        fallbackDate,
      });
      const { results: rawResults, lastError } = await parseQueuedReceipts(queue, deps);
      const { results, missingCount } = applyScanDateFallback(rawResults, {
        date: fallbackDate,
      });
      if (results.length > 0) {
        if (missingCount > 0) {
          const notice = buildDateFallbackNotice({
            missingCount,
            date: fallbackDate,
            source: fallbackSource,
            t: translate,
          });
          if (notice) {
            onToast?.(notice);
          }
        }
        const draft = results[0];
        setScanDraft(draft);
        setScanState({
          status: 'ready',
          message: translate(SCAN_READY_KEY),
          draft,
          token: Date.now(),
        });
      } else if (lastError) {
        notify?.(lastError, 'error');
        const shortMsg = shortScanErrorMessage(lastError, translate);
        onToast?.(shortMsg);
        setScanState({
          status: 'error',
          message: shortMsg,
          draft: null,
          token: Date.now(),
        });
      } else {
        setScanState({
          status: 'idle',
          message: '',
          draft: null,
          token: Date.now(),
        });
      }
      return { results, missingCount, lastError };
    },
    [
      settings,
      session,
      homeCurrencyCode,
      tripCurrency,
      exchangeRates,
      defaultAssignee,
      applyBillingSnapshot,
      refreshBilling,
      notify,
      onToast,
      translate,
      selectedDay,
      today,
    ],
  );

  const finishHashReview = useCallback(
    async (decisions) => {
      const queue = resolveParseQueue(pendingParseRef.current, hashConflicts, decisions);
      pendingParseRef.current = [];
      reviewingRef.current = false;
      setHashConflicts([]);
      if (!queue.length) {
        setScanState({
          status: 'idle',
          message: '',
          draft: null,
          token: Date.now(),
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      await runParse(queue);
    },
    [hashConflicts, runParse],
  );

  const confirmHashConflicts = useCallback(
    (decisions) => {
      void finishHashReview(decisions);
    },
    [finishHashReview],
  );

  const closeHashConflicts = useCallback(() => {
    void finishHashReview({});
  }, [finishHashReview]);

  const requestScan = useCallback(
    ({
      date = '',
      dateSource,
      selectedDay: reqSelectedDay,
      today: reqToday,
      fromForm = false,
    } = {}) => {
      if (reviewingRef.current || hashConflicts.length > 0 || scanState.status === 'loading') {
        return false;
      }
      const block = checkScanBlocked(planView, { stripeUiEnabled: STRIPE_UI_ENABLED, t });
      if (block.blocked) {
        notify?.(block.message, block.level);
        onToast?.(block.message);
        return false;
      }
      const resolved = resolveScanFallbackDate({
        selectedDay:
          dateSource === 'selected'
            ? date || reqSelectedDay || selectedDay
            : dateSource === 'today'
              ? null
              : reqSelectedDay !== undefined
                ? reqSelectedDay
                : date || selectedDay,
        today: dateSource === 'today' ? date || reqToday || today : reqToday || today,
      });
      const effectiveSource =
        dateSource === 'selected' || dateSource === 'today'
          ? dateSource
          : resolved.source;
      const effectiveDate = date && isValidISODate(date) ? date : resolved.date;
      pendingScanRef.current = {
        date: effectiveDate,
        dateSource: effectiveSource,
        fromForm: Boolean(fromForm),
      };
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
      return true;
    },
    [
      planView,
      t,
      notify,
      onToast,
      hashConflicts.length,
      scanState.status,
      selectedDay,
      today,
    ],
  );

  const handleFileChange = useCallback(
    async (e) => {
      const files = Array.from(e?.target?.files || []);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!files.length || reviewingRef.current) {
        return;
      }
      const file = files[0];
      const pending = pendingScanRef.current || {
        date: '',
        dateSource: 'today',
        fromForm: false,
      };
      const resolved = resolveScanFallbackDate({
        selectedDay:
          pending.dateSource === 'selected' ? pending.date || selectedDay : null,
        today: pending.date || today,
      });
      const targetDate =
        pending.date && isValidISODate(pending.date) ? pending.date : resolved.date;
      const targetSource =
        pending.dateSource === 'selected' || pending.dateSource === 'today'
          ? pending.dateSource
          : resolved.source;
      onOpenForm?.({
        date: targetDate,
        dateSource: targetSource,
        fromForm: pending.fromForm,
      });
      setScanDraft(null);
      setScanState({
        status: 'loading',
        message: translate(SCAN_LOADING_KEY),
        draft: null,
        token: Date.now(),
      });

      try {
        const { toParse, conflicts: found } = await gateFilesBySourceHash(
          files,
          expensesRef.current || [],
        );
        if (found.length > 0) {
          pendingParseRef.current = toParse;
          reviewingRef.current = true;
          setHashConflicts(found);
          return;
        }
        return await runParse(toParse);
      } catch (err) {
        reviewingRef.current = false;
        const rawMsg = err?.message || String(err);
        notify?.(rawMsg, 'error');
        const shortMsg = shortScanErrorMessage(rawMsg, translate);
        onToast?.(shortMsg);
        setScanState({
          status: 'error',
          message: shortMsg,
          draft: null,
          token: Date.now(),
        });
      }
    },
    [onOpenForm, runParse, notify, onToast, translate, selectedDay, today],
  );

  return {
    fileInputRef,
    scanState,
    scanDraft,
    hashConflicts,
    requestScan,
    handleFileChange,
    confirmHashConflicts,
    closeHashConflicts,
    clearScan,
  };
}
