import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake Supabase: one user_app_data table in memory, records every upsert.
const db = vi.hoisted(() => ({ rows: new Map(), upserts: [], selectError: null }));

vi.mock('../lib/supabaseClient', () => {
  const table = {
    select() { return this; },
    eq(_col, val) { this._id = val; return this; },
    async maybeSingle() {
      if (db.selectError) return { data: null, error: db.selectError };
      const row = db.rows.get(this._id);
      return { data: row ? structuredClone(row) : null, error: null };
    },
    async upsert(payload) {
      db.upserts.push(structuredClone(payload));
      const prev = db.rows.get(payload.user_id) || {};
      db.rows.set(payload.user_id, { ...prev, ...structuredClone(payload) });
      return { error: null };
    },
  };
  return { supabase: { from: () => Object.create(table) } };
});

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
    key: (i) => [...bag.keys()][i] ?? null,
    get length() { return bag.size; },
  };
}

const USER = 'user-sync-1';
let originalLocalStorage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  db.rows.clear();
  db.upserts.length = 0;
  db.selectError = null;
});

afterEach(async () => {
  const { default: DataService } = await import('./DataService');
  DataService.setStorageScope(null);
  globalThis.localStorage = originalLocalStorage;
});

describe('persistUserAppData payload (migration 004 compatibility)', () => {
  it('never sends billing columns, so the 004 trigger cannot reject a normal save', async () => {
    const { bootstrapUserAppData, persistUserAppData } = await import('./syncSupabase');
    db.rows.set(USER, {
      user_id: USER,
      trips_data: { trips: [], currentTripId: null, updatedAt: '2026-10-01T00:00:00.000Z' },
      app_settings: {},
      people_list: [],
      updated_at: '2026-10-01T00:00:00.000Z',
      subscription_status: 'active',
      stripe_customer_id: 'cus_test',
      stripe_subscription_id: 'sub_test',
    });
    await bootstrapUserAppData(USER);
    await persistUserAppData(USER);
    const sent = db.upserts.at(-1);
    expect(Object.keys(sent).sort()).toEqual(
      ['app_settings', 'people_list', 'trips_data', 'updated_at', 'user_id'],
    );
    expect(db.rows.get(USER).subscription_status).toBe('active');
  });
});
