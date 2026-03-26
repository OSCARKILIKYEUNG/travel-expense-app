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
    if (stored) {
      let dirty = false;
      for (const trip of stored.trips) {
        if (!trip.tripCurrency) {
          trip.tripCurrency = 'JPY';
          dirty = true;
        }
      }
      if (dirty) this.saveTripsData(stored);
      return stored;
    }
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

  createTrip(name, startDate, tripCurrency) {
    const tripsData = this.loadTripsData();
    const newTrip = {
      id: `trip-${Date.now()}`,
      name,
      startDate,
      tripCurrency: tripCurrency || 'JPY',
      createdAt: new Date().toISOString(),
      expenses: [],
      settings: { people: [...(tripsData.trips[0]?.settings?.people || ['共同'])] },
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
  /** 反轉舊版匯率（1 外幣 = X 本幣 → 1 本幣 = X 外幣） */
  _migrateRates(oldRates) {
    const out = {};
    for (const [code, rate] of Object.entries(oldRates)) {
      out[code] = rate > 0 ? parseFloat((1 / rate).toPrecision(6)) : 1;
    }
    return out;
  },

  _isOldRateFormat(saved) {
    return !saved.homeCurrency;
  },

  loadSettings() {
    const saved = read(KEYS.SETTINGS);
    if (saved) {
      const { apiKey: _omitKey, modelName: _omitModel, ...rest } = saved;

      if (this._isOldRateFormat(saved)) {
        const migratedRates = this._migrateRates(saved.exchangeRates || {});
        const homeCurrency = (saved.defaultCurrency && saved.defaultCurrency !== 'OTHER')
          ? saved.defaultCurrency : 'HKD';
        const customRate = (saved.customCurrencyRate && saved.customCurrencyRate > 0)
          ? parseFloat((1 / saved.customCurrencyRate).toPrecision(6)) : 1;
        const migrated = {
          ...rest,
          exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...migratedRates },
          homeCurrency,
          customCurrencyCode: saved.customCurrencyCode || '',
          customCurrencyRate: customRate,
          uiLanguage: normalizeUiLanguage(saved.uiLanguage),
        };
        delete migrated.defaultCurrency;
        this.saveSettings(migrated);
        return migrated;
      }

      return {
        ...rest,
        exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...(saved.exchangeRates || {}) },
        homeCurrency: saved.homeCurrency || 'HKD',
        customCurrencyCode: saved.customCurrencyCode || '',
        customCurrencyRate: saved.customCurrencyRate || 1,
        uiLanguage: normalizeUiLanguage(saved.uiLanguage),
      };
    }
    const preset = PRESET_TRIPS_DATA.trips[0]?.settings;
    if (preset) {
      return {
        exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...(preset.exchangeRates || {}) },
        homeCurrency: preset.homeCurrency || 'HKD',
        customCurrencyCode: preset.customCurrencyCode || '',
        customCurrencyRate: preset.customCurrencyRate || 1,
        uiLanguage: normalizeUiLanguage(preset.uiLanguage),
      };
    }
    return {
      exchangeRates: DEFAULT_EXCHANGE_RATES,
      homeCurrency: 'HKD',
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

  /** 將所有旅程內 `settings.people` 中的舊名替換為新名（與 `travel_people_list` 一併維護時使用） */
  syncPersonNameInAllTrips(oldName, newName) {
    const tripsData = this.loadTripsData();
    for (const trip of tripsData.trips) {
      const list = trip.settings?.people;
      if (!Array.isArray(list) || !list.some((p) => p === oldName)) continue;
      trip.settings = {
        ...trip.settings,
        people: list.map((p) => (p === oldName ? newName : p)),
      };
    }
    this.saveTripsData(tripsData);
  },
};

export default DataService;
