import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import DataService from '../services/DataService';
import { sortExpenses } from '../utils/date';
import { getExchangeRate } from '../utils/currency';
import { CURRENCY_NAMES } from '../utils/constants';
import i18n from '../i18n';
import { resolveAppLanguage } from '../utils/locale';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Settings ──
  const [settings, setSettingsState] = useState(() => DataService.loadSettings());
  const { exchangeRates, homeCurrency, customCurrencyCode, customCurrencyRate } = settings;

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

  // ── People ──
  const [people, setPeopleState] = useState(() => DataService.loadPeople());
  const setPeople = useCallback((val) => {
    const next = typeof val === 'function' ? val(people) : val;
    setPeopleState(next);
    DataService.savePeople(next);
    return next;
  }, [people]);

  // ── Trips ──
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

  // ── Expenses ──
  const [expenses, setExpensesState] = useState(() => DataService.loadExpenses());

  const setExpenses = useCallback((val) => {
    setExpensesState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      DataService.saveExpenses(next);
      return next;
    });
  }, []);

  // Sync trip expenses
  useEffect(() => {
    if (currentTripId && expenses) {
      DataService.updateCurrentTripExpenses(expenses);
    }
  }, [expenses, currentTripId]);

  // ── Filters ──
  const [filterPerson, setFilterPerson] = useState(null);

  // ── Notifications ──
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

  // ── Exchange rate auto-recalc ──
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

  // ── Custom currency sync ──
  useEffect(() => {
    if (homeCurrency === 'OTHER' && customCurrencyCode?.length === 3 && customCurrencyRate > 0) {
      updateSettings({
        exchangeRates: { ...exchangeRates, [customCurrencyCode]: customCurrencyRate },
      });
    }
  }, [customCurrencyCode, customCurrencyRate, homeCurrency]);

  // ── Trip actions ──
  const createTrip = useCallback((name, startDate, tripCurrency) => {
    DataService.updateCurrentTripExpenses(expenses);
    const newTrip = DataService.createTrip(name, startDate, tripCurrency);
    const data = DataService.loadTripsData();
    setTrips(data.trips);
    setCurrentTripId(newTrip.id);
    setExpensesState([]);
    setPeopleState(newTrip.settings.people || ['共同']);
    notify(i18n.t('toast.tripCreated'));
  }, [expenses]);

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
  }, [currentTripId, expenses]);

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
  }, [currentTripId]);

  /** 更新旅程名稱與／或旅程幣（設定 → 旅程管理） */
  const updateTrip = useCallback((tripId, { name, tripCurrency } = {}) => {
    const data = DataService.loadTripsData();
    const idx = data.trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return;
    const trip = data.trips[idx];
    let changed = false;
    if (name != null) {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (trip.name !== trimmed) {
        trip.name = trimmed;
        changed = true;
      }
    }
    if (tripCurrency != null) {
      const code = String(tripCurrency).toUpperCase();
      if (CURRENCY_NAMES[code] && trip.tripCurrency !== code) {
        trip.tripCurrency = code;
        changed = true;
      }
    }
    if (!changed) return;
    DataService.saveTripsData(data);
    setTrips(data.trips);
    notify(i18n.t('toast.tripUpdated'));
  }, []);

  // ── Expense actions ──
  const addExpense = useCallback((expense) => {
    setExpenses((prev) => sortExpenses([...prev, expense]));
    notify(i18n.t('toast.expenseAdded'));
  }, []);

  const addExpenses = useCallback((newOnes) => {
    setExpenses((prev) => sortExpenses([...newOnes, ...prev]));
    notify(i18n.t('toast.expensesAdded', { count: newOnes.length }));
  }, []);

  const updateExpense = useCallback((updated) => {
    const rate = exchangeRates[updated.currency] || 1;
    const withHkd = { ...updated, hkdAmount: rate > 0 ? updated.originalAmount / rate : updated.originalAmount };
    setExpenses((prev) => sortExpenses(prev.map((e) => (e.id === withHkd.id ? withHkd : e))));
    notify(i18n.t('toast.expenseUpdated'));
  }, [exchangeRates]);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    notify(i18n.t('toast.expenseDeleted'));
  }, []);

  // ── Context value ──
  const tripCurrency = currentTrip?.tripCurrency || 'JPY';

  const homeCurrencyCode = useMemo(() => {
    if (homeCurrency === 'OTHER' && customCurrencyCode?.length === 3) {
      return String(customCurrencyCode).trim().toUpperCase();
    }
    if (homeCurrency && homeCurrency !== 'OTHER') return homeCurrency;
    return 'HKD';
  }, [homeCurrency, customCurrencyCode]);

  const value = useMemo(() => ({
    settings, updateSettings,
    people, setPeople,
    trips, currentTripId, currentTrip,
    createTrip, switchTrip, deleteTrip, updateTrip, renamePerson,
    expenses, setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    filterPerson, setFilterPerson,
    toast, notify,
    exchangeRates,
    homeCurrency: homeCurrency || 'HKD',
    homeCurrencyCode,
    tripCurrency,
  }), [
    settings, people, trips, currentTripId, currentTrip,
    expenses, filterPerson, toast, exchangeRates, homeCurrency, homeCurrencyCode, tripCurrency,
    updateSettings, setPeople, createTrip, switchTrip, deleteTrip, updateTrip, renamePerson,
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
