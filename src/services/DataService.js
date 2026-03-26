import { DEFAULT_EXCHANGE_RATES, PRESET_TRIPS_DATA } from '../utils/constants';
import { normalizeUiLanguage } from '../utils/locale';

const KEYS = {
  TRIPS: 'travel_trips_data',
  EXPENSES: 'travel_expenses_data',
  SETTINGS: 'travel_app_settings',
  PEOPLE: 'travel_people_list',
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

const DataService = {
  // ── Trips ──────────────────────────────────────────
  loadTripsData() {
    const stored = read(KEYS.TRIPS);
    if (stored) return stored;
    this.saveTripsData(PRESET_TRIPS_DATA);
    return PRESET_TRIPS_DATA;
  },

  saveTripsData(data) {
    write(KEYS.TRIPS, data);
  },

  getCurrentTrip(tripsData) {
    return (
      tripsData.trips.find((t) => t.id === tripsData.currentTripId) ||
      tripsData.trips[0]
    );
  },

  switchTrip(tripId, currentExpenses) {
    const tripsData = this.loadTripsData();
    const current = this.getCurrentTrip(tripsData);
    if (current) current.expenses = currentExpenses;
    tripsData.currentTripId = tripId;
    this.saveTripsData(tripsData);
    const next = this.getCurrentTrip(tripsData);
    return next ? next.expenses : [];
  },

  createTrip(name, startDate) {
    const tripsData = this.loadTripsData();
    const newTrip = {
      id: `trip-${Date.now()}`,
      name,
      startDate,
      createdAt: new Date().toISOString(),
      expenses: [],
      settings: { ...tripsData.trips[0].settings },
    };
    tripsData.trips.push(newTrip);
    tripsData.currentTripId = newTrip.id;
    this.saveTripsData(tripsData);
    return newTrip;
  },

  deleteTrip(tripId) {
    const tripsData = this.loadTripsData();
    if (tripsData.trips.length <= 1) return false;
    tripsData.trips = tripsData.trips.filter((t) => t.id !== tripId);
    if (tripsData.currentTripId === tripId) {
      tripsData.currentTripId = tripsData.trips[0].id;
    }
    this.saveTripsData(tripsData);
    return true;
  },

  updateCurrentTripExpenses(expenses) {
    const tripsData = this.loadTripsData();
    const current = this.getCurrentTrip(tripsData);
    if (current) {
      current.expenses = expenses;
      this.saveTripsData(tripsData);
    }
  },

  // ── Expenses ───────────────────────────────────────
  loadExpenses() {
    const saved = read(KEYS.EXPENSES);
    if (saved) return saved;
    const tripsData = this.loadTripsData();
    const trip = this.getCurrentTrip(tripsData);
    return trip?.expenses || [];
  },

  saveExpenses(expenses) {
    write(KEYS.EXPENSES, expenses);
  },

  // ── Settings ───────────────────────────────────────
  loadSettings() {
    const saved = read(KEYS.SETTINGS);
    if (saved) {
      const { apiKey: _omitKey, modelName: _omitModel, ...rest } = saved;
      return {
        ...rest,
        exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...(saved.exchangeRates || {}) },
        defaultCurrency: saved.defaultCurrency || 'HKD',
        customCurrencyCode: saved.customCurrencyCode || '',
        customCurrencyRate: saved.customCurrencyRate || 1,
        uiLanguage: normalizeUiLanguage(saved.uiLanguage),
      };
    }
    const preset = PRESET_TRIPS_DATA.trips[0]?.settings;
    if (preset) {
      return {
        exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...(preset.exchangeRates || {}) },
        defaultCurrency: preset.defaultCurrency || 'HKD',
        customCurrencyCode: preset.customCurrencyCode || '',
        customCurrencyRate: preset.customCurrencyRate || 1,
        uiLanguage: normalizeUiLanguage(preset.uiLanguage),
      };
    }
    return {
      exchangeRates: DEFAULT_EXCHANGE_RATES,
      defaultCurrency: 'HKD',
      customCurrencyCode: '',
      customCurrencyRate: 1,
      uiLanguage: 'zh-TW',
    };
  },

  saveSettings(settings) {
    write(KEYS.SETTINGS, settings);
  },

  // ── People ─────────────────────────────────────────
  loadPeople() {
    const saved = read(KEYS.PEOPLE);
    if (saved) return saved;
    const preset = PRESET_TRIPS_DATA.trips[0]?.settings?.people;
    return preset || ['共同', '人物A', '人物B'];
  },

  savePeople(people) {
    write(KEYS.PEOPLE, people);
  },
};

export default DataService;
