import { useCallback, useMemo } from 'react';
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

/**
 * Authenticated notebook shell: bridges `useApp()` real store state and writers
 * (`trips`, `currentTrip`, `expenses`, `people`, `exchangeRates`, `switchTrip`,
 * `updateTrip`, `addExpense`, `updateExpense`, `removeExpense`) into `NotebookApp`.
 */
export default function NotebookShell() {
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
    people,
    setPeople,
    renamePerson,
    removePersonWithReassign,
    exchangeRates,
  } = useApp();

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
    return trips.map((t) =>
      String(t.id) === String(currentTripId)
        ? refTrip
        : adaptTripForNotebook(t, { exchangeRates: t.exchangeRates, today }),
    );
  }, [trips, currentTripId, refTrip, today]);

  const rate = useMemo(
    () => tripRate(activeRawTrip, exchangeRates),
    [activeRawTrip, exchangeRates],
  );

  const handleSelectTrip = useCallback(
    (tripId) => {
      const target = (trips || []).find((t) => String(t.id) === String(tripId));
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
    (data) => {
      const existing =
        data?.id != null && data.id !== ''
          ? (expenses || []).find((x) => String(x.id) === String(data.id)) || null
          : null;
      const tripCurrency = getTripCurrencyCode(currentTrip);
      const { record, refRecord, isEdit, lastPayment } = preparePersistedExpense(data, {
        existing,
        tripCurrency,
        exchangeRates,
      });

      if (isEdit && existing) {
        updateExpense(record);
      } else {
        addExpense(record);
      }

      if (lastPayment && currentTripId) {
        updateTrip(currentTripId, { lastPayment });
      }

      return { savedRecord: refRecord, isEdit };
    },
    [expenses, currentTrip, currentTripId, exchangeRates, addExpense, updateExpense, updateTrip],
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
