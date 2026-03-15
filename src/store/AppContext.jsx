import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import DataService from '../services/DataService';
import { sortExpenses } from '../utils/date';
import { getExchangeRate } from '../utils/currency';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Settings ──
  const [settings, setSettingsState] = useState(() => DataService.loadSettings());
  const { apiKey, modelName, exchangeRates, defaultCurrency, customCurrencyCode, customCurrencyRate } = settings;

  const updateSettings = useCallback((patch) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      DataService.saveSettings(next);
      return next;
    });
  }, []);

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
      const newHkd = amt * newRate;
      if (Math.abs(newHkd - e.hkdAmount) > 0.01) {
        changed = true;
        return { ...e, hkdAmount: newHkd, rate: newRate };
      }
      return e;
    });
    if (changed) {
      setExpenses(updated);
      notify('匯率已更新，金額已重算');
    }
  }, [exchangeRates]);

  // ── Custom currency sync ──
  useEffect(() => {
    if (defaultCurrency === 'OTHER' && customCurrencyCode?.length === 3 && customCurrencyRate > 0) {
      updateSettings({
        exchangeRates: { ...exchangeRates, [customCurrencyCode]: customCurrencyRate },
      });
    }
  }, [customCurrencyCode, customCurrencyRate, defaultCurrency]);

  // ── Trip actions ──
  const createTrip = useCallback((name, startDate) => {
    DataService.updateCurrentTripExpenses(expenses);
    const newTrip = DataService.createTrip(name, startDate);
    const data = DataService.loadTripsData();
    setTrips(data.trips);
    setCurrentTripId(newTrip.id);
    setExpensesState([]);
    setPeopleState(newTrip.settings.people || ['共同']);
    notify('旅程已創建');
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
    notify('已切換旅程');
  }, [currentTripId, expenses]);

  const deleteTrip = useCallback((tripId) => {
    if (tripId === currentTripId) return { ok: false, msg: '無法刪除當前旅程' };
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
      notify('旅程已刪除');
    }
    return { ok };
  }, [currentTripId]);

  const updateTripName = useCallback((tripId, name) => {
    const data = DataService.loadTripsData();
    const idx = data.trips.findIndex((t) => t.id === tripId);
    if (idx !== -1) {
      data.trips[idx].name = name;
      DataService.saveTripsData(data);
      setTrips(data.trips);
      notify('旅程名稱已更新');
    }
  }, []);

  // ── Expense actions ──
  const addExpense = useCallback((expense) => {
    setExpenses((prev) => sortExpenses([...prev, expense]));
    notify('記錄已新增');
  }, []);

  const addExpenses = useCallback((newOnes) => {
    setExpenses((prev) => sortExpenses([...newOnes, ...prev]));
    notify(`成功新增 ${newOnes.length} 筆記錄`);
  }, []);

  const updateExpense = useCallback((updated) => {
    const rate = exchangeRates[updated.currency] || 1;
    const withHkd = { ...updated, hkdAmount: updated.originalAmount * rate };
    setExpenses((prev) => sortExpenses(prev.map((e) => (e.id === withHkd.id ? withHkd : e))));
    notify('記錄已更新');
  }, [exchangeRates]);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    notify('記錄已刪除');
  }, []);

  // ── Context value ──
  const value = useMemo(() => ({
    settings, updateSettings,
    people, setPeople,
    trips, currentTripId, currentTrip,
    createTrip, switchTrip, deleteTrip, updateTripName,
    expenses, setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    filterPerson, setFilterPerson,
    toast, notify,
    exchangeRates,
  }), [
    settings, people, trips, currentTripId, currentTrip,
    expenses, filterPerson, toast, exchangeRates,
    updateSettings, setPeople, createTrip, switchTrip, deleteTrip, updateTripName,
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
