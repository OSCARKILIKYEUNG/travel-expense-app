import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import DataService from '../services/DataService';
import {
  deriveEndDate,
  ensureTripDays,
  ensureTripShape,
  fromRefExpense,
  normalizeExpenseTime,
  normalizePayment,
  toRefExpense,
  toRefTrip,
} from './refDataAdapter';

describe('refDataAdapter — normalizePayment', () => {
  it('normalizes cash variants to "cash"', () => {
    expect(normalizePayment('cash')).toBe('cash');
    expect(normalizePayment('CASH')).toBe('cash');
    expect(normalizePayment(' 現金 ')).toBe('cash');
    expect(normalizePayment('现金')).toBe('cash');
    expect(normalizePayment('現鈔')).toBe('cash');
    expect(normalizePayment('日圓現金')).toBe('cash');
    expect(normalizePayment('お預り')).toBe('cash');
  });

  it('normalizes card/credit/debit variants to "card"', () => {
    expect(normalizePayment('card')).toBe('card');
    expect(normalizePayment('CARD')).toBe('card');
    expect(normalizePayment('卡')).toBe('card');
    expect(normalizePayment('信用卡')).toBe('card');
    expect(normalizePayment('刷卡')).toBe('card');
    expect(normalizePayment('credit')).toBe('card');
    expect(normalizePayment('Credit Card')).toBe('card');
    expect(normalizePayment('debit')).toBe('card');
    expect(normalizePayment('VISA')).toBe('card');
    expect(normalizePayment('Mastercard')).toBe('card');
    expect(normalizePayment('JCB')).toBe('card');
    expect(normalizePayment('AMEX')).toBe('card');
    expect(normalizePayment('Suica')).toBe('card');
    expect(normalizePayment('クレジットカード')).toBe('card');
  });

  it('returns empty string for unknown, cashless-unspecified, or non-string values', () => {
    expect(normalizePayment('')).toBe('');
    expect(normalizePayment('   ')).toBe('');
    expect(normalizePayment('unknown')).toBe('');
    expect(normalizePayment('未知')).toBe('');
    expect(normalizePayment('其他')).toBe('');
    expect(normalizePayment('cashless')).toBe('');
    expect(normalizePayment('cashless card')).toBe('card');
    expect(normalizePayment(null)).toBe('');
    expect(normalizePayment(undefined)).toBe('');
    expect(normalizePayment(123)).toBe('');
    expect(normalizePayment(true)).toBe('');
  });
});

describe('refDataAdapter — normalizeExpenseTime', () => {
  it('extracts valid HH:MM from time or receiptTime using parseHHMM rules', () => {
    expect(normalizeExpenseTime({ time: '9:5' })).toBe('09:05');
    expect(normalizeExpenseTime({ time: '14:30' })).toBe('14:30');
    expect(normalizeExpenseTime({ receiptTime: '8:05' })).toBe('08:05');
    expect(normalizeExpenseTime({ time: '09:15', receiptTime: '18:00' })).toBe('09:15');
    expect(normalizeExpenseTime({ time: '', receiptTime: '18:00' })).toBe('18:00');
    expect(normalizeExpenseTime({ time: '25:00', receiptTime: '18:00' })).toBe('18:00');
    expect(normalizeExpenseTime('7:30')).toBe('07:30');
  });

  it('returns empty string for invalid or missing times', () => {
    expect(normalizeExpenseTime({ time: '09:15:0030' })).toBe('');
    expect(normalizeExpenseTime({ time: '24:00' })).toBe('');
    expect(normalizeExpenseTime({ time: '12:60' })).toBe('');
    expect(normalizeExpenseTime({ time: 'abc' })).toBe('');
    expect(normalizeExpenseTime({})).toBe('');
    expect(normalizeExpenseTime(null)).toBe('');
    expect(normalizeExpenseTime(undefined)).toBe('');
  });
});

describe('refDataAdapter — toRefExpense & fromRefExpense round-trip', () => {
  const legacyAiExpense = {
    id: 1729650000123,
    date: '2026年10月22日',
    store: '松本清 淺草店',
    storeOriginal: 'マツモトキヨシ 浅草店',
    storeEn: 'Matsumoto Kiyoshi Asakusa',
    location: '淺草',
    locationEn: 'Asakusa',
    category: '購物',
    assignedTo: '共同',
    currency: 'JPY',
    originalAmount: 5400,
    hkdAmount: 280.81,
    rate: 19.23,
    subtotal: 5940,
    tax: 0,
    taxRefund: -540,
    discount: -100,
    paymentMethod: '信用卡',
    receiptTime: '9:45',
    receiptType: 'instant_tax_free',
    receiptTaxExemptionAmount: 540,
    hasBundlePricing: true,
    needsReview: false,
    currencyMismatch: false,
    aiDetectedMarket: 'JP',
    aiMarketEvidence: ['免税', '￥'],
    sourceHash: 'deadbeef0123456789abcdef',
    items: [
      {
        name: '感冒藥',
        originalName: 'パブロン',
        nameEn: 'Pabron',
        price: 1980,
        priceActual: 1800,
        assignedTo: 'Oscar',
      },
    ],
  };

  it('maps a legacy AI expense to ref view-model without dropping fields or changing date format', () => {
    const ref = toRefExpense(legacyAiExpense);
    expect(ref.id).toBe(1729650000123);
    expect(ref.date).toBe('2026年10月22日');
    expect(ref.place).toBe('淺草');
    expect(ref.location).toBe('淺草');
    expect(ref.payment).toBe('card');
    expect(ref.payer).toBe('');
    expect(ref.time).toBe('09:45');
    expect(ref.scanned).toBe(true);
    expect(ref.sourceHash).toBe('deadbeef0123456789abcdef');
    expect(ref.items).toHaveLength(1);
    expect(ref.taxRefund).toBe(-540);
  });

  it('preserves sourceHash, items, taxRefund, and AI fields on legacy -> toRef -> fromRef round-trip', () => {
    const ref = toRefExpense(legacyAiExpense);
    const persisted = fromRefExpense(ref, { existing: legacyAiExpense });

    expect(persisted.id).toBe(legacyAiExpense.id);
    expect(persisted.date).toBe('2026年10月22日');
    expect(persisted.store).toBe('松本清 淺草店');
    expect(persisted.location).toBe('淺草');
    expect(persisted.place).toBe('淺草');
    expect(persisted.payment).toBe('card');
    expect(persisted.paymentMethod).toBe('card');
    expect(persisted.payer).toBe('');
    expect(persisted.time).toBe('09:45');
    expect(persisted.originalAmount).toBe(5400);
    expect(persisted.hkdAmount).toBe(280.81);
    expect(persisted.rate).toBe(19.23);
    expect(persisted.subtotal).toBe(5940);
    expect(persisted.tax).toBe(0);
    expect(persisted.taxRefund).toBe(-540);
    expect(persisted.discount).toBe(-100);
    expect(persisted.sourceHash).toBe('deadbeef0123456789abcdef');
    expect(persisted.receiptType).toBe('instant_tax_free');
    expect(persisted.receiptTaxExemptionAmount).toBe(540);
    expect(persisted.hasBundlePricing).toBe(true);
    expect(persisted.aiDetectedMarket).toBe('JP');
    expect(persisted.aiMarketEvidence).toEqual(['免税', '￥']);
    expect(persisted.storeOriginal).toBe('マツモトキヨシ 浅草店');
    expect(persisted.storeEn).toBe('Matsumoto Kiyoshi Asakusa');
    expect(persisted.locationEn).toBe('Asakusa');
    expect(persisted.items).toEqual(legacyAiExpense.items);
  });

  it('applies AddForm edits (place, payment, payer, time) while keeping existing AI fields', () => {
    const ref = toRefExpense(legacyAiExpense);
    const formPayload = {
      ...ref,
      store: '  松本清 雷門店  ',
      place: '雷門',
      payment: 'cash',
      payer: 'Oscar',
      time: '11:05',
      amount: '5400',
      subtotal: '',
      tax: '',
    };

    const saved = fromRefExpense(formPayload, { existing: legacyAiExpense });
    expect(saved.store).toBe('松本清 雷門店');
    expect(saved.place).toBe('雷門');
    expect(saved.location).toBe('雷門');
    expect(saved.payment).toBe('cash');
    expect(saved.paymentMethod).toBe('cash');
    expect(saved.payer).toBe('Oscar');
    expect(saved.time).toBe('11:05');
    expect(saved.subtotal).toBe(5940);
    expect(saved.tax).toBe(0);
    expect(saved.taxRefund).toBe(-540);
    expect(saved.sourceHash).toBe('deadbeef0123456789abcdef');
    expect(saved.items).toEqual(legacyAiExpense.items);
    expect('amount' in saved).toBe(false);
  });

  it('allows clearing time on an expense that previously had receiptTime', () => {
    const ref = toRefExpense(legacyAiExpense);
    const cleared = fromRefExpense({ ...ref, time: '' }, { existing: legacyAiExpense });
    expect(cleared.time).toBe('');
  });
});

describe('refDataAdapter — ensureTripShape, deriveEndDate, toRefTrip', () => {
  it('ensureTripShape (and ensureTripDays) fills missing defaults non-destructively', () => {
    expect(ensureTripDays).toBe(ensureTripShape);

    const rawTrip = {
      id: 'trip-1',
      name: '東京之旅',
      startDate: '2026-10-18',
      tripCurrency: 'JPY',
    };
    const shaped = ensureTripShape(rawTrip);

    expect(rawTrip.settings).toBeUndefined();
    expect(rawTrip.days).toBeUndefined();
    expect(shaped.id).toBe('trip-1');
    expect(shaped.endDate).toBeNull();
    expect(shaped.days).toEqual({});
    expect(shaped.expenses).toEqual([]);
    expect(shaped.settings).toEqual({
      people: ['共同'],
      budget: null,
    });
  });

  it('deriveEndDate returns valid endDate or max of startDate and expense dates', () => {
    expect(
      deriveEndDate({
        startDate: '2026-10-18',
        endDate: '2026-10-27',
        expenses: [{ date: '2026-10-20' }],
      }),
    ).toBe('2026-10-27');

    expect(
      deriveEndDate({
        startDate: '2026-10-18',
        endDate: null,
        expenses: [
          { date: '2026年10月22日' },
          { date: '2026-10-19' },
          { date: '' },
        ],
      }),
    ).toBe('2026-10-22');

    expect(
      deriveEndDate({
        startDate: '2026-10-18',
        expenses: [{ date: '2026-10-12' }],
      }),
    ).toBe('2026-10-18');

    expect(deriveEndDate({ startDate: '2026-10-18', expenses: [] })).toBe('2026-10-18');
    expect(deriveEndDate({ expenses: [] })).toBeNull();
    expect(deriveEndDate(null)).toBeNull();
  });

  it('toRefTrip builds view model with shaped trip, mapped expenses, derived endDate, and optional people', () => {
    const realTrip = {
      id: 'trip-real',
      name: '北海道冬日',
      startDate: '2026-12-01',
      expenses: [
        {
          id: 101,
          date: '2026年12月5日',
          store: 'JR 北海道',
          location: '札幌',
          paymentMethod: '現金',
          receiptTime: '8:15',
          originalAmount: 4500,
          hkdAmount: 234,
        },
      ],
    };

    const view = toRefTrip(realTrip, { people: ['共同', 'Oscar', '阿明'] });
    expect(view.endDate).toBe('2026-12-05');
    expect(view.days).toEqual({});
    expect(view.settings.people).toEqual(['共同', 'Oscar', '阿明']);
    expect(view.settings.budget).toBeNull();
    expect(view.expenses).toHaveLength(1);
    expect(view.expenses[0]).toMatchObject({
      id: 101,
      date: '2026年12月5日',
      place: '札幌',
      location: '札幌',
      payment: 'cash',
      time: '08:15',
    });
  });
});

describe('DataService.patchTrip — notebook fields persistence', () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    };
    DataService.setStorageScope('test-user-p0');
  });

  afterEach(() => {
    DataService.setStorageScope(null);
    globalThis.localStorage = originalLocalStorage;
  });

  it('persists endDate, days (replacing days object), lastPayment, and settings.budget without wiping people', () => {
    const initial = DataService.loadTripsData();
    const tripId = initial.currentTripId;
    const originalPeople = [...initial.trips[0].settings.people];
    expect(originalPeople.length).toBeGreaterThan(1);

    const daysV1 = {
      '2026-10-18': {
        title: '抵達東京',
        note: '成田',
        sticker: 'plane',
        journal: '順利降落',
        itinerary: [{ id: 's1', time: '15:10', title: 'Skyliner', done: false }],
      },
      '2026-10-19': {
        title: '淺草',
        note: '淺草',
        sticker: null,
        journal: '',
        itinerary: [],
      },
    };

    const ok1 = DataService.patchTrip(tripId, {
      endDate: '2026-10-27',
      days: daysV1,
      lastPayment: 'card',
      settings: { budget: 15000 },
    });
    expect(ok1).toBe(true);

    const after1 = DataService.getCurrentTrip(DataService.loadTripsData());
    expect(after1.endDate).toBe('2026-10-27');
    expect(after1.days).toEqual(daysV1);
    expect(after1.lastPayment).toBe('card');
    expect(after1.settings.budget).toBe(15000);
    expect(after1.settings.people).toEqual(originalPeople);

    // Replace days object with updated single-day map and clear budget without wiping people
    const daysV2 = {
      '2026-10-18': {
        ...daysV1['2026-10-18'],
        title: '抵達東京・晴空塔',
      },
    };
    const ok2 = DataService.patchTrip(tripId, {
      days: daysV2,
      lastPayment: 'cash',
      settings: { budget: null },
    });
    expect(ok2).toBe(true);

    const after2 = DataService.getCurrentTrip(DataService.loadTripsData());
    expect(after2.days).toEqual(daysV2);
    expect(after2.days['2026-10-19']).toBeUndefined();
    expect(after2.lastPayment).toBe('cash');
    expect(after2.settings.budget).toBeNull();
    expect(after2.settings.people).toEqual(originalPeople);
  });
});
