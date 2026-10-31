import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DataService, { KEYS } from './DataService';
import { recalculateExpensesForRates } from '../utils/recalculateExpensesForRates';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (k) => (bag.has(k) ? bag.get(k) : null),
    setItem: (k, v) => bag.set(k, String(v)),
    removeItem: (k) => bag.delete(k),
    clear: () => bag.clear(),
    key: (i) => [...bag.keys()][i] ?? null,
    get length() {
      return bag.size;
    },
  };
}

const TRIP_A = 'trip-settle-a';
const TRIP_B = 'trip-settle-b';

function seedTrips(settlementsA) {
  const blob = {
    currentTripId: TRIP_A,
    updatedAt: '2026-10-30T00:00:00.000Z',
    trips: [
      {
        id: TRIP_A,
        name: 'Tokyo',
        expenses: [
          { id: 'e1', hkdAmount: 100, currency: 'JPY', originalAmount: 2000, category: '飲食' },
        ],
        settings: { people: ['共同', 'Oscar', '阿明'] },
        ...(settlementsA !== undefined ? { settlements: settlementsA } : {}),
      },
      {
        id: TRIP_B,
        name: 'Osaka',
        expenses: [{ id: 'e2', hkdAmount: 50, assignedTo: '阿明', category: '交通' }],
        settings: { people: ['共同', 'Oscar', '阿明'] },
        settlements: [
          {
            id: 'stl-b1',
            tripId: TRIP_B,
            from: '阿明',
            to: 'Oscar',
            amount: 50,
            currency: 'HKD',
            hkdAmount: 50,
            rate: 1,
            date: '2026-10-20',
            note: '',
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
          },
        ],
      },
    ],
  };
  localStorage.setItem(KEYS.TRIPS, JSON.stringify(blob));
  localStorage.setItem(KEYS.EXPENSES, JSON.stringify(blob.trips[0].expenses));
  return blob;
}

let originalLocalStorage;

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage;
  globalThis.localStorage = memoryStorage();
  DataService.setStorageScope(null);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.localStorage = originalLocalStorage;
});

describe('DataService settlements CRUD', () => {
  it('addSettlement creates the array on first write and never invents [] on a missing field trip beforehand', () => {
    seedTrips(undefined);
    const before = DataService.loadTripsData().trips.find((t) => t.id === TRIP_A);
    expect(before.settlements).toBeUndefined();

    const row = DataService.addSettlement(TRIP_A, {
      from: '阿明',
      to: 'Oscar',
      amount: 300,
      currency: 'HKD',
      hkdAmount: 300,
      rate: 1,
      date: '2026-10-30',
      note: 'partial',
    });
    expect(row.id).toMatch(/^stl-\d+-[a-z0-9]+$/);
    expect(row.tripId).toBe(TRIP_A);
    expect(row.createdAt).toBe('2026-10-30T12:00:00.000Z');

    const after = DataService.loadTripsData().trips.find((t) => t.id === TRIP_A);
    expect(after.settlements).toHaveLength(1);
    expect(after.settlements[0]).toMatchObject({
      from: '阿明',
      to: 'Oscar',
      hkdAmount: 300,
      note: 'partial',
    });
  });

  it('updateSettlement patches fields and bumps updatedAt', () => {
    seedTrips([
      {
        id: 'stl-1',
        tripId: TRIP_A,
        from: '阿明',
        to: 'Oscar',
        amount: 100,
        currency: 'HKD',
        hkdAmount: 100,
        rate: 1,
        date: '2026-10-29',
        note: '',
        createdAt: '2026-10-29T00:00:00.000Z',
        updatedAt: '2026-10-29T00:00:00.000Z',
      },
    ]);
    vi.setSystemTime(new Date('2026-10-30T15:00:00.000Z'));
    const updated = DataService.updateSettlement(TRIP_A, 'stl-1', {
      amount: 250,
      hkdAmount: 250,
      note: 'more',
    });
    expect(updated).toMatchObject({
      id: 'stl-1',
      amount: 250,
      hkdAmount: 250,
      note: 'more',
      updatedAt: '2026-10-30T15:00:00.000Z',
      createdAt: '2026-10-29T00:00:00.000Z',
    });
  });

  it('removeSettlement drops the row; missing field stays missing when never written', () => {
    seedTrips(undefined);
    expect(DataService.removeSettlement(TRIP_A, 'nope')).toBe(false);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toBeUndefined();

    DataService.addSettlement(TRIP_A, {
      id: 'stl-x',
      from: '阿明',
      to: 'Oscar',
      amount: 10,
      currency: 'HKD',
      hkdAmount: 10,
      rate: 1,
      date: '2026-10-30',
    });
    expect(DataService.removeSettlement(TRIP_A, 'stl-x')).toBe(true);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual([]);
  });
});

describe('DataService person rename / delete maps settlements', () => {
  it('syncPersonNameInAllTrips renames settlement from/to across trips', () => {
    seedTrips([
      {
        id: 'stl-a1',
        tripId: TRIP_A,
        from: '阿明',
        to: 'Oscar',
        amount: 40,
        currency: 'HKD',
        hkdAmount: 40,
        rate: 1,
        date: '2026-10-21',
        note: '',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
      },
    ]);
    DataService.syncPersonNameInAllTrips('阿明', 'Ming');
    const data = DataService.loadTripsData();
    expect(data.trips.find((t) => t.id === TRIP_A).settlements[0]).toMatchObject({
      from: 'Ming',
      to: 'Oscar',
    });
    expect(data.trips.find((t) => t.id === TRIP_B).settlements[0]).toMatchObject({
      from: 'Ming',
      to: 'Oscar',
    });
    expect(data.trips.find((t) => t.id === TRIP_A).settings.people).toContain('Ming');
  });

  it('removePersonAndReassignAll remaps from/to and drops self-payments', () => {
    seedTrips([
      {
        id: 'stl-keep',
        tripId: TRIP_A,
        from: '阿明',
        to: 'Oscar',
        amount: 40,
        currency: 'HKD',
        hkdAmount: 40,
        rate: 1,
        date: '2026-10-21',
        note: '',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
      },
      {
        id: 'stl-drop',
        tripId: TRIP_A,
        from: 'Oscar',
        to: '阿明',
        amount: 10,
        currency: 'HKD',
        hkdAmount: 10,
        rate: 1,
        date: '2026-10-21',
        note: '',
        createdAt: '2026-10-21T00:00:00.000Z',
        updatedAt: '2026-10-21T00:00:00.000Z',
      },
    ]);
    // Reassign 阿明 → Oscar: stl-keep becomes Oscar→Oscar (drop); stl-drop becomes Oscar→Oscar (drop)
    // Wait: stl-keep from 阿明→Oscar becomes Oscar→Oscar drop; stl-drop from Oscar→阿明 becomes Oscar→Oscar drop
    // Use a third person for a keep case — add May first via patching seed
    const data0 = DataService.loadTripsData();
    const tripA = data0.trips.find((t) => t.id === TRIP_A);
    tripA.settings.people = ['共同', 'Oscar', '阿明', 'May'];
    tripA.settlements.push({
      id: 'stl-may',
      tripId: TRIP_A,
      from: '阿明',
      to: 'May',
      amount: 5,
      currency: 'HKD',
      hkdAmount: 5,
      rate: 1,
      date: '2026-10-21',
      note: '',
      createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z',
    });
    DataService.saveTripsData(data0);

    // TRIP_B also has 阿明→Oscar which collapses to Oscar→Oscar and is dropped.
    const result = DataService.removePersonAndReassignAll('阿明', 'Oscar');
    expect(result.droppedSettlements).toBe(3);
    const trip = DataService.loadTripsData().trips.find((t) => t.id === TRIP_A);
    expect(trip.settlements).toEqual([
      expect.objectContaining({ id: 'stl-may', from: 'Oscar', to: 'May', hkdAmount: 5 }),
    ]);
    expect(trip.settings.people).toEqual(['共同', 'Oscar', 'May']);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_B).settlements).toEqual([]);
  });
});

describe('classic write paths preserve settlements', () => {
  it('switchTrip / updateCurrentTripExpenses / patchTrip / reassign category / deleteTrip keep the array', () => {
    const settlements = [
      {
        id: 'stl-preserve',
        tripId: TRIP_A,
        from: '阿明',
        to: 'Oscar',
        amount: 77,
        currency: 'HKD',
        hkdAmount: 77,
        rate: 1,
        date: '2026-10-22',
        note: 'keep-me',
        createdAt: '2026-10-22T00:00:00.000Z',
        updatedAt: '2026-10-22T00:00:00.000Z',
      },
    ];
    seedTrips(settlements);

    DataService.updateCurrentTripExpenses([
      { id: 'e1', hkdAmount: 120, currency: 'JPY', originalAmount: 2400, category: '飲食' },
    ]);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);

    DataService.switchTrip(TRIP_B, DataService.loadExpenses());
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);

    DataService.patchTrip(TRIP_A, { name: 'Tokyo Renamed' });
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);

    DataService.reassignExpenseCategoryInAllTrips('飲食', '其他');
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);

    DataService.switchTrip(TRIP_A, DataService.loadExpenses());
    expect(DataService.deleteTrip(TRIP_B)).toBe(true);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);
  });
});

describe('rate refresh leaves settlement snapshots alone', () => {
  it('recalculateExpensesForRates only mutates expenses; trip.settlements hkdAmount stays', () => {
    const settlements = [
      {
        id: 'stl-rate',
        tripId: TRIP_A,
        from: '阿明',
        to: 'Oscar',
        amount: 2000,
        currency: 'JPY',
        hkdAmount: 100,
        rate: 20,
        date: '2026-10-22',
        note: '',
        createdAt: '2026-10-22T00:00:00.000Z',
        updatedAt: '2026-10-22T00:00:00.000Z',
      },
    ];
    seedTrips(settlements);
    const trip = DataService.loadTripsData().trips.find((t) => t.id === TRIP_A);
    const { expenses: updated, changed } = recalculateExpensesForRates(trip.expenses, { JPY: 25 });
    expect(changed).toBe(true);
    expect(updated[0].hkdAmount).toBe(80);
    // Settlements are not passed into the recompute helper — snapshot stays.
    expect(trip.settlements[0].hkdAmount).toBe(100);
    expect(trip.settlements[0].rate).toBe(20);
    DataService.updateCurrentTripExpenses(updated);
    expect(DataService.loadTripsData().trips.find((t) => t.id === TRIP_A).settlements).toEqual(settlements);
  });
});
