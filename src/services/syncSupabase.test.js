import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake Supabase: one user_app_data table shared by every "device".
const db = vi.hoisted(() => ({ rows: new Map(), upserts: [], selects: [], fail: null }));

vi.mock('../lib/supabaseClient', () => {
  const table = {
    select(columns) { this._columns = columns; return this; },
    eq(_col, val) { this._id = val; return this; },
    async maybeSingle() {
      db.selects.push(this._columns);
      if (db.fail === 'select') return { data: null, error: { message: 'Failed to fetch' } };
      const row = db.rows.get(this._id);
      if (!row) return { data: null, error: null };
      if (this._columns && this._columns !== '*') {
        // Head read: updated_at + trips_data->>updatedAt (PostgREST alias syntax).
        return {
          data: { updated_at: row.updated_at, trips_data_updated_at: row.trips_data?.updatedAt ?? null },
          error: null,
        };
      }
      return { data: structuredClone(row), error: null };
    },
    async upsert(payload) {
      if (db.fail === 'upsert') return { error: { message: 'Failed to fetch' } };
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
const T0 = '2026-10-28T10:00:00.000Z';
let originalLocalStorage;

/**
 * A device = its own localStorage + its own module instances (so its own
 * sync baseline and DataService scope). `run` swaps the global storage in
 * for the duration of one async call; calls are awaited one at a time.
 */
async function makeDevice() {
  vi.resetModules();
  const sync = await import('./syncSupabase');
  const { default: DataService } = await import('./DataService');
  const storage = memoryStorage();
  const run = async (fn) => {
    globalThis.localStorage = storage;
    try {
      return await fn({ sync, DataService });
    } finally {
      globalThis.localStorage = originalLocalStorage;
    }
  };
  return {
    run,
    boot: () => run(({ sync: s }) => s.bootstrapUserAppData(USER)),
    save: () => run(({ sync: s }) => s.persistUserAppData(USER)),
    pull: () => run(({ sync: s }) => s.pullUserAppData(USER)),
    /** Add an expense the way AppContext.setExpenses writes it. */
    addExpense: (exp) => run(({ DataService: ds }) => {
      ds.setStorageScope(USER);
      const next = [...ds.loadExpenses(), exp];
      ds.saveExpenses(next);
      ds.updateCurrentTripExpenses(next);
    }),
    expenseIds: () => run(({ DataService: ds }) => {
      ds.setStorageScope(USER);
      return ds.loadExpenses().map((e) => e.id);
    }),
  };
}

function seedRow() {
  db.rows.set(USER, {
    user_id: USER,
    trips_data: {
      trips: [{ id: 'trip-1', name: 'Tokyo', expenses: [{ id: 'base', amount: 100 }], settings: { people: ['共同'] } }],
      currentTripId: 'trip-1',
      updatedAt: T0,
    },
    app_settings: {},
    people_list: ['共同'],
    updated_at: T0,
    subscription_status: 'active',
    stripe_customer_id: 'cus_test',
    stripe_subscription_id: 'sub_test',
  });
}

const cloudExpenseIds = () => db.rows.get(USER).trips_data.trips[0].expenses.map((e) => e.id);

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(T0));
  db.rows.clear();
  db.upserts.length = 0;
  db.selects.length = 0;
  db.fail = null;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.localStorage = originalLocalStorage;
});

describe('persistUserAppData payload (migration 004 compatibility)', () => {
  it('never sends billing columns, so the 004 trigger cannot reject a normal save', async () => {
    seedRow();
    const a = await makeDevice();
    await a.boot();
    await a.save();
    const sent = db.upserts.at(-1);
    expect(Object.keys(sent).sort()).toEqual(
      ['app_settings', 'people_list', 'trips_data', 'updated_at', 'user_id'],
    );
    expect(db.rows.get(USER).subscription_status).toBe('active');
  });
});

describe('stale-overwrite guard: two devices, one cloud row', () => {
  it('a device that never refreshed does not overwrite the other device’s newer save', async () => {
    seedRow();
    const a = await makeDevice();
    const b = await makeDevice();
    await a.boot();
    await b.boot();

    vi.setSystemTime(new Date('2026-10-28T10:05:00.000Z'));
    await b.addExpense({ id: 'from-b', amount: 500 });
    expect(await b.save()).toEqual({ status: 'saved' });
    expect(cloudExpenseIds()).toEqual(['base', 'from-b']);

    // Device A flushes its (unchanged, older) cache: old code would upsert ['base'].
    vi.setSystemTime(new Date('2026-10-28T10:06:00.000Z'));
    const upsertsBefore = db.upserts.length;
    expect(await a.save()).toEqual({ status: 'remote-applied' });
    expect(db.upserts.length).toBe(upsertsBefore);
    expect(cloudExpenseIds()).toEqual(['base', 'from-b']);
    // ...and A's local cache now holds B's change, ready for AppContext to reload.
    expect(await a.expenseIds()).toEqual(['base', 'from-b']);

    // Next save from A is a normal save again (baseline moved forward).
    expect(await a.save()).toEqual({ status: 'saved' });
    expect(cloudExpenseIds()).toEqual(['base', 'from-b']);
  });

  it('focus pull brings in the other device’s change once, then reports no change', async () => {
    seedRow();
    const a = await makeDevice();
    const b = await makeDevice();
    await a.boot();
    await b.boot();

    vi.setSystemTime(new Date('2026-10-28T10:05:00.000Z'));
    await b.addExpense({ id: 'from-b', amount: 500 });
    await b.save();

    expect(await a.pull()).toEqual({ changed: true, source: 'remote' });
    expect(await a.expenseIds()).toEqual(['base', 'from-b']);
    expect(await a.pull()).toEqual({ changed: false });
  });

  it('a pull with nothing new leaves local edits alone', async () => {
    seedRow();
    const a = await makeDevice();
    await a.boot();
    vi.setSystemTime(new Date('2026-10-28T10:05:00.000Z'));
    await a.addExpense({ id: 'local-only', amount: 1 });
    expect(await a.pull()).toEqual({ changed: false });
    expect(await a.expenseIds()).toEqual(['base', 'local-only']);
  });

  it('when this device edited after the other device saved, newest wins: local is kept and uploaded', async () => {
    seedRow();
    const a = await makeDevice();
    const b = await makeDevice();
    await a.boot();
    await b.boot();

    vi.setSystemTime(new Date('2026-10-28T10:05:00.000Z'));
    await b.addExpense({ id: 'from-b', amount: 500 });
    await b.save();

    vi.setSystemTime(new Date('2026-10-28T10:07:00.000Z'));
    await a.addExpense({ id: 'from-a', amount: 700 });
    expect(await a.save()).toEqual({ status: 'local-kept' });
    expect(cloudExpenseIds()).toEqual(['base', 'from-a']);

    // B now sees A's newer blob on its next pull.
    expect(await b.pull()).toEqual({ changed: true, source: 'remote' });
    expect(await b.expenseIds()).toEqual(['base', 'from-a']);
  });

  it('back-to-back saves on one device never trip the guard on their own writes', async () => {
    seedRow();
    const a = await makeDevice();
    await a.boot();
    for (const [i, at] of ['10:01', '10:02', '10:03'].entries()) {
      vi.setSystemTime(new Date(`2026-10-28T${at}:00.000Z`));
      await a.addExpense({ id: `e${i}`, amount: i });
      expect(await a.save()).toEqual({ status: 'saved' });
    }
    expect(cloudExpenseIds()).toEqual(['base', 'e0', 'e1', 'e2']);
  });

  it('a user with no row seeds it on boot', async () => {
    const a = await makeDevice();
    expect(await a.boot()).toEqual({ source: 'seeded' });
    expect(db.rows.has(USER)).toBe(true);
    expect(await a.save()).toEqual({ status: 'saved' });
  });

  it('a failed head read surfaces as an error instead of a blind overwrite', async () => {
    seedRow();
    const a = await makeDevice();
    await a.boot();
    db.fail = 'select';
    const upsertsBefore = db.upserts.length;
    await expect(a.save()).rejects.toMatchObject({ message: 'Failed to fetch' });
    expect(db.upserts.length).toBe(upsertsBefore);
  });
});

describe('isRemoteNewer', () => {
  it('compares parsed timestamps and ignores unknown clocks', async () => {
    const { isRemoteNewer } = await import('./syncSupabase');
    const base = Date.parse(T0);
    expect(isRemoteNewer('2026-10-28T10:00:01.000Z', base)).toBe(true);
    expect(isRemoteNewer(T0, base)).toBe(false);
    expect(isRemoteNewer(null, base)).toBe(false);
    expect(isRemoteNewer(T0, null)).toBe(false);
  });
});
