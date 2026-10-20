/**
 * Decide whether a Supabase user_app_data row may replace the local cache.
 * Pure aside from the storage object passed in, so reload races are unit-testable.
 *
 * A stale in-flight upsert can land last and bump the row's updated_at while its
 * trips_data payload is still the older blob. Compare the timestamp stored inside
 * the payload first, and keep the local cache when that content is newer.
 */
import { KEYS, scopedLocalStorageKey } from '../services/DataService';
import { reconcileUndoState } from './duplicateDecisions';

export function replaceUndoStorageKey(userId) {
  return `travel_replace_undo:${userId}`;
}

export function parseTimestamp(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Content time of a remote row. Payload updatedAt wins over the row clock. */
export function remoteContentTimestamp(remoteRow) {
  if (!remoteRow) return null;
  const blob = remoteRow.trips_data ?? remoteRow.tripsData ?? null;
  return blob?.updatedAt ?? blob?.updated_at ?? remoteRow.updated_at ?? remoteRow.updatedAt ?? null;
}

export function localContentTimestamp({ tripsUpdatedAt, expensesUpdatedAt, localUpdatedAt } = {}) {
  const times = [tripsUpdatedAt, expensesUpdatedAt, localUpdatedAt]
    .map(parseTimestamp)
    .filter((t) => t != null);
  if (!times.length) return null;
  return Math.max(...times);
}

/**
 * @returns {'local'|'remote'}
 * Tie and missing local clock both keep the remote row (legacy devices).
 */
export function chooseAppDataSource(localTs, remoteTs) {
  if (localTs == null) return 'remote';
  if (remoteTs == null) return 'local';
  return localTs > remoteTs ? 'local' : 'remote';
}

/**
 * When the expenses cache was written before the trip blob caught up, the cache
 * is the replace that must survive reload. Otherwise the trip blob wins.
 */
export function selectLocalExpenseList({ tripExpenses, cachedExpenses, tripUpdatedAt, expensesUpdatedAt }) {
  const tripTs = parseTimestamp(tripUpdatedAt);
  const expTs = parseTimestamp(expensesUpdatedAt);
  const cache = Array.isArray(cachedExpenses) ? cachedExpenses : null;
  const trip = Array.isArray(tripExpenses) ? tripExpenses : null;
  if (cache && trip) {
    if (expTs != null && (tripTs == null || expTs >= tripTs)) return cache;
    if (tripTs != null && (expTs == null || tripTs > expTs)) return trip;
    return cache;
  }
  if (cache) return cache;
  return trip || [];
}

function readJson(storage, key) {
  const raw = storage.getItem(key);
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function currentTripOf(tripsData) {
  const trips = Array.isArray(tripsData?.trips) ? tripsData.trips : [];
  const trip = trips.find((t) => t && t.id === tripsData?.currentTripId) || trips[0] || null;
  return {
    trip,
    tripId: trip?.id ?? tripsData?.currentTripId ?? null,
    expenses: Array.isArray(trip?.expenses) ? trip.expenses : [],
  };
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

/**
 * Apply a remote user_app_data row onto storage without clobbering a newer local replace.
 * Also drops an undo entry whose replacement record is not in the chosen list.
 *
 * @param {{ getItem: Function, setItem: Function, removeItem: Function }} storage
 * @param {string} userId
 * @param {object|null} remoteRow
 * @param {number} [now]
 */
export function mergeRemoteWithLocalStorage(storage, userId, remoteRow, now = Date.now()) {
  const tripsKey = scopedLocalStorageKey(userId, KEYS.TRIPS);
  const expensesKey = scopedLocalStorageKey(userId, KEYS.EXPENSES);
  const expensesAtKey = scopedLocalStorageKey(userId, KEYS.EXPENSES_UPDATED_AT);
  const localAtKey = scopedLocalStorageKey(userId, KEYS.LOCAL_UPDATED_AT);
  const settingsKey = scopedLocalStorageKey(userId, KEYS.SETTINGS);
  const peopleKey = scopedLocalStorageKey(userId, KEYS.PEOPLE);
  const undoKey = replaceUndoStorageKey(userId);

  const localTrips = readJson(storage, tripsKey);
  const cachedExpenses = readJson(storage, expensesKey);
  const expensesUpdatedAt = readJson(storage, expensesAtKey);
  const localUpdatedAt = readJson(storage, localAtKey);

  const localTs = localContentTimestamp({
    tripsUpdatedAt: localTrips?.updatedAt,
    expensesUpdatedAt,
    localUpdatedAt,
  });
  const remoteTs = parseTimestamp(remoteContentTimestamp(remoteRow));
  const source = remoteRow ? chooseAppDataSource(localTs, remoteTs) : 'local';

  let tripsData;
  let expenses;

  if (source === 'remote' && remoteRow) {
    tripsData = remoteRow.trips_data && typeof remoteRow.trips_data === 'object'
      ? remoteRow.trips_data
      : { trips: [], currentTripId: null };
    expenses = currentTripOf(tripsData).expenses;
    writeJson(storage, tripsKey, tripsData);
    if (remoteRow.app_settings !== undefined) writeJson(storage, settingsKey, remoteRow.app_settings);
    if (remoteRow.people_list !== undefined) writeJson(storage, peopleKey, remoteRow.people_list);
    writeJson(storage, expensesKey, expenses);
    const stamp = remoteContentTimestamp(remoteRow);
    if (stamp) {
      writeJson(storage, expensesAtKey, stamp);
      writeJson(storage, localAtKey, stamp);
    }
  } else {
    const base = localTrips && typeof localTrips === 'object'
      ? {
        ...localTrips,
        trips: (localTrips.trips || []).map((t) => ({
          ...t,
          expenses: Array.isArray(t.expenses) ? [...t.expenses] : [],
        })),
      }
      : { trips: [], currentTripId: null };
    const picked = selectLocalExpenseList({
      tripExpenses: currentTripOf(base).expenses,
      cachedExpenses: Array.isArray(cachedExpenses) ? cachedExpenses : null,
      tripUpdatedAt: localTrips?.updatedAt,
      expensesUpdatedAt,
    });
    expenses = picked;
    const cur = currentTripOf(base);
    if (cur.trip) cur.trip.expenses = expenses;
    const stampMs = localTs != null ? localTs : now;
    const stamp = new Date(stampMs).toISOString();
    base.updatedAt = stamp;
    tripsData = base;
    writeJson(storage, tripsKey, tripsData);
    writeJson(storage, expensesKey, expenses);
    writeJson(storage, expensesAtKey, stamp);
    writeJson(storage, localAtKey, stamp);
  }

  const tripId = currentTripOf(tripsData).tripId;
  const undo = reconcileUndoState(readJson(storage, undoKey), expenses, tripId, now);
  if (undo) writeJson(storage, undoKey, undo);
  else storage.removeItem(undoKey);

  return { source, expenses, undo, tripId, tripsData };
}
