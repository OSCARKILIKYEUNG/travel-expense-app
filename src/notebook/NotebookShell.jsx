import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { applyUndo, defaultPayer, parseRate, resolveToday } from '../proto/ref/refRules';
import { useApp } from '../store/AppContext';
import { getTripCurrencyCode } from '../utils/tripMoney';
import NotebookApp from './NotebookApp';
import {
  adaptTripForNotebook,
  mergeDayPatch,
  preparePersistedExpense,
  refRateToForeignPerHome,
  tripRate,
} from './tripRate';
import { routeScannedSave, useReceiptScan } from './useReceiptScan';

function useOptionalAuth() {
  try {
    return useAuth();
  } catch {
    return { session: null };
  }
}

/**
 * Authenticated notebook shell: bridges `useApp()` real store state, writers,
 * and the production AI receipt scan pipeline into `NotebookApp`.
 */
export default function NotebookShell() {
  const { t } = useTranslation();
  const { session } = useOptionalAuth();
  const {
    trips,
    currentTrip,
    currentTripId,
    switchTrip,
    updateTrip,
    expenses,
    setExpenses,
    addExpense,
    updateExpense,
    removeExpense,
    resolveDuplicateConflicts,
    people,
    setPeople,
    renamePerson,
    removePersonWithReassign,
    exchangeRates,
    homeCurrencyCode,
    tripCurrency,
    defaultAssignee,
    settings,
    planView,
    applyBillingSnapshot,
    refreshBilling,
    notify,
  } = useApp();

  const notebookActionsRef = useRef(null);

  const scanner = useReceiptScan({
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
    onOpenForm: ({ date, fromForm }) => {
      notebookActionsRef.current?.openFormForScan?.({ date, fromForm });
    },
    onToast: (msg) => {
      notebookActionsRef.current?.showToast?.(msg);
    },
  });

  const today = useMemo(
    () => resolveToday(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  const activeRawTrip = useMemo(
    () => (currentTrip ? { ...currentTrip, expenses } : { expenses }),
    [currentTrip, expenses],
  );

  const refTrip = useMemo(
    () => adaptTripForNotebook(activeRawTrip, { people, exchangeRates, today }),
    [activeRawTrip, people, exchangeRates, today],
  );

  const refTrips = useMemo(() => {
    if (!Array.isArray(trips) || trips.length === 0) return [refTrip];
    return trips.map((tr) =>
      String(tr.id) === String(currentTripId)
        ? refTrip
        : adaptTripForNotebook(tr, { exchangeRates: tr.exchangeRates, today }),
    );
  }, [trips, currentTripId, refTrip, today]);

  const rate = useMemo(
    () => tripRate(activeRawTrip, exchangeRates),
    [activeRawTrip, exchangeRates],
  );

  const handleSelectTrip = useCallback(
    (tripId) => {
      const target = (trips || []).find((tr) => String(tr.id) === String(tripId));
      switchTrip(target ? target.id : tripId);
    },
    [trips, switchTrip],
  );

  const handleUpdateDay = useCallback(
    (iso, patch) => {
      if (!currentTripId || !iso) return;
      const nextDays = mergeDayPatch(currentTrip?.days, iso, patch);
      updateTrip(currentTripId, { days: nextDays });
    },
    [currentTripId, currentTrip, updateTrip],
  );

  const handleSaveExpense = useCallback(
    (data, { scanBase } = {}) => {
      const existing =
        data?.id != null && data.id !== ''
          ? (expenses || []).find((x) => String(x.id) === String(data.id)) || null
          : null;
      const effectiveScanBase = !existing ? scanBase || scanner.scanDraft || null : null;
      const tripCurr = getTripCurrencyCode(currentTrip);
      const { record, refRecord, isEdit, lastPayment } = preparePersistedExpense(data, {
        existing,
        scanBase: effectiveScanBase,
        tripCurrency: tripCurr,
        exchangeRates,
      });

      if (lastPayment && currentTripId) {
        updateTrip(currentTripId, { lastPayment });
      }

      const isScanned = Boolean(!isEdit && (effectiveScanBase || data?.scanned));
      const routed = routeScannedSave(record, expenses, { isEdit, isScanned });
      scanner.clearScan();

      if (routed.action === 'update' && existing) {
        updateExpense(record);
        return { savedRecord: refRecord, isEdit: true, action: 'update', conflicts: [] };
      }

      if (routed.action === 'conflict') {
        return {
          savedRecord: refRecord,
          isEdit: false,
          action: 'conflict',
          conflicts: routed.conflicts,
        };
      }

      addExpense(record);
      return { savedRecord: refRecord, isEdit: false, action: 'add', conflicts: [] };
    },
    [
      expenses,
      currentTrip,
      currentTripId,
      exchangeRates,
      scanner,
      addExpense,
      updateExpense,
      updateTrip,
    ],
  );

  const handleDeleteExpense = useCallback(
    (expenseOrId) => {
      const rawId =
        expenseOrId && typeof expenseOrId === 'object' ? expenseOrId.id : expenseOrId;
      const target = (expenses || []).find((x) => String(x.id) === String(rawId));
      removeExpense(target ? target.id : rawId);
    },
    [expenses, removeExpense],
  );

  const handleUndo = useCallback(
    (undoOp) => {
      if (!undoOp) return;
      setExpenses((prev) => applyUndo(prev, undoOp));
    },
    [setExpenses],
  );

  const handleSaveBudget = useCallback(
    (nextBudget) => {
      if (!currentTripId) return;
      updateTrip(currentTripId, { settings: { budget: nextBudget } });
    },
    [currentTripId, updateTrip],
  );

  const handleAddPerson = useCallback(
    (cleanName) => {
      const nextPeople = [...(people || ['共同']), cleanName];
      setPeople(nextPeople);
      if (currentTripId) {
        updateTrip(currentTripId, { settings: { people: nextPeople } });
      }
    },
    [people, setPeople, currentTripId, updateTrip],
  );

  const handleRenamePerson = useCallback(
    (from, to) => {
      const res = renamePerson(from, to);
      if (res?.ok) {
        setExpenses((prev) =>
          prev.map((e) => (e?.payer === from ? { ...e, payer: to } : e)),
        );
      }
      return res;
    },
    [renamePerson, setExpenses],
  );

  const handleRemovePerson = useCallback(
    (name) => {
      if (!name || name === '共同') return;
      const remaining = (people || ['共同']).filter((p) => p !== name);
      const fallbackPayer = defaultPayer(remaining);
      removePersonWithReassign(name, '共同');
      setExpenses((prev) =>
        prev.map((e) => (e?.payer === name ? { ...e, payer: fallbackPayer } : e)),
      );
    },
    [people, removePersonWithReassign, setExpenses],
  );

  const handleSaveRate = useCallback(
    (refRateVal) => {
      if (!currentTripId) return;
      const r = parseRate(refRateVal);
      if (r === null) return;
      const foreignPerHome = refRateToForeignPerHome(r);
      const tripCurr = getTripCurrencyCode(currentTrip);
      const nextRates = {
        ...exchangeRates,
        ...(foreignPerHome ? { [tripCurr]: foreignPerHome } : {}),
      };
      updateTrip(currentTripId, {
        exchangeRates: nextRates,
        settings: { rate: r },
      });
    },
    [currentTripId, currentTrip, exchangeRates, updateTrip],
  );

  return (
    <NotebookApp
      trip={refTrip}
      trips={refTrips}
      today={today}
      rate={rate}
      scanner={scanner}
      rawExpenses={expenses}
      onResolveDuplicateConflicts={resolveDuplicateConflicts}
      actionsRef={notebookActionsRef}
      onSelectTrip={handleSelectTrip}
      onUpdateDay={handleUpdateDay}
      onSaveExpense={handleSaveExpense}
      onDeleteExpense={handleDeleteExpense}
      onUndo={handleUndo}
      onSaveBudget={handleSaveBudget}
      onAddPerson={handleAddPerson}
      onRenamePerson={handleRenamePerson}
      onRemovePerson={handleRemovePerson}
      onSaveRate={handleSaveRate}
    />
  );
}
