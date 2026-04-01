import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DataService from '../services/DataService';
import { bootstrapUserAppData, persistUserAppData } from '../services/syncSupabase';
import { supabase } from '../lib/supabaseClient';
import { sortExpenses } from '../utils/date';
import { toHome } from '../utils/currency';
import i18n from '../i18n';
import { resolveAppLanguage } from '../utils/locale';
import { getDefaultAssignee } from '../utils/people';
import { getAccountingCode, getTripCurrencyCode } from '../utils/tripMoney';
import { recalculateExpensesForRates } from '../utils/recalculateExpensesForRates';
import { buildMergedSavedCurrencySettings } from '../utils/savedCurrencyMerge';
import { CATEGORIES } from '../utils/constants';
import {
  sanitizeCustomExpenseCategoriesArray,
  validateNewCustomExpenseCategory,
} from '../utils/expenseCategories';
import { buildBillingSnapshot } from '../../shared/billing';

const AppContext = createContext(null);

const PERSIST_DEBOUNCE_MS = 500;

/**
 * 先從 Supabase 載入（無則建立預設並上傳），再掛載內層；本機 localStorage 作為快取，雲端為唯一真相來源。
 */
export function AppProvider({ children, userId }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setBootError(null);
    (async () => {
      try {
        await bootstrapUserAppData(userId);
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setBootError(e?.message || 'sync failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (bootError) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-sm text-red-700 text-center max-w-md">{t('errors.syncFailed', { message: bootError })}</p>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={() => window.location.reload()}
        >
          {t('errors.syncRetry')}
        </button>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-slate-600 text-sm">{t('auth.loading')}</p>
      </div>
    );
  }

  return (
    <AppProviderInner key={userId} userId={userId}>
      {children}
    </AppProviderInner>
  );
}

function AppProviderInner({ children, userId }) {
  const { t } = useTranslation();
  DataService.setStorageScope(userId);

  const [settings, setSettingsState] = useState(() => DataService.loadSettings());
  const [billing, setBilling] = useState(() => ({
    ...buildBillingSnapshot(),
    loading: true,
    error: '',
  }));

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

  const applyBillingSnapshot = useCallback((snapshot) => {
    setBilling((prev) => ({
      ...prev,
      ...snapshot,
      loading: false,
      error: '',
    }));
  }, []);

  const refreshBilling = useCallback(async () => {
    if (!supabase || !userId) {
      applyBillingSnapshot(buildBillingSnapshot());
      return;
    }

    setBilling((prev) => ({ ...prev, loading: true, error: '' }));

    const [{ data: billingRow, error: billingError }, { count: usageCount, error: usageError }] = await Promise.all([
      supabase
        .from('user_app_data')
        .select('subscription_status')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('usage_logs')
        .select('id', { head: true, count: 'exact' })
        .eq('user_id', userId)
        .eq('event_type', 'receipt_scan'),
    ]);

    if (billingError || usageError) {
      throw billingError || usageError;
    }

    applyBillingSnapshot(
      buildBillingSnapshot({
        subscriptionStatus: billingRow?.subscription_status,
        usedReceiptScans: usageCount || 0,
      }),
    );
  }, [userId, applyBillingSnapshot]);

  useEffect(() => {
    refreshBilling().catch((err) => {
      console.error('[billing]', err);
      setBilling((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || 'billing failed',
      }));
    });
  }, [refreshBilling]);

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
    const id = setTimeout(() => {
      persistUserAppData(userId).catch((err) => {
        console.error('[sync]', err);
        const msg =
          err?.message ||
          err?.error_description ||
          (typeof err === 'string' ? err : JSON.stringify(err));
        notify(t('errors.persistFailed', { message: msg }), 'error');
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [userId, trips, currentTripId, expenses, settings, people, notify, t]);

  useEffect(() => {
    if (expenses.length === 0) return;
    const { expenses: updated, changed } = recalculateExpensesForRates(expenses, exchangeRates);
    if (changed) {
      setExpenses(updated);
      notify(i18n.t('toast.ratesUpdated'));
    }
  }, [exchangeRates]);

  const mergeSavedCurrencyListsFromTrip = useCallback((trip) => {
    setSettingsState((prev) => {
      const next = buildMergedSavedCurrencySettings(prev, trip);
      if (!next) return prev;
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
    const withHkd = {
      ...updated,
      hkdAmount: toHome(updated.originalAmount, updated.currency, exchangeRates),
    };
    setExpenses((prev) => sortExpenses(prev.map((e) => (e.id === withHkd.id ? withHkd : e))));
    notify(i18n.t('toast.expenseUpdated'));
  }, [exchangeRates, notify]);

  const removeExpense = useCallback((id) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    notify(i18n.t('toast.expenseDeleted'));
  }, [notify]);

  const addCustomExpenseCategory = useCallback(
    (raw) => {
      const existing = settings.customExpenseCategories || [];
      const v = validateNewCustomExpenseCategory(raw, existing);
      if (!v.ok) return v;
      const next = sanitizeCustomExpenseCategoriesArray([...existing, v.name]);
      updateSettings({ customExpenseCategories: next });
      notify(i18n.t('toast.customCategoryAdded', { name: v.name }));
      return { ok: true };
    },
    [settings.customExpenseCategories, updateSettings, notify],
  );

  const removeCustomExpenseCategory = useCallback(
    (name) => {
      if (CATEGORIES.includes(name)) return { ok: false, reason: 'preset' };
      const existing = settings.customExpenseCategories || [];
      if (!existing.includes(name)) return { ok: false, reason: 'missing' };
      DataService.reassignExpenseCategoryInAllTrips(name, '其他');
      updateSettings({
        customExpenseCategories: existing.filter((x) => x !== name),
      });
      const data = DataService.loadTripsData();
      setTrips(data.trips);
      setExpensesState(sortExpenses(DataService.loadExpenses()));
      notify(i18n.t('toast.customCategoryRemoved', { name }));
      return { ok: true };
    },
    [settings.customExpenseCategories, updateSettings, notify],
  );

  const tripCurrency = getTripCurrencyCode(currentTrip);

  const defaultAssignee = useMemo(() => getDefaultAssignee(people), [people]);

  const value = useMemo(() => ({
    settings, updateSettings,
    billing, refreshBilling, applyBillingSnapshot,
    people, setPeople,
    trips, currentTripId, currentTrip,
    createTrip, switchTrip, deleteTrip, updateTrip, renamePerson, removePersonWithReassign,
    expenses, setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    addCustomExpenseCategory, removeCustomExpenseCategory,
    filterPerson, setFilterPerson,
    toast, notify,
    exchangeRates,
    homeCurrencyCode,
    tripCurrency,
    defaultAssignee,
  }), [
    settings, billing, people, trips, currentTripId, currentTrip,
    expenses, filterPerson, toast, exchangeRates, homeCurrencyCode, tripCurrency,
    defaultAssignee,
    updateSettings, refreshBilling, applyBillingSnapshot, setPeople, createTrip, switchTrip, deleteTrip, updateTrip, renamePerson, removePersonWithReassign,
    setExpenses, addExpense, addExpenses, updateExpense, removeExpense,
    addCustomExpenseCategory, removeCustomExpenseCategory,
    setFilterPerson, notify,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
