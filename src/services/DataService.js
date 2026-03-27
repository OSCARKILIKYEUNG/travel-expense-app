import { CURRENCY_NAMES, DEFAULT_EXCHANGE_RATES, PRESET_TRIPS_DATA } from '../utils/constants';
import { normalizeUiLanguage } from '../utils/locale';
import { blankRatesForAccounting, getAccountingCode } from '../utils/tripMoney';
import { FRANKFURTER_SUPPORTED, rebaseRates } from './ExchangeRateService';

const KEYS = {
  TRIPS: 'travel_trips_data',
  EXPENSES: 'travel_expenses_data',
  SETTINGS: 'travel_app_settings',
  PEOPLE: 'travel_people_list',
};

/** 目前登入使用者（Supabase `user.id`）；未設定時沿用未加前綴鍵名（僅供測試／異常） */
let activeUserId = null;

function physicalKey(logicalKey) {
  if (!activeUserId) return logicalKey;
  return `user:${activeUserId}:${logicalKey}`;
}

function readLogical(logicalKey) {
  try {
    const raw = localStorage.getItem(physicalKey(logicalKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLogical(logicalKey, data) {
  localStorage.setItem(physicalKey(logicalKey), JSON.stringify(data));
}

/** 未加 `user:` 前綴的舊版鍵（登入前資料） */
function readUnscoped(logicalKey) {
  try {
    const raw = localStorage.getItem(logicalKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 從所有旅程掃描曾用記帳幣／旅程幣，供首次填入全域重用清單 */
function buildSavedCurrencyListsFromTrips() {
  const data = readLogical(KEYS.TRIPS);
  const acc = new Set();
  const tripC = new Set();
  for (const t of data?.trips || []) {
    const a = String(t.accountingCurrency || '')
      .toUpperCase()
      .slice(0, 3);
    if (/^[A-Z]{3}$/.test(a)) acc.add(a);
    (t.customAccountingCodes || []).forEach((c) => {
      const x = String(c)
        .toUpperCase()
        .slice(0, 3);
      if (/^[A-Z]{3}$/.test(x)) acc.add(x);
    });
    const tc = String(t.tripCurrency || '')
      .toUpperCase()
      .slice(0, 3);
    if (/^[A-Z]{3}$/.test(tc)) tripC.add(tc);
    (t.customTripCurrencyCodes || []).forEach((c) => {
      const x = String(c)
        .toUpperCase()
        .slice(0, 3);
      if (/^[A-Z]{3}$/.test(x)) tripC.add(x);
    });
  }
  return {
    savedAccountingCodes: [...acc].sort(),
    savedTripCurrencies: [...tripC].sort(),
  };
}

function stripLegacyCurrencyFromSettings() {
  const settings = readLogical(KEYS.SETTINGS);
  if (!settings) return;
  const next = { ...settings };
  delete next.homeCurrency;
  delete next.customCurrencyCode;
  delete next.customCurrencyRate;
  delete next.exchangeRates;
  delete next.exchangeRatesUpdatedAt;
  next._currencyMigratedToTrips = true;
  writeLogical(KEYS.SETTINGS, next);
}

/**
 * 將全域設定中的本幣／匯率併入各旅程（僅執行一次），並自 trip.settings 抬升舊欄位。
 */
function migrateTripsCurrency(data) {
  const settings = readLogical(KEYS.SETTINGS);
  const globalMigrated = settings?._currencyMigratedToTrips;
  let dirty = false;

  for (const trip of data.trips || []) {
    if (!trip.tripCurrency) {
      trip.tripCurrency = 'JPY';
      dirty = true;
    }
    if (trip.settings?.exchangeRates && trip.exchangeRates == null) {
      trip.exchangeRates = { ...trip.settings.exchangeRates };
      delete trip.settings.exchangeRates;
      dirty = true;
    }
    if (trip.settings?.homeCurrency != null && trip.accountingCurrency == null) {
      const h = trip.settings.homeCurrency;
      trip.accountingCurrency =
        h === 'OTHER' && trip.settings.customCurrencyCode
          ? String(trip.settings.customCurrencyCode).toUpperCase().slice(0, 3)
          : h;
      trip.accountingIsCustom = h === 'OTHER';
      delete trip.settings.homeCurrency;
      delete trip.settings.customCurrencyCode;
      delete trip.settings.customCurrencyRate;
      dirty = true;
    }
    if (trip.accountingCurrency == null) {
      if (!globalMigrated && settings?.homeCurrency) {
        const gh = settings.homeCurrency;
        trip.accountingCurrency =
          gh === 'OTHER' && settings.customCurrencyCode?.length === 3
            ? String(settings.customCurrencyCode).toUpperCase().slice(0, 3)
            : gh || 'HKD';
        trip.accountingIsCustom = gh === 'OTHER';
      } else {
        trip.accountingCurrency = 'HKD';
        trip.accountingIsCustom = false;
      }
      dirty = true;
    }
    if (trip.accountingIsCustom == null) {
      trip.accountingIsCustom = false;
      dirty = true;
    }
    if (!Array.isArray(trip.customAccountingCodes)) {
      trip.customAccountingCodes = [];
      dirty = true;
    }
    if (!Array.isArray(trip.manualRateCodes)) {
      trip.manualRateCodes = [];
      dirty = true;
    }
    if (!Array.isArray(trip.exchangeRateUserEditedCodes)) {
      trip.exchangeRateUserEditedCodes = [];
      dirty = true;
    }
    if (!Array.isArray(trip.customTripCurrencyCodes)) {
      trip.customTripCurrencyCodes = [];
      dirty = true;
    }
    {
      const tcur = String(trip.tripCurrency || '')
        .toUpperCase()
        .slice(0, 3);
      if (trip.tripCurrencyIsCustom == null) {
        trip.tripCurrencyIsCustom = !!(
          tcur &&
          /^[A-Z]{3}$/.test(tcur) &&
          !CURRENCY_NAMES[tcur]
        );
        dirty = true;
      }
    }
    if (!trip.exchangeRates || Object.keys(trip.exchangeRates).length === 0) {
      if (!globalMigrated && settings?.exchangeRates && Object.keys(settings.exchangeRates).length) {
        trip.exchangeRates = { ...settings.exchangeRates };
        trip.exchangeRatesUpdatedAt = trip.exchangeRatesUpdatedAt ?? settings.exchangeRatesUpdatedAt ?? null;
      } else {
        trip.exchangeRates = { ...DEFAULT_EXCHANGE_RATES };
        trip.exchangeRatesUpdatedAt = trip.exchangeRatesUpdatedAt ?? null;
      }
      dirty = true;
    }
    const ac = String(trip.accountingCurrency).toUpperCase().slice(0, 3);
    if (trip.exchangeRates[ac] == null) {
      trip.exchangeRates[ac] = 1;
      dirty = true;
    }
  }

  stripLegacyCurrencyFromSettings();

  return dirty;
}

function applyAccountingRatesAfterChange(trip, prevCode, prevIsCustom) {
  const newCode = getAccountingCode(trip);
  const newIsCustom = !!trip.accountingIsCustom;
  if (newCode === prevCode && newIsCustom === prevIsCustom) return;
  if (newIsCustom || !FRANKFURTER_SUPPORTED.has(newCode)) {
    trip.exchangeRates = blankRatesForAccounting(newCode);
    trip.exchangeRatesUpdatedAt = null;
    return;
  }
  if (prevIsCustom || !FRANKFURTER_SUPPORTED.has(prevCode)) {
    trip.exchangeRates = rebaseRates({ ...DEFAULT_EXCHANGE_RATES }, newCode);
    trip.exchangeRatesUpdatedAt = null;
    return;
  }
  if (newCode !== prevCode) {
    trip.exchangeRates = rebaseRates({ ...(trip.exchangeRates || DEFAULT_EXCHANGE_RATES) }, newCode);
    trip.exchangeRatesUpdatedAt = null;
  }
}

const DataService = {
  loadTripsData() {
    const stored = readLogical(KEYS.TRIPS);
    const data = stored ? { ...stored, trips: [...stored.trips] } : { ...PRESET_TRIPS_DATA };
    if (!stored) {
      writeLogical(KEYS.TRIPS, data);
    }
    const dirty = migrateTripsCurrency(data);
    if (dirty) writeLogical(KEYS.TRIPS, data);
    return data;
  },

  saveTripsData(data) {
    writeLogical(KEYS.TRIPS, data);
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

  /**
   * @param {object} [options]
   * @param {string} [options.accountingCurrency]
   * @param {boolean} [options.accountingIsCustom]
   * @param {string[]} [options.customAccountingCodes]
   * @param {boolean} [options.tripCurrencyIsCustom]
   * @param {string[]} [options.customTripCurrencyCodes]
   */
  createTrip(name, startDate, tripCurrency, options = {}) {
    const tripsData = this.loadTripsData();
    const cur = this.getCurrentTrip(tripsData);
    const ac =
      options.accountingCurrency != null
        ? String(options.accountingCurrency).toUpperCase().slice(0, 3)
        : cur?.accountingCurrency || 'HKD';
    const isCustom =
      options.accountingIsCustom != null ? !!options.accountingIsCustom : !!cur?.accountingIsCustom;
    const customCodes = Array.isArray(options.customAccountingCodes)
      ? [...options.customAccountingCodes]
      : [...(cur?.customAccountingCodes || [])];

    let exchangeRates;
    let exchangeRatesUpdatedAt = null;
    if (isCustom || !FRANKFURTER_SUPPORTED.has(ac)) {
      exchangeRates = blankRatesForAccounting(ac);
    } else {
      exchangeRates = rebaseRates({ ...DEFAULT_EXCHANGE_RATES }, ac);
    }

    const tcCode = String(tripCurrency || 'JPY')
      .toUpperCase()
      .slice(0, 3);
    const tripIsCustom =
      options.tripCurrencyIsCustom != null
        ? !!options.tripCurrencyIsCustom
        : !!cur?.tripCurrencyIsCustom;
    const customTripCodes = Array.isArray(options.customTripCurrencyCodes)
      ? [...options.customTripCurrencyCodes]
      : [...(cur?.customTripCurrencyCodes || [])];

    const peopleSource = cur?.settings?.people || tripsData.trips[0]?.settings?.people || ['共同'];
    const newTrip = {
      id: `trip-${Date.now()}`,
      name,
      startDate,
      tripCurrency: tcCode || 'JPY',
      tripCurrencyIsCustom: tripIsCustom,
      customTripCurrencyCodes: customTripCodes,
      accountingCurrency: ac,
      accountingIsCustom: isCustom,
      customAccountingCodes: customCodes,
      exchangeRates,
      exchangeRatesUpdatedAt,
      manualRateCodes: [],
      exchangeRateUserEditedCodes: [],
      createdAt: new Date().toISOString(),
      expenses: [],
      settings: { people: [...peopleSource] },
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

  /**
   * 合併更新旅程欄位；變更記帳幣時自動重算或清空匯率表。
   */
  patchTrip(tripId, patch) {
    const tripsData = this.loadTripsData();
    const trip = tripsData.trips.find((t) => t.id === tripId);
    if (!trip) return false;

    const prevCode = getAccountingCode(trip);
    const prevIsCustom = !!trip.accountingIsCustom;

    if (patch.name != null) {
      const trimmed = String(patch.name).trim();
      if (trimmed) trip.name = trimmed;
    }
    if (patch.tripCurrency != null) {
      const code = String(patch.tripCurrency).toUpperCase().slice(0, 3);
      trip.tripCurrency = code;
    }
    if (patch.tripCurrencyIsCustom != null) {
      trip.tripCurrencyIsCustom = !!patch.tripCurrencyIsCustom;
    }
    if (patch.customTripCurrencyCodes != null) {
      trip.customTripCurrencyCodes = [...patch.customTripCurrencyCodes];
    }
    if (patch.accountingCurrency != null) {
      trip.accountingCurrency = String(patch.accountingCurrency).toUpperCase().slice(0, 3);
    }
    if (patch.accountingIsCustom != null) {
      trip.accountingIsCustom = !!patch.accountingIsCustom;
    }
    if (patch.customAccountingCodes != null) {
      trip.customAccountingCodes = [...patch.customAccountingCodes];
    }

    const accountingTouched =
      patch.accountingCurrency != null ||
      patch.accountingIsCustom != null;
    if (accountingTouched) {
      applyAccountingRatesAfterChange(trip, prevCode, prevIsCustom);
    }

    if (patch.exchangeRates != null) {
      trip.exchangeRates = { ...patch.exchangeRates };
    }
    if (patch.manualRateCodes != null) {
      trip.manualRateCodes = [...patch.manualRateCodes];
    }
    if (patch.exchangeRateUserEditedCodes != null) {
      trip.exchangeRateUserEditedCodes = [...patch.exchangeRateUserEditedCodes];
    }
    if (patch.exchangeRatesUpdatedAt !== undefined) {
      trip.exchangeRatesUpdatedAt = patch.exchangeRatesUpdatedAt;
    }

    this.saveTripsData(tripsData);
    return true;
  },

  // ── Expenses ───────────────────────────────────────
  loadExpenses() {
    const saved = readLogical(KEYS.EXPENSES);
    if (saved) return saved;
    const tripsData = this.loadTripsData();
    const trip = this.getCurrentTrip(tripsData);
    return trip?.expenses || [];
  },

  saveExpenses(expenses) {
    writeLogical(KEYS.EXPENSES, expenses);
  },

  // ── Settings ───────────────────────────────────────
  _migrateRates(oldRates) {
    const out = {};
    for (const [code, rate] of Object.entries(oldRates)) {
      out[code] = rate > 0 ? parseFloat((1 / rate).toPrecision(6)) : 1;
    }
    return out;
  },

  _isOldRateFormat(saved) {
    return saved && !saved.homeCurrency;
  },

  loadSettings() {
    this.loadTripsData();

    const saved = readLogical(KEYS.SETTINGS);
    if (saved) {
      if (this._isOldRateFormat(saved)) {
        const migratedRates = this._migrateRates(saved.exchangeRates || {});
        const homeCurrency =
          saved.defaultCurrency && saved.defaultCurrency !== 'OTHER'
            ? saved.defaultCurrency
            : 'HKD';
        const customRate =
          saved.customCurrencyRate && saved.customCurrencyRate > 0
            ? parseFloat((1 / saved.customCurrencyRate).toPrecision(6))
            : 1;
        const { apiKey: _omitKey, modelName: _omitModel, ...rest } = saved;
        const migrated = {
          ...rest,
          exchangeRates: { ...DEFAULT_EXCHANGE_RATES, ...migratedRates },
          homeCurrency,
          customCurrencyCode: saved.customCurrencyCode || '',
          customCurrencyRate: customRate,
          uiLanguage: normalizeUiLanguage(saved.uiLanguage),
          exchangeRatesUpdatedAt: null,
        };
        delete migrated.defaultCurrency;
        writeLogical(KEYS.SETTINGS, migrated);
      }

      this.loadTripsData();
      stripLegacyCurrencyFromSettings();

      const latest = readLogical(KEYS.SETTINGS);
      const fromTrips = buildSavedCurrencyListsFromTrips();
      const savedAccountingCodes = Array.isArray(latest?.savedAccountingCodes)
        ? latest.savedAccountingCodes
        : fromTrips.savedAccountingCodes;
      const savedTripCurrencies = Array.isArray(latest?.savedTripCurrencies)
        ? latest.savedTripCurrencies
        : fromTrips.savedTripCurrencies;
      const out = {
        uiLanguage: normalizeUiLanguage(latest?.uiLanguage ?? 'zh-TW'),
        savedAccountingCodes,
        savedTripCurrencies,
        ...(latest?.apiKey != null ? { apiKey: latest.apiKey } : {}),
        ...(latest?.modelName != null ? { modelName: latest.modelName } : {}),
      };
      if (
        !Array.isArray(latest?.savedAccountingCodes) ||
        !Array.isArray(latest?.savedTripCurrencies)
      ) {
        writeLogical(KEYS.SETTINGS, { ...latest, savedAccountingCodes, savedTripCurrencies });
      }
      return out;
    }
    const fromTrips = buildSavedCurrencyListsFromTrips();
    return {
      uiLanguage: 'zh-TW',
      savedAccountingCodes: fromTrips.savedAccountingCodes,
      savedTripCurrencies: fromTrips.savedTripCurrencies,
    };
  },

  saveSettings(settings) {
    const prev = readLogical(KEYS.SETTINGS) || {};
    writeLogical(KEYS.SETTINGS, {
      ...prev,
      ...settings,
    });
  },

  // ── People ─────────────────────────────────────────
  loadPeople() {
    const saved = readLogical(KEYS.PEOPLE);
    if (saved) return saved;
    const preset = PRESET_TRIPS_DATA.trips[0]?.settings?.people;
    return preset || ['共同', '人物A', '人物B'];
  },

  savePeople(people) {
    writeLogical(KEYS.PEOPLE, people);
  },

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

  removePersonAndReassignAll(deletedName, reassignTo) {
    const tripsData = this.loadTripsData();
    const mapExp = (e) => {
      let next = { ...e };
      if (next.assignedTo === deletedName) next.assignedTo = reassignTo;
      if (next.items?.length) {
        next.items = next.items.map((it) =>
          it.assignedTo === deletedName ? { ...it, assignedTo: reassignTo } : it
        );
      }
      return next;
    };
    for (const trip of tripsData.trips) {
      const pl = trip.settings?.people;
      if (Array.isArray(pl)) {
        trip.settings = { ...trip.settings, people: pl.filter((p) => p !== deletedName) };
      }
      trip.expenses = (trip.expenses || []).map(mapExp);
    }
    this.saveTripsData(tripsData);
    const cur = this.getCurrentTrip(tripsData);
    if (cur?.expenses) {
      this.saveExpenses(cur.expenses);
    }
  },

  /**
   * 登入後依 Supabase user.id 區分 localStorage；須在 AppProvider 首次 render 前呼叫。
   * @param {string | null} userId
   */
  setStorageScope(userId) {
    activeUserId = userId && typeof userId === 'string' ? userId : null;
  },

  /** 是否存在「未登入前」寫入的舊鍵（無 user: 前綴） */
  hasLegacyUnscopedData() {
    const d = readUnscoped(KEYS.TRIPS);
    return !!(d?.trips?.length);
  },

  /**
   * 將未登入前的本機四鍵複製到目前帳號範圍（會覆寫同鍵內容）。
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  importLegacyIntoScoped() {
    if (!activeUserId) return { ok: false, reason: 'no_scope' };
    let any = false;
    for (const logicalKey of Object.values(KEYS)) {
      const raw = localStorage.getItem(logicalKey);
      if (!raw) continue;
      try {
        writeLogical(logicalKey, JSON.parse(raw));
        any = true;
      } catch {
        /* ignore */
      }
    }
    return any ? { ok: true } : { ok: false, reason: 'no_legacy' };
  },
};

export default DataService;
