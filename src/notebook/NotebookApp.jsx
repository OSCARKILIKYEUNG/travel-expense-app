import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toRefExpense } from '../adapters/refDataAdapter';
import DuplicateReviewDialog from '../components/expense/DuplicateReviewDialog';
import HashDuplicateDialog from '../components/expense/HashDuplicateDialog';
import '../i18n';
import { resolveStickerIdAfterSave } from '../motion/stickerKeyframes';
import { DURATION_MS } from '../motion/tokens';
import { createRefTrips } from '../proto/ref/mockRefTrip';
import { buildAddHash, parseRoute } from '../proto/ref/refLogic';
import {
  ERROR_TOAST_DURATION_MS,
  TOAST_DURATION_MS,
  UNDO_TOAST_DURATION_MS,
  applyUndo,
  defaultExpenseDate,
  defaultPayer,
  defaultPayment,
  isValidISODate,
  makeUndo,
  postSaveTarget,
  resolveToday,
  saveToastMessage,
  setTripDates,
  shouldKeepToastOnRoute,
  switchTripRoute,
  toastDurationMs,
  tripMonth,
} from '../proto/ref/refRules';
import { ledgerHash } from '../proto/ref/refCharts';
import { applyDuplicateDecisions } from '../utils/duplicateDecisions';
import { normalizeDate } from '../utils/duplicates';
import JournalPage from '../journal/JournalPage';
import {
  BookIcon,
  CalendarIcon,
  ChartIcon,
  CompassIcon,
  GearIcon,
  TriangleDownIcon,
} from '../journal/art/core';
import { formatPageDateLine, pageDateIso, pageNumberForTab } from '../journal/pageMeta';
import { formatAccountingAmount } from '../utils/currency';
import { Toast } from '../proto/ref/parts';
import Home from '../proto/ref/Home';
import DayView from '../proto/ref/DayView';
import Ledger from '../proto/ref/Ledger';
import AddForm from '../proto/ref/AddForm';
import ChartsView from '../proto/ref/ChartsView';
import SettingsView, { buildMockTrip, validateNewTrip } from './SettingsView';

export {
  buildMockTrip,
  validateNewTrip,
  ERROR_TOAST_DURATION_MS,
  TOAST_DURATION_MS,
  UNDO_TOAST_DURATION_MS,
  toastDurationMs,
};
import { createLegacySeedTrips, resolveNotebookSeed } from './legacySeed';
import {
  FIXTURE_SCAN_DELAY_MS,
  buildFixtureExpense,
  getFixtureErrorMessage,
  resolveScanFixtureMode,
} from './scanFixture';
import {
  adaptTripForNotebook,
  mergeDayPatch,
  preparePersistedExpense,
  refRateToForeignPerHome,
} from './tripRate';
import {
  SCAN_LOADING_KEY,
  SCAN_READY_KEY,
  applyScanDateFallback,
  buildDateFallbackNotice,
  resolveScanFallbackDate,
  resolveScanRequestTarget,
  routeScannedSave,
  scanResultToFormFields,
} from './useReceiptScan';

/** Toast state for showToast: `tone` is default | info | error; `action` is an optional extra button. */
export function buildToastState(message, undo = null, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  return {
    id: Date.now() + Math.random(),
    message,
    undo: undo ?? null,
    tone: opts.tone || 'default',
    action: opts.action || null,
  };
}

export function buildDeleteUndo(expense, { rawExpenses, fallbackExpenses = [] } = {}) {
  const targetId = expense?.id;
  const sourceList = Array.isArray(rawExpenses) ? rawExpenses : fallbackExpenses;
  const rawIdx = sourceList.findIndex((x) => String(x?.id) === String(targetId));
  const rawMatch = rawIdx >= 0 ? sourceList[rawIdx] : null;
  const fallbackIdx = fallbackExpenses.findIndex((x) => String(x?.id) === String(targetId));
  const resolvedIndex =
    rawIdx >= 0
      ? rawIdx
      : fallbackIdx >= 0
        ? fallbackIdx
        : sourceList.length;

  return makeUndo('delete', {
    expense: rawMatch || expense,
    index: resolvedIndex,
  });
}

export function buildSaveUndo({
  isEdit,
  id,
  rawExpenses,
  fallbackExpenses = [],
  persistedRecord = null,
  savedRecord = null,
} = {}) {
  const sourceList = Array.isArray(rawExpenses) ? rawExpenses : fallbackExpenses;
  const rawPrevious = isEdit
    ? sourceList.find((x) => String(x?.id) === String(id)) ||
      fallbackExpenses.find((x) => String(x?.id) === String(id)) ||
      null
    : null;
  const recordForUndo = persistedRecord || savedRecord;

  return isEdit
    ? makeUndo('edit', { expense: recordForUndo, previous: rawPrevious })
    : makeUndo('add', { expense: recordForUndo });
}

export const go = (hash, replace = false) => {
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState({ refPushed: true }, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

function currentWindowHash(initialHash = '') {
  if (typeof window === 'undefined') return initialHash;
  return window.location.hash || initialHash;
}

function currentWindowSearch() {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

function useRoute(initialHash = '') {
  const [route, setRoute] = useState(() => parseRoute(currentWindowHash(initialHash)));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}

function buildInitialMockTrips(search, today) {
  if (resolveNotebookSeed(search) === 'legacy') {
    return createLegacySeedTrips();
  }
  return createRefTrips().map((t) => adaptTripForNotebook(t, { today }));
}

/**
 * Presentation shell for the travel notebook redesign UI.
 * Used both by `NotebookShell` (with real `useApp()` data & production scanner)
 * and by `?proto=notebook` (integrate preview mock with fixture scanner) / unit tests.
 */
export default function NotebookApp({
  trip: controlledTrip,
  trips: controlledTrips,
  today: propToday,
  rate: propRate,
  initialHash = '',
  initialSelectedDay = null,
  initialToast = null,
  search: propSearch,
  scanner,
  rawExpenses,
  exchangeRates: propExchangeRates,
  defaultAssignee: propDefaultAssignee,
  onResolveDuplicateConflicts,
  actionsRef,
  onSelectTrip,
  onCreateTrip,
  onUpdateDay,
  onSaveExpense,
  onDeleteExpense,
  onUndo,
  onUpdateTrip,
  onSaveDates,
  onSaveBudget,
  onAddPerson,
  onRenamePerson,
  onRemovePerson,
  onAddSettlement,
  onUpdateSettlement,
  onRemoveSettlement,
  onSaveRate,
  uiLanguage,
  onChangeUiLanguage,
  updateSettings,
  account,
  onSignOut,
} = {}) {
  const { t, i18n } = useTranslation();
  const isControlled = controlledTrip !== undefined;
  const effectiveSearch = propSearch !== undefined ? propSearch : currentWindowSearch();
  const today = useMemo(() => propToday || resolveToday(effectiveSearch), [propToday, effectiveSearch]);
  const isLegacyMockSeed = useMemo(
    () => !isControlled && resolveNotebookSeed(effectiveSearch) === 'legacy',
    [isControlled, effectiveSearch],
  );

  const [mockTrips, setMockTrips] = useState(() =>
    buildInitialMockTrips(effectiveSearch, today),
  );
  const [mockActiveTripId, setMockActiveTripId] = useState(() =>
    buildInitialMockTrips(effectiveSearch, today)[0].id,
  );
  const [localControlledTrip, setLocalControlledTrip] = useState(null);

  useEffect(() => {
    setLocalControlledTrip(null);
  }, [controlledTrip]);

  const rawTrip = useMemo(() => {
    if (isControlled) return localControlledTrip || controlledTrip;
    return mockTrips.find((t) => String(t.id) === String(mockActiveTripId)) || mockTrips[0];
  }, [isControlled, localControlledTrip, controlledTrip, mockTrips, mockActiveTripId]);

  const trip = useMemo(() => adaptTripForNotebook(rawTrip, { today }), [rawTrip, today]);

  const effectiveRawExpenses = useMemo(() => {
    if (Array.isArray(rawExpenses)) return rawExpenses;
    if (!isControlled && Array.isArray(rawTrip?.expenses)) return rawTrip.expenses;
    return trip.expenses;
  }, [rawExpenses, isControlled, rawTrip, trip.expenses]);

  const effectiveExchangeRates = useMemo(
    () => propExchangeRates || rawTrip?.exchangeRates || trip.exchangeRates || null,
    [propExchangeRates, rawTrip, trip.exchangeRates],
  );

  const trips = useMemo(() => {
    if (isControlled) {
      const list = Array.isArray(controlledTrips) && controlledTrips.length > 0 ? controlledTrips : [trip];
      return list.map((t) =>
        String(t?.id) === String(trip.id) ? trip : adaptTripForNotebook(t, { today }),
      );
    }
    return mockTrips.map((t) => (String(t.id) === String(trip.id) ? trip : adaptTripForNotebook(t, { today })));
  }, [isControlled, controlledTrips, mockTrips, trip, today]);

  const route = useRoute(initialHash);
  const [selectedDay, setSelectedDay] = useState(() => {
    if (initialSelectedDay && isValidISODate(initialSelectedDay)) {
      return initialSelectedDay;
    }
    if (route.screen === 'day' && isValidISODate(route.day)) {
      return route.day;
    }
    const rawQs = String(effectiveSearch || '').replace(/^\?/, '');
    const qsSelected = new URLSearchParams(rawQs).get('selectedDay');
    if (qsSelected && isValidISODate(qsSelected)) {
      return qsSelected;
    }
    return null;
  });
  const [returnTo, setReturnTo] = useState('');
  const [addOrigin, setAddOrigin] = useState(() => ({ origin: 'home', originDay: null }));
  const [month, setMonth] = useState(() => tripMonth(trip, today));
  const [toast, setToast] = useState(initialToast);
  const [toastHover, setToastHover] = useState(false);
  const [toastFocus, setToastFocus] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [stickerId, setStickerId] = useState(null);

  useEffect(() => {
    if (route.screen === 'day' && isValidISODate(route.day)) {
      setSelectedDay(route.day);
    }
  }, [route.screen, route.day]);

  const clearStickerId = useCallback((playedId) => {
    setStickerId((prev) =>
      playedId === undefined || String(prev) === String(playedId) ? null : prev,
    );
  }, []);

  const [dupConflicts, setDupConflicts] = useState([]);
  const [pendingDupTargetHash, setPendingDupTargetHash] = useState('');

  // Fixture scanner state for ?proto=notebook (when no external scanner prop is supplied)
  const fixtureTimerRef = useRef(null);
  const pendingFixtureScanRef = useRef(null);
  const [fixtureScanState, setFixtureScanState] = useState({
    status: 'idle',
    message: '',
    draft: null,
    token: 0,
  });
  const [fixtureScanDraft, setFixtureScanDraft] = useState(null);

  const effectiveRate = propRate || trip.settings?.rate || 0.0526;

  const clearFixtureScan = useCallback(() => {
    if (fixtureTimerRef.current) {
      clearTimeout(fixtureTimerRef.current);
      fixtureTimerRef.current = null;
    }
    pendingFixtureScanRef.current = null;
    setFixtureScanDraft(null);
    setFixtureScanState({ status: 'idle', message: '', draft: null, token: 0 });
  }, []);

  const clearActiveScan = useCallback(() => {
    if (scanner?.clearScan) {
      scanner.clearScan();
    } else {
      clearFixtureScan();
    }
  }, [scanner, clearFixtureScan]);

  useEffect(
    () => () => {
      if (fixtureTimerRef.current) {
        clearTimeout(fixtureTimerRef.current);
      }
    },
    [],
  );

  const prevTripIdRef = useRef(String(trip.id));
  useEffect(() => {
    if (String(trip.id) !== prevTripIdRef.current) {
      prevTripIdRef.current = String(trip.id);
      setMonth(tripMonth(trip, today));
      setSelectedDay(null);
      clearActiveScan();
    }
  }, [trip, today, clearActiveScan]);

  const updateActiveMockTrip = useCallback(
    (updater) => {
      if (isControlled) {
        if (onUpdateTrip) {
          onUpdateTrip(updater);
        } else {
          setLocalControlledTrip((prev) => {
            const base = prev || controlledTrip;
            return typeof updater === 'function' ? updater(base) : updater;
          });
        }
        return;
      }
      setMockTrips((prev) =>
        prev.map((t) =>
          String(t.id) === String(mockActiveTripId)
            ? typeof updater === 'function'
              ? updater(t)
              : updater
            : t,
        ),
      );
    },
    [isControlled, controlledTrip, mockActiveTripId, onUpdateTrip],
  );

  const showToast = useCallback((message, undo = null, options = {}) => {
    setToastHover(false);
    setToastFocus(false);
    setToast(buildToastState(message, undo, options));
  }, []);

  const settlementActions = useMemo(() => {
    const accountingCurrencyCode = trip?.accountingCurrency || 'HKD';
    const fmtAmount = (n) => formatAccountingAmount(n, accountingCurrencyCode);

    const removeByIdSilent = (targetId) => {
      if (onRemoveSettlement) {
        onRemoveSettlement(targetId);
      } else {
        updateActiveMockTrip((tr) => ({
          ...tr,
          settlements: (Array.isArray(tr.settlements) ? tr.settlements : []).filter(
            (s) => String(s?.id) !== String(targetId),
          ),
        }));
      }
    };

    const addSilent = (record) => {
      if (onAddSettlement) {
        return onAddSettlement(record) || record;
      }
      updateActiveMockTrip((tr) => ({
        ...tr,
        settlements: [...(Array.isArray(tr.settlements) ? tr.settlements : []), record],
      }));
      return record;
    };

    const updateSilent = (id, patch) => {
      if (onUpdateSettlement) {
        return onUpdateSettlement(id, patch);
      }
      const nowIso = new Date().toISOString();
      updateActiveMockTrip((tr) => ({
        ...tr,
        settlements: (Array.isArray(tr.settlements) ? tr.settlements : []).map((s) =>
          String(s?.id) === String(id) ? { ...s, ...patch, id: s.id, updatedAt: nowIso } : s,
        ),
      }));
      return null;
    };

    return {
      add: (settlement) => {
        if (!settlement || typeof settlement !== 'object') return null;
        const now = new Date().toISOString();
        const row = {
          ...settlement,
          id: settlement.id || `stl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tripId: settlement.tripId || trip.id,
          from: String(settlement.from ?? '').trim(),
          to: String(settlement.to ?? '').trim(),
          amount: Number(settlement.amount) || 0,
          currency: settlement.currency || trip.accountingCurrency || 'HKD',
          hkdAmount: Number(settlement.hkdAmount) || 0,
          rate: Number(settlement.rate) > 0 ? Number(settlement.rate) : 1,
          date: settlement.date == null ? today : String(settlement.date),
          note: settlement.note == null ? '' : String(settlement.note),
          createdAt: settlement.createdAt || now,
          updatedAt: settlement.updatedAt || now,
        };
        const saved = addSilent(row) || row;
        showToast(
          t('notebook.settle.toastRecorded', {
            from: saved.from,
            to: saved.to,
            amount: fmtAmount(saved.hkdAmount),
          }),
          () => {
            removeByIdSilent(saved.id);
          },
        );
        return saved;
      },
      update: (id, patch) => {
        if (!id || !patch) return null;
        const prev =
          (Array.isArray(trip.settlements) ? trip.settlements : []).find(
            (s) => String(s?.id) === String(id),
          ) || null;
        const updated = updateSilent(id, patch);
        const merged = updated || { ...(prev || {}), ...patch, id };
        showToast(
          t('notebook.settle.toastRecorded', {
            from: merged.from,
            to: merged.to,
            amount: fmtAmount(merged.hkdAmount),
          }),
          prev
            ? () => {
                updateSilent(id, prev);
              }
            : null,
        );
        return merged;
      },
      remove: (idOrObj) => {
        const targetId =
          idOrObj && typeof idOrObj === 'object' ? idOrObj.id : idOrObj;
        if (!targetId) return false;
        const deleted =
          (Array.isArray(trip.settlements) ? trip.settlements : []).find(
            (s) => String(s?.id) === String(targetId),
          ) || (idOrObj && typeof idOrObj === 'object' ? { ...idOrObj } : null);
        removeByIdSilent(targetId);
        showToast(
          t('notebook.settle.toastDeleted'),
          deleted
            ? () => {
                addSilent(deleted);
              }
            : null,
        );
        return true;
      },
    };
  }, [
    trip.id,
    trip.accountingCurrency,
    trip.settlements,
    today,
    onAddSettlement,
    onUpdateSettlement,
    onRemoveSettlement,
    updateActiveMockTrip,
    showToast,
    t,
  ]);

  const toastPaused = toastHover || toastFocus;
  const prevScreenRef = useRef(route.screen);

  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    prevScreenRef.current = route.screen;
    if (!shouldKeepToastOnRoute(prevScreen, route.screen)) {
      setToast(null);
      setToastHover(false);
      setToastFocus(false);
    }
    if (prevScreen === 'add' && route.screen !== 'add') {
      clearActiveScan();
    }
  }, [route.screen, clearActiveScan]);

  useEffect(() => {
    if (!toast || toastPaused) return undefined;
    const durationMs = toastDurationMs(toast);
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, toastPaused]);

  useEffect(() => {
    if (route.screen === 'ledger' && route.focus) {
      const matched = trip.expenses.find((e) => String(e.id) === String(route.focus));
      setHighlightId(matched ? matched.id : route.focus);
    }
  }, [route.screen, route.focus, trip.expenses]);

  useEffect(() => {
    if (!highlightId || typeof window === 'undefined') return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-expense-id="${highlightId}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    const timer = setTimeout(() => setHighlightId(null), 1600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [highlightId, route.screen, route.day, route.pane]);

  useEffect(() => {
    if (!stickerId) return undefined;
    const timer = setTimeout(() => setStickerId(null), DURATION_MS.slow + 200);
    return () => clearTimeout(timer);
  }, [stickerId]);

  const openDay = useCallback((iso, pane = 'itinerary') => {
    if (isValidISODate(iso)) {
      setSelectedDay(iso);
    }
    go(`day=${iso}&pane=${pane}`);
  }, []);

  const openAdd = useCallback(
    (opts = {}) => {
      const currentHash = currentWindowHash().replace(/^#/, '');
      const currentRoute = parseRoute(currentHash);
      if (!shouldKeepToastOnRoute(currentRoute.screen, 'add')) {
        setToast(null);
        setToastHover(false);
        setToastFocus(false);
      }
      if (currentRoute.screen !== 'add') {
        setReturnTo(currentHash);
        const origin =
          currentRoute.screen === 'ledger' ? 'ledger' : currentRoute.screen === 'day' ? 'day' : 'home';
        setAddOrigin({ origin, originDay: currentRoute.screen === 'day' ? currentRoute.day : null });
      }

      const resolvedDate =
        opts.id
          ? undefined
          : opts.date !== undefined
            ? opts.date
            : defaultExpenseDate(trip, today);

      go(buildAddHash({ ...opts, date: resolvedDate }));
    },
    [trip, today],
  );

  const openFormForScan = useCallback(
    ({ date } = {}) => {
      const currentHash = currentWindowHash().replace(/^#/, '');
      const currentRoute = parseRoute(currentHash);
      if (currentRoute.screen === 'add') return;
      openAdd({ date: date || selectedDay || today });
    },
    [openAdd, selectedDay, today],
  );

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      openFormForScan,
      showToast,
    };
  }, [actionsRef, openFormForScan, showToast]);

  const startFixtureScan = useCallback(
    ({ date, dateSource } = {}) => {
      if (fixtureTimerRef.current) {
        clearTimeout(fixtureTimerRef.current);
      }
      const resolvedFallback = resolveScanFallbackDate({
        selectedDay:
          dateSource === 'selected'
            ? date || selectedDay
            : dateSource === 'today'
              ? null
              : date || selectedDay,
        today: dateSource === 'today' ? date || today : today,
      });
      const targetDate =
        (date && isValidISODate(date) ? date : '') ||
        resolvedFallback.date ||
        defaultExpenseDate(trip, today) ||
        '2026-10-22';
      const effectiveSource =
        dateSource === 'selected' || dateSource === 'today'
          ? dateSource
          : resolvedFallback.source;
      const people = trip.settings?.people || ['共同'];
      const defaultAssignee = people.includes('共同') ? '共同' : people[0] || '共同';
      const storeRate = refRateToForeignPerHome(effectiveRate) || 1 / 0.0526;

      setFixtureScanDraft(null);
      setFixtureScanState({
        status: 'loading',
        message: t(SCAN_LOADING_KEY),
        draft: null,
        token: Date.now(),
      });

      fixtureTimerRef.current = setTimeout(() => {
        fixtureTimerRef.current = null;
        const mode = resolveScanFixtureMode(
          currentWindowSearch(),
          currentWindowHash(initialHash),
        );
        if (mode === 'error') {
          const errMsg = getFixtureErrorMessage(t);
          showToast(errMsg);
          setFixtureScanState({
            status: 'error',
            message: errMsg,
            draft: null,
            token: Date.now(),
          });
          return;
        }

        const rawDraft = buildFixtureExpense({
          mode,
          date: targetDate,
          existingExpenses: effectiveRawExpenses,
          rate: storeRate,
          tripCurrency: trip.tripCurrency || 'JPY',
          defaultAssignee,
          fallbackDate: targetDate,
        });
        const { results, missingCount } = applyScanDateFallback([rawDraft], {
          date: targetDate,
        });
        const draft = results[0] || rawDraft;
        if (missingCount > 0) {
          const notice = buildDateFallbackNotice({
            missingCount,
            date: targetDate,
            source: effectiveSource,
            t,
          });
          if (notice) {
            showToast(notice);
          }
        }
        setFixtureScanDraft(draft);
        setFixtureScanState({
          status: 'ready',
          message: t(SCAN_READY_KEY),
          draft,
          token: Date.now(),
        });

        if (mode === 'dup') {
          const formFields = scanResultToFormFields(draft, {
            defaultDate: targetDate,
            payerDefault: defaultPayer(people),
            paymentDefault: defaultPayment(trip),
            defaultAssignee,
          });
          const { record } = preparePersistedExpense(formFields, {
            scanBase: draft,
            tripCurrency: trip.tripCurrency || 'JPY',
            exchangeRates: { [trip.tripCurrency || 'JPY']: storeRate },
          });
          const routed = routeScannedSave(record, effectiveRawExpenses, {
            isEdit: false,
            isScanned: true,
          });
          if (routed.conflicts.length > 0) {
            setDupConflicts(routed.conflicts);
            setPendingDupTargetHash(
              postSaveTarget({
                origin: addOrigin.origin,
                savedDate: normalizeDate(formFields.date) || '',
              }),
            );
          }
        }
      }, FIXTURE_SCAN_DELAY_MS);
    },
    [
      trip,
      selectedDay,
      effectiveRawExpenses,
      today,
      effectiveRate,
      initialHash,
      showToast,
      addOrigin.origin,
      t,
    ],
  );

  const handleRequestScan = useCallback(
    ({ date, dateSource, fromForm = false, auto = false } = {}) => {
      if (fromForm && !auto) {
        pendingFixtureScanRef.current = null;
      }
      const { date: targetDate, dateSource: effectiveSource } = resolveScanRequestTarget({
        date,
        dateSource,
        auto,
        selectedDay,
        routeDate: route.date,
        routeDateSource: route.dateSource,
        pending: auto ? pendingFixtureScanRef.current : null,
        today,
        defaultDate: defaultExpenseDate(trip, today),
      });

      if (scanner) {
        if (auto) return false;
        return scanner.requestScan({
          date: targetDate,
          dateSource: effectiveSource,
          fromForm,
        });
      }
      if (!fromForm) {
        pendingFixtureScanRef.current = {
          date: targetDate,
          dateSource: effectiveSource,
        };
        openAdd({
          scan: true,
          date: targetDate,
          dateSource: effectiveSource,
        });
        return true;
      }
      startFixtureScan({ date: targetDate, dateSource: effectiveSource });
      return true;
    },
    [
      scanner,
      selectedDay,
      route.date,
      route.dateSource,
      trip,
      today,
      openAdd,
      startFixtureScan,
    ],
  );

  const selectTrip = useCallback(
    (nextTripId) => {
      const target = trips.find((t) => String(t.id) === String(nextTripId));
      if (!target) return;
      if (String(target.id) === String(trip.id)) return;
      if (onSelectTrip) {
        onSelectTrip(target.id);
      } else {
        setMockActiveTripId(target.id);
      }
      setMonth(tripMonth(target, today));
      const curHash = currentWindowHash();
      const nextHash = switchTripRoute(curHash, target);
      if (nextHash !== curHash.replace(/^#/, '')) {
        go(nextHash, true);
      }
      showToast(t('notebook.toast.tripSwitched', { name: target.name }));
    },
    [trips, trip.id, today, onSelectTrip, showToast, t],
  );

  const handleCreateTrip = useCallback(
    ({ name, startDate, tripCurrency } = {}) => {
      const validated = validateNewTrip({ name, startDate, tripCurrency }, { today });
      if (!validated.ok) return validated;
      if (onCreateTrip) {
        return onCreateTrip({
          name: validated.name,
          startDate: validated.startDate,
          tripCurrency: validated.tripCurrency,
        });
      }
      const newTrip = buildMockTrip(validated, { today });
      setMockTrips((prev) => [...prev, newTrip]);
      setMockActiveTripId(newTrip.id);
      setMonth(tripMonth(newTrip, today));
      return newTrip;
    },
    [onCreateTrip, today],
  );

  const updateDay = useCallback(
    (iso, patch) => {
      if (onUpdateDay) {
        onUpdateDay(iso, patch);
        return;
      }
      updateActiveMockTrip((t) => ({
        ...t,
        days: mergeDayPatch(t.days, iso, patch),
      }));
    },
    [onUpdateDay, updateActiveMockTrip],
  );

  const handleSaveDates = useCallback(
    (datesPatch, nextTrip) => {
      const res = setTripDates(rawTrip || trip, datesPatch?.startDate, datesPatch?.endDate);
      if (onSaveDates) {
        const out = onSaveDates(datesPatch, nextTrip);
        if (res.ok) {
          const nextAdapted = {
            ...trip,
            startDate: res.startDate,
            endDate: res.endDate || res.startDate,
          };
          setMonth(tripMonth(nextAdapted, today));
        }
        return out;
      }
      if (!res.ok) return res;
      if (isControlled) {
        onUpdateTrip?.(res.trip);
      } else {
        updateActiveMockTrip((t) => ({
          ...t,
          startDate: res.startDate,
          endDate: res.endDate,
        }));
      }
      const nextAdapted = {
        ...trip,
        startDate: res.startDate,
        endDate: res.endDate || res.startDate,
      };
      setMonth(tripMonth(nextAdapted, today));
      return res;
    },
    [onSaveDates, rawTrip, trip, isControlled, onUpdateTrip, updateActiveMockTrip, today],
  );

  const deleteExpense = useCallback(
    (e) => {
      const tripId = trip.id;
      const undoOp = buildDeleteUndo(e, {
        rawExpenses: effectiveRawExpenses,
        fallbackExpenses: trip.expenses,
      });
      if (onDeleteExpense) {
        onDeleteExpense(e);
      } else {
        updateActiveMockTrip((t) => ({
          ...t,
          expenses: t.expenses.filter((x) => String(x.id) !== String(e.id)),
        }));
      }
      showToast(saveToastMessage({ kind: 'delete', expense: e }), {
        ...undoOp,
        tripId,
        highlightId: e.id,
      });
    },
    [trip.id, trip.expenses, effectiveRawExpenses, onDeleteExpense, updateActiveMockTrip, showToast],
  );

  const activeScanState = scanner ? scanner.scanState : fixtureScanState;
  const activeScanDraft = scanner ? scanner.scanDraft : fixtureScanDraft;

  const saveExpense = useCallback(
    (data) => {
      const tripId = trip.id;
      const isEdit = Boolean(data.id);
      const previousRecord = isEdit
        ? trip.expenses.find((x) => String(x.id) === String(data.id)) || null
        : null;
      const rawExisting = isEdit
        ? effectiveRawExpenses.find((x) => String(x?.id) === String(data.id)) || null
        : null;
      const normalizedDate = data.date ? normalizeDate(data.date) || '' : '';
      const targetHash = postSaveTarget({ origin: addOrigin.origin, savedDate: normalizedDate });

      let savedRecord;
      let persistedRecord = null;
      let savedId;

      if (onSaveExpense) {
        const res = onSaveExpense(data, { scanBase: activeScanDraft });
        if (res?.action === 'conflict' && Array.isArray(res.conflicts) && res.conflicts.length > 0) {
          setDupConflicts(res.conflicts);
          setPendingDupTargetHash(targetHash);
          return;
        }
        savedRecord = res?.savedRecord || {
          ...(previousRecord || {}),
          ...data,
          id: previousRecord ? previousRecord.id : data.id || `n${Date.now()}`,
          date: normalizedDate,
        };
        persistedRecord = res?.record || savedRecord;
        savedId = persistedRecord?.id ?? savedRecord.id;
      } else {
        const nextLastPayment =
          data.payment === 'cash' || data.payment === 'card' ? data.payment : undefined;

        if (!isEdit && (activeScanDraft || data.scanned)) {
          const storeRate = refRateToForeignPerHome(effectiveRate) || 1 / 0.0526;
          const { record, refRecord } = preparePersistedExpense(data, {
            existing: null,
            scanBase: activeScanDraft,
            tripCurrency: trip.tripCurrency || 'JPY',
            exchangeRates: effectiveExchangeRates || { [trip.tripCurrency || 'JPY']: storeRate },
          });
          if (nextLastPayment) {
            updateActiveMockTrip((t) => ({ ...t, lastPayment: nextLastPayment }));
          }
          const routed = routeScannedSave(record, effectiveRawExpenses, {
            isEdit: false,
            isScanned: true,
          });
          clearActiveScan();
          if (routed.action === 'conflict' && routed.conflicts.length > 0) {
            setDupConflicts(routed.conflicts);
            setPendingDupTargetHash(targetHash);
            return;
          }
          savedRecord = refRecord;
          persistedRecord = isLegacyMockSeed ? record : refRecord;
          savedId = persistedRecord.id;
          updateActiveMockTrip((t) => ({
            ...t,
            ...(nextLastPayment ? { lastPayment: nextLastPayment } : {}),
            expenses: [...t.expenses, persistedRecord],
          }));
        } else if (isLegacyMockSeed) {
          const storeRate = refRateToForeignPerHome(effectiveRate) || 1 / 0.0526;
          const { record, refRecord } = preparePersistedExpense(data, {
            existing: rawExisting,
            scanBase: null,
            tripCurrency: trip.tripCurrency || 'JPY',
            exchangeRates: effectiveExchangeRates || { [trip.tripCurrency || 'JPY']: storeRate },
          });
          savedRecord = refRecord;
          persistedRecord = record;
          savedId = record.id;
          updateActiveMockTrip((t) => {
            const patch = nextLastPayment ? { lastPayment: nextLastPayment } : {};
            if (isEdit) {
              return {
                ...t,
                ...patch,
                expenses: t.expenses.map((x) =>
                  String(x.id) === String(savedId) ? record : x,
                ),
              };
            }
            return { ...t, ...patch, expenses: [...t.expenses, record] };
          });
        } else {
          savedId = isEdit && previousRecord ? previousRecord.id : data.id || `n${Date.now()}`;
          savedRecord = isEdit
            ? {
                ...(previousRecord || {}),
                ...data,
                id: savedId,
                date: normalizedDate,
                ...(previousRecord?.createdAt !== undefined
                  ? { createdAt: previousRecord.createdAt }
                  : {}),
              }
            : {
                ...data,
                id: savedId,
                date: normalizedDate,
                createdAt: new Date().toISOString(),
                items: [],
              };
          persistedRecord = savedRecord;

          updateActiveMockTrip((t) => {
            const patch = nextLastPayment ? { lastPayment: nextLastPayment } : {};
            if (isEdit) {
              return {
                ...t,
                ...patch,
                expenses: t.expenses.map((x) =>
                  String(x.id) === String(savedId) ? savedRecord : x,
                ),
              };
            }
            return { ...t, ...patch, expenses: [...t.expenses, savedRecord] };
          });
        }
      }

      clearActiveScan();
      go(targetHash, true);
      setHighlightId(savedId);
      setStickerId(resolveStickerIdAfterSave({ isEdit, savedId }));

      const undoOp = buildSaveUndo({
        isEdit,
        id: savedId,
        rawExpenses: effectiveRawExpenses,
        fallbackExpenses: trip.expenses,
        persistedRecord,
        savedRecord,
      });

      showToast(saveToastMessage({ kind: isEdit ? 'edit' : 'add', expense: savedRecord }), {
        ...undoOp,
        tripId,
        highlightId: isEdit ? savedId : null,
      });
    },
    [
      trip.id,
      trip.expenses,
      trip.tripCurrency,
      effectiveRawExpenses,
      effectiveExchangeRates,
      isLegacyMockSeed,
      addOrigin.origin,
      onSaveExpense,
      activeScanDraft,
      effectiveRate,
      updateActiveMockTrip,
      clearActiveScan,
      showToast,
    ],
  );

  const finalizeDuplicateDialog = useCallback(
    (decisions) => {
      const currentConflicts = dupConflicts;
      setDupConflicts([]);
      clearActiveScan();
      if (onResolveDuplicateConflicts) {
        onResolveDuplicateConflicts(currentConflicts, decisions);
      } else {
        updateActiveMockTrip((t) => {
          const resolved = applyDuplicateDecisions(t.expenses, currentConflicts, decisions);
          return {
            ...t,
            expenses: isLegacyMockSeed
              ? resolved.expenses
              : resolved.expenses.map((e) => toRefExpense(e)),
          };
        });
      }
      const nextHash = pendingDupTargetHash || 'ledger';
      setPendingDupTargetHash('');
      if (parseRoute(currentWindowHash(initialHash)).screen === 'add') {
        go(nextHash, true);
      }
    },
    [
      dupConflicts,
      clearActiveScan,
      onResolveDuplicateConflicts,
      updateActiveMockTrip,
      isLegacyMockSeed,
      pendingDupTargetHash,
      initialHash,
    ],
  );

  const handleUndo = () => {
    if (!toast?.undo) return;
    if (typeof toast.undo === 'function') {
      toast.undo();
    } else if (onUndo) {
      onUndo(toast.undo);
      setHighlightId(toast.undo.highlightId ?? null);
    } else {
      const undoOp = toast.undo;
      const targetTripId = undoOp.tripId || trip.id;
      setMockTrips((all) =>
        all.map((t) =>
          String(t.id) === String(targetTripId) ? { ...t, expenses: applyUndo(t.expenses, undoOp) } : t,
        ),
      );
      setHighlightId(undoOp.highlightId ?? null);
    }
    setStickerId(null);
    setToastHover(false);
    setToastFocus(false);
    setToast(buildToastState(t('notebook.toast.undone'), null));
  };

  let body;
  if (route.screen === 'day') {
    body = (
      <DayView
        trip={trip}
        iso={route.day}
        pane={route.pane}
        editing={route.edit}
        today={today}
        highlightId={highlightId}
        stickerId={stickerId}
        onStickerPlayed={clearStickerId}
        onPane={(p) => go(`day=${route.day}&pane=${p}${route.edit && p === 'itinerary' ? '&edit=1' : ''}`, true)}
        onEditToggle={(on) => go(`day=${route.day}&pane=itinerary${on ? '&edit=1' : ''}`, true)}
        onBack={() =>
          typeof window !== 'undefined' && window.history.state?.refPushed ? window.history.back() : go('', true)
        }
        onDay={(iso) => {
          if (isValidISODate(iso)) {
            setSelectedDay(iso);
          }
          go(`day=${iso}&pane=${route.pane}`, true);
        }}
        onUpdateDay={updateDay}
        onScan={(date) =>
          handleRequestScan({
            date: date || route.day,
            dateSource: 'selected',
          })
        }
        onAdd={(date) => openAdd({ date })}
        onEditExpense={(e) => openAdd({ id: e.id })}
        onDeleteExpense={deleteExpense}
      />
    );
  } else if (route.screen === 'add') {
    const initial = route.expenseId
      ? trip.expenses.find((e) => String(e.id) === String(route.expenseId)) || null
      : null;
    const effectiveDefaultDate =
      route.date ||
      (route.scan ? selectedDay || today : defaultExpenseDate(trip, today));
    const people = trip.settings?.people || ['共同'];
    body = (
      <AddForm
        key={`${trip.id}-${currentWindowHash(initialHash)}`}
        initial={initial}
        defaultDate={effectiveDefaultDate}
        startScan={route.scan}
        people={people}
        rate={effectiveRate}
        accountingCurrency={trip.accountingCurrency || 'HKD'}
        payerDefault={defaultPayer(people)}
        paymentDefault={defaultPayment(trip)}
        onRequestScan={(opts) =>
          handleRequestScan({
            date: opts?.date || effectiveDefaultDate,
            dateSource: opts?.dateSource || (opts?.auto ? route.dateSource : undefined),
            fromForm: true,
            auto: Boolean(opts?.auto),
          })
        }
        scanState={activeScanState}
        scanDraft={activeScanDraft}
        onCancel={() => {
          clearActiveScan();
          if (typeof window !== 'undefined' && window.history.state?.refPushed) {
            window.history.back();
          } else {
            go(returnTo, true);
          }
        }}
        onSave={saveExpense}
      />
    );
  } else if (route.screen === 'ledger') {
    body = (
      <Ledger
        key={currentWindowHash(initialHash)}
        trip={trip}
        today={today}
        initialFilters={route.filters}
        highlightId={highlightId}
        exchangeRates={effectiveExchangeRates}
        defaultAssignee={propDefaultAssignee}
        settlementActions={settlementActions}
        onScan={() =>
          handleRequestScan({
            date: selectedDay || today,
            dateSource: selectedDay ? 'selected' : 'today',
          })
        }
        onAdd={() => openAdd({ date: defaultExpenseDate(trip, today) })}
        onEdit={(e) => openAdd({ id: e.id })}
        onDelete={deleteExpense}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
      />
    );
  } else if (route.screen === 'charts') {
    body = (
      <ChartsView
        trip={trip}
        today={today}
        settlementActions={settlementActions}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
        onOpenLedger={(f) => go(ledgerHash(f))}
      />
    );
  } else if (route.screen === 'settings') {
    body = (
      <SettingsView
        trip={trip}
        trips={trips}
        today={today}
        onUpdateTrip={updateActiveMockTrip}
        onSelectTrip={selectTrip}
        onCreateTrip={handleCreateTrip}
        onSaveDates={handleSaveDates}
        onSaveBudget={onSaveBudget}
        onAddPerson={onAddPerson}
        onRenamePerson={onRenamePerson}
        onRemovePerson={onRemovePerson}
        onSaveRate={onSaveRate}
        onToast={showToast}
        uiLanguage={uiLanguage}
        onChangeUiLanguage={onChangeUiLanguage}
        updateSettings={updateSettings}
        account={account}
        onSignOut={onSignOut}
      />
    );
  } else {
    const homeDefaultDate = defaultExpenseDate(trip, today);
    body = (
      <Home
        trip={trip}
        today={today}
        month={month}
        setMonth={setMonth}
        selectedDay={selectedDay}
        onOpenDay={(iso) => openDay(iso)}
        onScan={() =>
          handleRequestScan({
            date: selectedDay || today,
            dateSource: selectedDay ? 'selected' : 'today',
          })
        }
        onAdd={() => openAdd({ date: homeDefaultDate })}
      />
    );
  }

  let tab = null;
  if (route.screen === 'home' || route.screen === 'day') tab = 'home';
  else if (route.screen === 'ledger') tab = 'ledger';
  else if (route.screen === 'charts') tab = 'charts';
  else if (route.screen === 'settings') tab = 'settings';
  else if (route.screen === 'add') tab = addOrigin.origin === 'ledger' ? 'ledger' : 'home';

  const spread =
    route.screen === 'home'
      ? 'home'
      : route.screen === 'ledger'
        ? 'ledger'
        : route.screen === 'charts' || route.screen === 'day'
          ? 'half'
          : null;
  const pageNumber = pageNumberForTab(tab);
  const dateLine = formatPageDateLine(
    t,
    pageDateIso({ screen: route.screen, day: route.day, today }),
    trip,
    i18n?.resolvedLanguage || i18n?.language || uiLanguage,
  );

  const hashConflicts = scanner?.hashConflicts || [];
  const dialogExisting = Array.isArray(rawExpenses) ? rawExpenses : effectiveRawExpenses;

  return (
    <div className="jr-desk min-h-screen text-ink">
      {scanner && (
        <input
          ref={scanner.fileInputRef}
          type="file"
          accept="image/*"
          data-testid="notebook-scan-input"
          onChange={scanner.handleFileChange}
          className="hidden"
        />
      )}
      <HashDuplicateDialog
        open={hashConflicts.length > 0}
        conflicts={hashConflicts}
        onConfirm={(decisions) => scanner?.confirmHashConflicts?.(decisions)}
        onClose={() => scanner?.closeHashConflicts?.()}
      />
      <DuplicateReviewDialog
        open={dupConflicts.length > 0}
        conflicts={dupConflicts}
        existing={dialogExisting}
        onConfirm={(decisions) => finalizeDuplicateDialog(decisions)}
        onClose={() => finalizeDuplicateDialog({})}
      />
      <Header trip={trip} trips={trips} onSelectTrip={selectTrip} tab={tab} />
      <main className="mx-auto max-w-5xl pb-24 lg:max-w-6xl lg:pb-10">
        <JournalPage pageNumber={pageNumber} dateLine={dateLine} spread={spread}>
          {body}
        </JournalPage>
      </main>
      <Toast
        toast={toast}
        aboveSaveBar={route.screen === 'add'}
        onUndo={handleUndo}
        onDismiss={() => setToast(null)}
        onHoverChange={setToastHover}
        onFocusChange={setToastFocus}
      />
      <BottomNav tab={tab} />
    </div>
  );
}

function Header({ trip, trips, onSelectTrip, tab }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuWrapRef = useRef(null);
  const btnRef = useRef(null);
  const brandScript = t('notebook.brandScript');
  const brand = t('notebook.brand');
  const showBrandScript = Boolean(brandScript) && brandScript !== brand;

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const onPointerDown = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <header className="jr-cover-band sticky top-0 z-30">
      <span
        aria-hidden="true"
        className="jr-cover-stitch pointer-events-none select-none lg:hidden"
      />
      <div className="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-2 px-3 py-1.5 lg:min-h-16 lg:gap-4 lg:px-6 lg:py-2">
        <button
          type="button"
          onClick={() => go('')}
          className="relative flex min-h-11 min-w-0 shrink-0 items-center gap-2 rounded-control px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal lg:order-1 lg:gap-2.5 lg:px-2"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-kraft/85 bg-paper text-route lg:h-9 lg:w-9 lg:border-ink-soft/65 lg:bg-paper-shade">
            <CompassIcon className="h-[18px] w-[18px] lg:h-5 lg:w-5" />
          </span>
          <span className="flex min-w-0 items-baseline gap-2 leading-tight">
            <span className="whitespace-nowrap font-hand text-base font-bold tracking-wide text-paper lg:text-lg lg:text-ink">
              {brand}
            </span>
            {showBrandScript && (
              <span className="hidden whitespace-nowrap font-hand text-meta text-ink-muted lg:inline">
                {brandScript}
              </span>
            )}
          </span>
        </button>

        <div className="relative min-w-0 shrink lg:order-3" ref={menuWrapRef}>
          <button
            ref={btnRef}
            type="button"
            data-testid="trip-switcher"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 min-h-11 min-w-11 max-w-[11rem] sm:max-w-xs items-center gap-1.5 whitespace-nowrap rounded-sm border border-kraft/85 bg-paper px-2.5 py-1.5 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal lg:border-ink-soft/55 lg:bg-paper-shade lg:px-3.5"
          >
            <span className="min-w-0 truncate font-hand">{trip.name}</span>
            <TriangleDownIcon className="h-3.5 w-3.5 shrink-0 text-kraft-ink lg:text-ink-soft" />
          </button>

          {open && (
            <div
              role="menu"
              data-testid="trip-switcher-menu"
              className="jr-paper absolute right-0 top-full z-40 mt-2 min-w-[230px] max-w-[calc(100vw-2rem)] rounded-sm border border-ink-soft/68 bg-paper pb-1.5 pt-2.5 text-ink shadow-xl"
            >
              <span
                aria-hidden="true"
                data-jr-decor="washi"
                style={{ '--jr-tilt': '-2deg' }}
                className="jr-washi pointer-events-none absolute -top-2 left-1/2 h-2.5 w-12 -translate-x-1/2 select-none"
              />
              {trips.map((tripOption) => {
                const isActive = String(tripOption.id) === String(trip.id);
                return (
                  <button
                    key={tripOption.id}
                    type="button"
                    role="menuitem"
                    data-testid={`switch-trip-${tripOption.id}`}
                    onClick={() => {
                      setOpen(false);
                      onSelectTrip(tripOption.id);
                    }}
                    className={`flex min-h-11 w-full min-w-0 items-center justify-between whitespace-nowrap px-3.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
                      isActive
                        ? 'bg-route-soft font-semibold text-route'
                        : 'text-ink hover:bg-paper-shade/85'
                    }`}
                  >
                    <span className="min-w-0 truncate font-hand">{tripOption.name}</span>
                    {isActive && (
                      <span className="ml-2 shrink-0 rounded-sm border border-route/35 bg-paper px-2 py-0.5 font-hand text-meta font-bold text-route">
                        {t('notebook.currentTrip')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DesktopNav tab={tab} />
      </div>
    </header>
  );
}

const NAV = [
  ['home', 'notebook.nav.home', '', CalendarIcon],
  ['ledger', 'notebook.nav.ledger', 'ledger', BookIcon],
  ['charts', 'notebook.nav.charts', 'charts', ChartIcon],
  ['settings', 'notebook.nav.settings', 'settings', GearIcon],
];

function DesktopNav({ tab }) {
  const { t } = useTranslation();
  return (
    <nav
      data-testid="desktop-nav"
      aria-label={t('notebook.navAria')}
      className="hidden lg:order-2 lg:flex lg:items-center lg:gap-2"
    >
      {NAV.map(([id, labelKey, hash, NavIcon]) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`desktop-nav-${id}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => go(hash)}
            className={`jr-desktop-tab relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 whitespace-nowrap border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
              active
                ? 'jr-desktop-tab-active border-ink-soft/65 bg-paper font-bold text-route'
                : 'border-transparent font-semibold text-ink-soft hover:bg-paper-shade/85 hover:text-ink'
            }`}
          >
            <NavIcon className="h-[18px] w-[18px] shrink-0" />
            <span className="font-hand">{t(labelKey)}</span>
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                active ? 'bg-route' : 'bg-transparent'
              }`}
            />
            {active && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-route"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function BottomNav({ tab }) {
  const { t } = useTranslation();
  return (
    <nav
      data-testid="nav"
      aria-label={t('notebook.navAria')}
      className="jr-bottom-nav fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4 gap-1.5">
        {NAV.map(([id, labelKey, hash, NavIcon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`nav-${id}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(hash)}
              className={`jr-index-tab flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
                active
                  ? 'jr-index-tab-active font-bold text-route'
                  : 'font-medium text-ink-soft hover:bg-paper hover:text-ink'
              }`}
            >
              <NavIcon className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap font-hand text-sm leading-none">
                {t(labelKey)}
              </span>
              <span
                aria-hidden="true"
                className={`mt-0.5 h-0.5 rounded-full transition-all ${
                  active ? 'w-4 bg-route' : 'w-2 bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
