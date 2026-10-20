import { describe, it, expect } from 'vitest';
import { KEYS, scopedLocalStorageKey } from '../services/DataService';
import { createUndoState } from './duplicateDecisions';
import { mergeRemoteWithLocalStorage, replaceUndoStorageKey } from './persistMerge';

/**
 * c7395ce `bootstrapUserAppData` copied the remote user_app_data row into
 * localStorage whenever the row existed (no timestamp compare) and left
 * `travel_replace_undo:*` untouched.
 * Fails on that logic:
 *   (a) source === 'local' and stored expenses stay [10] (undo for addedId 10 kept).
 *       The unconditional overwrite stores remote id 1 instead.
 *   (c) the undo key is removed when addedId 10 is absent from the chosen list.
 *       The old bootstrap never dropped that key.
 * (b), (d), and (e) also hold for an unconditional overwrite when remote is the
 * intended winner or there is no row; they lock the other branches.
 */

const USER = 'user-1';
const TRIP = 'trip-1';
const NOW = Date.parse('2026-10-19T02:00:00.000Z');
const OLDER = '2026-10-19T01:00:00.000Z';
const NEWER = '2026-10-19T03:00:00.000Z';
const ROW_CLOCK = '2026-10-19T04:00:00.000Z';

const oldRec = { id: 1, editedAt: 5, store: '羅森', originalAmount: 1080 };
const replaced = { id: 10, store: '羅森', originalAmount: 1080 };

function memoryStorage() {
  const bag = new Map();
  return {
    getItem(key) {
      return bag.has(key) ? bag.get(key) : null;
    },
    setItem(key, value) {
      bag.set(key, String(value));
    },
    removeItem(key) {
      bag.delete(key);
    },
  };
}

function tripsBlob(expenses, updatedAt) {
  const blob = { currentTripId: TRIP, trips: [{ id: TRIP, expenses }] };
  if (updatedAt !== undefined) blob.updatedAt = updatedAt;
  return blob;
}

function undo(addedId, removed) {
  return createUndoState([{ addedId, removed }], TRIP, NOW);
}

function locKeys() {
  return {
    trips: scopedLocalStorageKey(USER, KEYS.TRIPS),
    expenses: scopedLocalStorageKey(USER, KEYS.EXPENSES),
    expensesAt: scopedLocalStorageKey(USER, KEYS.EXPENSES_UPDATED_AT),
    localAt: scopedLocalStorageKey(USER, KEYS.LOCAL_UPDATED_AT),
    undo: replaceUndoStorageKey(USER),
  };
}

function put(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function read(storage, key) {
  const raw = storage.getItem(key);
  return raw == null ? null : JSON.parse(raw);
}

function expenseIds(storage, keys) {
  return read(storage, keys.trips).trips[0].expenses.map((e) => e.id);
}

describe('mergeRemoteWithLocalStorage', () => {
  it('(a) older remote blob + newer local replace keeps the local list and undo', () => {
    const storage = memoryStorage();
    const keys = locKeys();
    put(storage, keys.trips, tripsBlob([replaced], NEWER));
    put(storage, keys.expenses, [replaced]);
    put(storage, keys.expensesAt, NEWER);
    put(storage, keys.localAt, NEWER);
    put(storage, keys.undo, undo(10, oldRec));

    // Stale upsert: row clock is newer than local, payload updatedAt is older.
    const remoteRow = {
      trips_data: tripsBlob([oldRec], OLDER),
      updated_at: ROW_CLOCK,
      app_settings: { plan: 'free' },
      people_list: [],
    };

    const result = mergeRemoteWithLocalStorage(storage, USER, remoteRow, NOW);

    expect(result.source).toBe('local');
    expect(result.expenses.map((e) => e.id)).toEqual([10]);
    expect(expenseIds(storage, keys)).toEqual([10]);
    expect(result.undo.entries.map((e) => e.addedId)).toEqual([10]);
    expect(read(storage, keys.undo).entries[0].addedId).toBe(10);
  });

  it('(b) newer remote blob wins', () => {
    const storage = memoryStorage();
    const keys = locKeys();
    const remoteOnly = { id: 99, store: 'remote' };
    put(storage, keys.trips, tripsBlob([replaced], OLDER));
    put(storage, keys.expenses, [replaced]);
    put(storage, keys.expensesAt, OLDER);
    put(storage, keys.localAt, OLDER);

    const remoteRow = {
      trips_data: tripsBlob([remoteOnly], NEWER),
      updated_at: NEWER,
    };

    const result = mergeRemoteWithLocalStorage(storage, USER, remoteRow, NOW);

    expect(result.source).toBe('remote');
    expect(result.expenses.map((e) => e.id)).toEqual([99]);
    expect(expenseIds(storage, keys)).toEqual([99]);
  });

  it('(c) drops an undo entry whose replacement is absent from the chosen list', () => {
    const storage = memoryStorage();
    const keys = locKeys();
    // Local is newer, so it is chosen, but it still has the pre-replace record.
    // Remote (older) still contains id 10; that must not keep the undo alive.
    put(storage, keys.trips, tripsBlob([oldRec], NEWER));
    put(storage, keys.expenses, [oldRec]);
    put(storage, keys.expensesAt, NEWER);
    put(storage, keys.localAt, NEWER);
    put(storage, keys.undo, undo(10, oldRec));

    const remoteRow = {
      trips_data: tripsBlob([replaced], OLDER),
      updated_at: OLDER,
    };

    const result = mergeRemoteWithLocalStorage(storage, USER, remoteRow, NOW);

    expect(result.source).toBe('local');
    expect(result.expenses.map((e) => e.id)).toEqual([1]);
    expect(result.undo).toBeNull();
    expect(storage.getItem(keys.undo)).toBeNull();
  });

  it('(d) legacy local without timestamps lets the remote row win', () => {
    const storage = memoryStorage();
    const keys = locKeys();
    put(storage, keys.trips, tripsBlob([replaced]));
    put(storage, keys.expenses, [replaced]);

    const remoteRow = {
      trips_data: tripsBlob([oldRec], OLDER),
      updated_at: OLDER,
    };

    const result = mergeRemoteWithLocalStorage(storage, USER, remoteRow, NOW);

    expect(result.source).toBe('remote');
    expect(result.expenses.map((e) => e.id)).toEqual([1]);
    expect(expenseIds(storage, keys)).toEqual([1]);
  });

  it('(e) keeps local data when there is no remote row', () => {
    const storage = memoryStorage();
    const keys = locKeys();
    put(storage, keys.trips, tripsBlob([replaced], NEWER));
    put(storage, keys.expenses, [replaced]);
    put(storage, keys.expensesAt, NEWER);
    put(storage, keys.localAt, NEWER);
    put(storage, keys.undo, undo(10, oldRec));

    const result = mergeRemoteWithLocalStorage(storage, USER, null, NOW);

    expect(result.source).toBe('local');
    expect(result.expenses.map((e) => e.id)).toEqual([10]);
    expect(expenseIds(storage, keys)).toEqual([10]);
    expect(result.undo.entries[0].addedId).toBe(10);
    expect(read(storage, keys.undo).entries[0].addedId).toBe(10);
  });
});
