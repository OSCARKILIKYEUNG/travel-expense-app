import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toRefExpense } from '../adapters/refDataAdapter';
import DuplicateReviewDialog from '../components/expense/DuplicateReviewDialog';
import HashDuplicateDialog from '../components/expense/HashDuplicateDialog';
import '../i18n';
import { createRefTrips } from '../proto/ref/mockRefTrip';
import { buildAddHash, parseRoute } from '../proto/ref/refLogic';
import {
  TOAST_DURATION_MS,
  applyUndo,
  defaultExpenseDate,
  defaultPayer,
  defaultPayment,
  makeUndo,
  postSaveTarget,
  resolveToday,
  saveToastMessage,
  setTripDates,
  shouldKeepToastOnRoute,
  switchTripRoute,
  tripMonth,
} from '../proto/ref/refRules';
import { ledgerHash } from '../proto/ref/refCharts';
import { applyDuplicateDecisions } from '../utils/duplicateDecisions';
import { normalizeDate } from '../utils/duplicates';
import { Icon, Sparkle, Toast, paperDots, washiNav } from '../proto/ref/parts';
import Home from '../proto/ref/Home';
import DayView from '../proto/ref/DayView';
import Ledger from '../proto/ref/Ledger';
import AddForm from '../proto/ref/AddForm';
import ChartsView from '../proto/ref/ChartsView';
import SettingsView from './SettingsView';
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
  routeScannedSave,
  scanResultToFormFields,
} from './useReceiptScan';

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
  return window.location.hash;
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
  search: propSearch,
  scanner,
  rawExpenses,
  exchangeRates: propExchangeRates,
  defaultAssignee: propDefaultAssignee,
  onResolveDuplicateConflicts,
  actionsRef,
  onSelectTrip,
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
  onSaveRate,
  uiLanguage,
  onChangeUiLanguage,
  updateSettings,
} = {}) {
  const { t } = useTranslation();
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

  const rawTrip = useMemo(() => {
    if (isControlled) return controlledTrip;
    return mockTrips.find((t) => String(t.id) === String(mockActiveTripId)) || mockTrips[0];
  }, [isControlled, controlledTrip, mockTrips, mockActiveTripId]);

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
  const [returnTo, setReturnTo] = useState('');
  const [addOrigin, setAddOrigin] = useState(() => ({ origin: 'home', originDay: null }));
  const [month, setMonth] = useState(() => tripMonth(trip, today));
  const [toast, setToast] = useState(null);
  const [toastHover, setToastHover] = useState(false);
  const [toastFocus, setToastFocus] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const [dupConflicts, setDupConflicts] = useState([]);
  const [pendingDupTargetHash, setPendingDupTargetHash] = useState('');

  // Fixture scanner state for ?proto=notebook (when no external scanner prop is supplied)
  const fixtureTimerRef = useRef(null);
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
      clearActiveScan();
    }
  }, [trip, today, clearActiveScan]);

  const updateActiveMockTrip = useCallback(
    (updater) => {
      if (isControlled) {
        onUpdateTrip?.(updater);
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
    [isControlled, mockActiveTripId, onUpdateTrip],
  );

  const showToast = useCallback((message, undo = null) => {
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now() + Math.random(), message, undo });
  }, []);

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
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
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

  const openDay = (iso, pane = 'itinerary') => go(`day=${iso}&pane=${pane}`);

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
      openAdd({ date: date || defaultExpenseDate(trip, today) });
    },
    [openAdd, trip, today],
  );

  useEffect(() => {
    if (!actionsRef) return;
    actionsRef.current = {
      openFormForScan,
      showToast,
    };
  }, [actionsRef, openFormForScan, showToast]);

  const startFixtureScan = useCallback(
    ({ date } = {}) => {
      if (fixtureTimerRef.current) {
        clearTimeout(fixtureTimerRef.current);
      }
      const targetDate = date || defaultExpenseDate(trip, today) || '2026-10-22';
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

        const draft = buildFixtureExpense({
          mode,
          date: targetDate,
          existingExpenses: effectiveRawExpenses,
          rate: storeRate,
          tripCurrency: trip.tripCurrency || 'JPY',
          defaultAssignee,
        });
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
    [trip, effectiveRawExpenses, today, effectiveRate, initialHash, showToast, addOrigin.origin, t],
  );

  const handleRequestScan = useCallback(
    ({ date, fromForm = false, auto = false } = {}) => {
      const targetDate = date || defaultExpenseDate(trip, today);
      if (scanner) {
        if (auto) return false;
        return scanner.requestScan({ date: targetDate, fromForm });
      }
      if (!fromForm) {
        openAdd({ scan: true, date: targetDate });
        return true;
      }
      startFixtureScan({ date: targetDate });
      return true;
    },
    [scanner, trip, today, openAdd, startFixtureScan],
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
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now(), message: t('notebook.toast.undone'), undo: null });
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
        onPane={(p) => go(`day=${route.day}&pane=${p}${route.edit && p === 'itinerary' ? '&edit=1' : ''}`, true)}
        onEditToggle={(on) => go(`day=${route.day}&pane=itinerary${on ? '&edit=1' : ''}`, true)}
        onBack={() =>
          typeof window !== 'undefined' && window.history.state?.refPushed ? window.history.back() : go('', true)
        }
        onDay={(iso) => go(`day=${iso}&pane=${route.pane}`, true)}
        onUpdateDay={updateDay}
        onScan={(date) => handleRequestScan({ date })}
        onAdd={(date) => openAdd({ date })}
        onEditExpense={(e) => openAdd({ id: e.id })}
        onDeleteExpense={deleteExpense}
      />
    );
  } else if (route.screen === 'add') {
    const initial = route.expenseId
      ? trip.expenses.find((e) => String(e.id) === String(route.expenseId)) || null
      : null;
    const effectiveDefaultDate = route.date || defaultExpenseDate(trip, today);
    const people = trip.settings?.people || ['共同'];
    body = (
      <AddForm
        key={`${trip.id}-${currentWindowHash(initialHash)}`}
        initial={initial}
        defaultDate={effectiveDefaultDate}
        startScan={route.scan}
        people={people}
        rate={effectiveRate}
        payerDefault={defaultPayer(people)}
        paymentDefault={defaultPayment(trip)}
        onRequestScan={(opts) =>
          handleRequestScan({
            date: opts?.date || effectiveDefaultDate,
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
        initialFilters={route.filters}
        highlightId={highlightId}
        exchangeRates={effectiveExchangeRates}
        defaultAssignee={propDefaultAssignee}
        onScan={() => handleRequestScan({ date: defaultExpenseDate(trip, today) })}
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
        onOpenDay={(iso) => openDay(iso, 'expenses')}
        onOpenLedger={(f) => go(ledgerHash(f))}
      />
    );
  } else if (route.screen === 'settings') {
    body = (
      <SettingsView
        trip={trip}
        trips={trips}
        onUpdateTrip={updateActiveMockTrip}
        onSelectTrip={selectTrip}
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
        onOpenDay={(iso) => openDay(iso)}
        onScan={() => handleRequestScan({ date: homeDefaultDate })}
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

  const hashConflicts = scanner?.hashConflicts || [];
  const dialogExisting = Array.isArray(rawExpenses) ? rawExpenses : effectiveRawExpenses;

  return (
    <div className="min-h-screen text-ink" style={paperDots}>
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
      <Header trip={trip} trips={trips} onSelectTrip={selectTrip} />
      <main className="mx-auto max-w-5xl pb-24">{body}</main>
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

function Header({ trip, trips, onSelectTrip }) {
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
    <header className="sticky top-0 z-30 border-b border-line bg-cream-soft/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button
          type="button"
          onClick={() => go('')}
          className="relative flex min-h-11 min-w-0 shrink items-center gap-3 rounded-2xl px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <Sparkle className="absolute left-0.5 top-0 h-3.5 w-3.5" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-soft text-teal-strong">
            {Icon.pin('h-[18px] w-[18px]')}
          </span>
          <span className="min-w-0 leading-none">
            {showBrandScript && (
              <span className="block whitespace-nowrap font-script text-lg font-semibold leading-none text-teal-strong">
                {brandScript}
              </span>
            )}
            <span className="block whitespace-nowrap font-display text-base tracking-[-0.03em] text-ink">
              {brand}
            </span>
          </span>
        </button>

        <div className="relative" ref={menuWrapRef}>
          <button
            ref={btnRef}
            type="button"
            data-testid="trip-switcher"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 text-meta font-semibold text-ink-soft transition-colors hover:bg-white/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {Icon.globe('h-3.5 w-3.5 shrink-0')}
            <span>{trip.name}</span>
            {Icon.chevDown('h-3.5 w-3.5 shrink-0')}
          </button>

          {open && (
            <div
              role="menu"
              data-testid="trip-switcher-menu"
              className="absolute right-0 top-full z-40 mt-2 min-w-[230px] overflow-hidden rounded-card border border-line bg-cream-soft py-1.5 text-ink shadow-xl"
            >
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
                    className={`flex min-h-11 w-full items-center justify-between whitespace-nowrap px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
                      isActive ? 'bg-teal-soft font-semibold text-teal-strong' : 'text-ink hover:bg-beige/60'
                    }`}
                  >
                    <span>{tripOption.name}</span>
                    {isActive && (
                      <span className="ml-2 shrink-0 rounded-pill bg-teal-soft px-2 py-0.5 text-meta font-bold text-teal-strong">
                        {t('notebook.currentTrip')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const NAV = [
  ['home', 'notebook.nav.home', '', Icon.home],
  ['ledger', 'notebook.nav.ledger', 'ledger', Icon.book],
  ['charts', 'notebook.nav.charts', 'charts', Icon.chart],
  ['settings', 'notebook.nav.settings', 'settings', Icon.gear],
];

function BottomNav({ tab }) {
  const { t } = useTranslation();
  return (
    <nav
      data-testid="nav"
      aria-label={t('notebook.navAria')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={washiNav} />
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {NAV.map(([id, labelKey, hash, icon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`nav-${id}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(hash)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
                active ? 'text-teal-strong' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {icon('h-[22px] w-[22px]')}
              <span className="whitespace-nowrap text-meta font-medium">{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
