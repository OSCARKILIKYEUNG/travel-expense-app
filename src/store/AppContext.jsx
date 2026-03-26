import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import DataService from '../services/DataService';
import { sortExpenses } from '../utils/date';
import { getExchangeRate } from '../utils/currency';
import i18n from '../i18n';
import { resolveAppLanguage } from '../utils/locale';
import { getDefaultAssignee } from '../utils/people';
import { getAccountingCode, getTripCurrencyCode } from '../utils/tripMoney';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(() => DataService.loadSettings());

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      DataService.saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const lang = resolveAppLanguage(settings.uiLanguage);
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  }, [settings.uiLanguage]);

  const [people, setPeopleState] = useState(() => DataService.loadPeople());
  const setPeople = useCallback((val) => {
    const next = typeof val === 'function' ? val(people) : val;
    setPeopleState(next);
    DataService.savePeople(next);
    return next;
  }, [people]);

  const [trips, setTrips] = useState(() => {
    const data = DataService.loadTripsData();
    return data.trips || [];
  });
  const [currentTripId, setCurrentTripId] = useState(() => {
    const data = DataService.loadTripsData();
    return data.currentTripId || data.trips?.[0]?.id;
  });

  const currentTrip = useMemo(
    () => trips.find((t) => t.id === currentTripId) || trips[0],
    [trips, currentTripId]
  );

  const exchangeRates = useMemo(
    () => (currentTrip?.exchangeRates && typeof currentTrip.exchangeRates === 'object'
      ? currentTrip.exchangeRates
      : {}),
    [currentTrip]
  );

  const homeCurrencyCode = useMemo(() => getAccountingCode(currentTrip), [currentTrip]);

  const [expenses, setExpensesState] = useState(() => DataService.loadExpenses());

  const setExpenses = useCallback((val) => {
    setExpensesState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      DataService.saveExpenses(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (currentTripId && expenses) {
      DataService.updateCurrentTripExpenses(expenses);
    }
  }, [expenses, currentTripId]);

  const [filterPerson, setFilterPerson] = useState(null);

  const [toast, setToast] = useState(null);
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (expenses.length === 0) return;
    let changed = false;
    const updated = expenses.map((e) => {
      const curr = e.originalCurrency || e.currency;
      const amt = e.originalAmount || e.hkdAmount;
      if (!curr || !amt) return e;
      const newRate = exchangeRates[curr] || 1;
      const newHome = newRate > 0 ? amt / newRate : amt;
      if (Math.abs(newHome - e.hkdAmount) > 0.01) {
        changed = true;
        return { ...e, hkdAmount: newHome, rate: newRate };
      }
      return e;
    });
    if (changed) {
      setExpenses(updated);
      notify(i18n.t('toast.ratesUpdated'));
    }
  }, [exchangeRates]);

  const mergeSavedCurrencyListsFromTrip = useCallback((trip) => {
    if (!trip) return;
    const acc = new Set();
    const ac = getAccountingCode(trip);
    if (/^[A-Z]{3}$/.test(ac)) acc.add(ac);
    (trip.customAccountingCodes || []).forEach((c) => {
      const x = String(c).toUpperCase().slice(0, 3);
      if (/^[A-Z]{3}$/.test(x)) acc.add(x);
    });
    const tripCodes = new Set();
    const tc = getTripCurrencyCode(trip);
    if (/^[A-Z]{3}$/.test(tc)) tripCodes.add(tc);
    (trip.customTripCurrencyCodes || []).forEach((c) => {
      const x = String(c).toUpperCase().slice(0, 3);
      if (/^[A-Z]{3}$/.test(x)) tripCodes.add(x);
    });

    setSettingsState((prev) => {
      const mergeArr = (base, additions) => {
        const s = new Set([...(base || [])]);
        additions.forEach((x) => {
          const c = String(x).toUpperCase().slice(0, 3);
          if (/^[A-Z]{3}$/.test(c)) s.add(c);
        });
        return [...s].sort();
      };
      const next = {
        ...prev,
        savedAccountingCodes: mergeArr(prev.savedAccountingCodes, [...acc]),
        savedTripCurrencies: mergeArr(prev.savedTripCurrencies, [...tripCodes]),
      };
      DataService.saveSettings(next);
      return next;
    });
  }, []);

  const createTrip = useCallback((name, startDate, tripCurrency, options) => {
    DataService.updateCurrentTripExpenses(expenses);
    const newTrip = DataService.createTrip(name, startDate, tripCurrency, options);
    mergeSavedCurrencyListsFromTrip(newTrip);
    const data = DataService.loadTripsData();
    setTrips(data.trips);
    setCurrentTripId(newTrip.id);
    setExpensesState([]);
    setPeopleState(newTrip.settings.people || ['共同']);
    notify(i18n.t('toast.tripCreated'));
  }, [expenses, notify, mergeSavedCurrencyListsFromTrip]);

  const switchTrip = useCallback((tripId) => {
    if (tripId === currentTripId) return;
    DataService.updateCurrentTripExpenses(expenses);
    const newExpenses = DataService.switchTrip(tripId, expenses);
    const data = DataService.loadTripsData();
    const trip = data.trips.find((t) => t.id === tripId);
    setCurrentTripId(tripId);
    setExpensesState(newExpenses);
    if (trip?.settings?.people) setPeopleState(trip.settings.people);
    setFilterPerson(null);
    notify(i18n.t('toast.tripSwitched'));
  }, [currentTripId, expenses, notify]);

  const renamePerson = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return { ok: false, reason: 'empty' };
    if (trimmed === oldName) return { ok: true };
    if (people.includes(trimmed)) return { ok: false, reason: 'exists' };

    const nextPeople = people.map((p) => (p === oldName ? trimmed : p));
    setPeople(nextPeople);
    DataService.syncPersonNameInAllTrips(oldName, trimmed);

    setExpenses((prev) =>
      sortExpenses(
        prev.map((e) => {
          const next = { ...e };
          if (next.assignedTo === oldName) next.assignedTo = trimmed;
          if (next.items?.length) {
            next.items = next.items.map((it) =>
              it.assignedTo === oldName ? { ...it, assignedTo: trimmed } : it
            );
          }
          return next;
        })
      )
    );

    if (filterPerson === oldName) setFilterPerson(trimmed);

    const data = DataService.loadTripsData();
    setTrips(data.trips);
    notify(i18n.t('toast.personRenamed'));
    return { ok: true };
  }, [people, filterPerson, notify, setExpenses, setPeople]);

  const removePersonWithReassign = useCallback((deletedName, reassignTo) => {
    if (!deletedName || !reassignTo) return;
    DataService.removePersonAndReassignAll(deletedName, reassignTo);
    setPeople((p) => p.filter((x) => x !== deletedName));
    setExpenses(sortExpenses(DataService.loadExpenses()));
    const data = DataService.loadTripsData();
    setTrips(data.trips);
    if (filterPerson === deletedName) setFilterPerson(reassignTo);
    notify(i18n.t('toast.personDeleted'));
  }, [filterPerson, notify, setExpenses, setPeople, setFilterPerson]);

  const deleteTrip = useCallback((tripId) => {
    if (tripId === currentTripId) return { ok: false, msg: i18n.t('toast.cannotDeleteTrip') };
    const ok = DataService.deleteTrip(tripId);
    if (ok) {
      const data = DataService.loadTripsData();
      setTrips(data.trips);
      setCurrentTripId(data.currentTripId);
      const trip = data.trips.find((t) => t.id === data.currentTripId);
      if (trip) {
        setExpensesState(trip.expenses || []);
        setPeopleState(trip.settings?.people || ['共同']);
      }
      notify(i18n.t('toast.tripDeleted'));
    }
    return { ok };
  }, [currentTripId, notify]);

  const updateTrip = useCallback((tripId, patch) => {
    const data = DataService.loadTripsData();
    const trip = data.trips.find((t) => t.id === tripId);
    if (!trip) return;
    if (patch.tripCurrency != null) {
      const code = String(patch.tripCurrency).toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) return;
    }
    DataService.patchTrip(tripId, patch);
    const nextData = DataService.loadTripsData();
    const updated = nextData.trips.find((t) => t.id === tripId);
    if (updated) mergeSavedCurrencyListsFromTrip(updated);
    setTrips(DataService.loadTripsData().trips);
    notify(i18n.t('toast.tripUpdated'));
  }, [notify, mergeSavedCurrencyListsFromTrip]);

  const addExpense = useCallback((expense) => {
    setExpenses((prev) => sortExpenses([...prev, expense]));
    notify(i18n.t('toast.expenseAdded'));
  }, [notify]);

  const addExpenses = useCallback((newOnes) => {
    setExpenses((prev) => sortExpenses([...newOnes, ...prev]));
    notify(i18n.t('toast.expensesAdded', { count: newOnes.length }));
  }, [notify]);

  const updateExpense = useCallback((updated) => {
    const rate = exchangeRates[updated.currency] || 1;
    const withHkd = { ...updated, hkdAmount: rate > 0 ? updated.originalAmount / rate : updated.originalAmount };
    setExpenses((prev) => sortExpenses(prev.map((e) => (e.id === withHkd.id ? withHkd : e))));
    notify(i18n.t('toast.expenseUpdated'));
  }, [exchangeRates, notify]);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    notify(i18n.t('toast.expenseDeleted'));
  }, [notify]);

  const tripCurrency = getTripCurrencyCode(currentTrip);

  const defaultAssignee = useMemo(() => getDefaultAssignee(people), [people]);

  const value = useMemo(() => ({
    settings, updateSettings,
    people, setPeople,
    trips, currentTripId, currentTrip,
    createTrip, switchTrip, deleteTrip, updateTrip, renamePerson, removePersonWithReassign,
    expenses, setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    filterPerson, setFilterPerson,
    toast, notify,
    exchangeRates,
    homeCurrencyCode,
    tripCurrency,
    defaultAssignee,
  }), [
    settings, people, trips, currentTripId, currentTrip,
    expenses, filterPerson, toast, exchangeRates, homeCurrencyCode, tripCurrency,
    defaultAssignee,
    updateSettings, setPeople, createTrip, switchTrip, deleteTrip, updateTrip, renamePerson, removePersonWithReassign,
    setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    setFilterPerson, notify,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
