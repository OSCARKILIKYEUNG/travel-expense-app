import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import NotebookApp from './NotebookApp';
import {
  DEFAULT_REF_RATE,
  adaptTripForNotebook,
  foreignPerHomeToRefRate,
  mergeDayPatch,
  preparePersistedExpense,
  refRateToForeignPerHome,
  resolveTripRate,
  tripRate,
} from './tripRate';

describe('tripRate — exchange rate conversions', () => {
  it('converts foreign-per-home store rates into 1-foreign-to-home ref rates', () => {
    expect(foreignPerHomeToRefRate(20)).toBeCloseTo(0.05, 6);
    expect(foreignPerHomeToRefRate(19.23)).toBeCloseTo(1 / 19.23, 8);
    expect(foreignPerHomeToRefRate(0)).toBe(DEFAULT_REF_RATE);
    expect(foreignPerHomeToRefRate(-5)).toBe(DEFAULT_REF_RATE);
    expect(foreignPerHomeToRefRate(null)).toBe(DEFAULT_REF_RATE);
    expect(foreignPerHomeToRefRate('abc', 0.05)).toBe(0.05);
  });

  it('converts ref rate back into store foreign-per-home rate', () => {
    expect(refRateToForeignPerHome(0.05)).toBeCloseTo(20, 6);
    expect(refRateToForeignPerHome('0.0526')).toBeCloseTo(1 / 0.0526, 6);
    expect(refRateToForeignPerHome(0)).toBeNull();
    expect(refRateToForeignPerHome('')).toBeNull();
    expect(refRateToForeignPerHome(null)).toBeNull();
  });

  it('resolves tripRate from exchangeRates[tripCurrency] matching classic toHome math', () => {
    expect(resolveTripRate).toBe(tripRate);

    const realTrip = {
      id: 'trip-1',
      tripCurrency: 'JPY',
      accountingCurrency: 'HKD',
      exchangeRates: { HKD: 1, JPY: 19.23 },
    };
    const rate = tripRate(realTrip);
    expect(rate).toBeCloseTo(1 / 19.23, 8);
    // 10,000 JPY * rate matches classic 10,000 / 19.23
    expect(Math.round(10000 * rate)).toBe(Math.round(10000 / 19.23));
  });

  it('preserves clean user-entered settings.rate when consistent with exchangeRates or on mock trips', () => {
    const mockTrip = createRefTrip();
    expect(tripRate(mockTrip)).toBe(0.0526);

    const syncedTrip = {
      tripCurrency: 'JPY',
      accountingCurrency: 'HKD',
      exchangeRates: { HKD: 1, JPY: 1 / 0.0526 },
      settings: { rate: 0.0526 },
    };
    expect(tripRate(syncedTrip)).toBe(0.0526);
  });

  it('returns 1 when tripCurrency equals accountingCurrency and falls back when rates are missing', () => {
    expect(
      tripRate({
        tripCurrency: 'HKD',
        accountingCurrency: 'HKD',
        exchangeRates: { HKD: 1 },
      }),
    ).toBe(1);

    expect(tripRate({})).toBe(DEFAULT_REF_RATE);
    expect(tripRate(null)).toBe(DEFAULT_REF_RATE);
  });
});

describe('mergeDayPatch — trip.days updater', () => {
  it('populates default day fields and merges patch into full nextDays map', () => {
    const days1 = mergeDayPatch(undefined, '2026-10-22', {
      title: '富士山一日遊',
      note: '富士',
    });
    expect(days1['2026-10-22']).toEqual({
      title: '富士山一日遊',
      note: '富士',
      sticker: null,
      journal: '',
      itinerary: [],
    });

    const days2 = mergeDayPatch(days1, '2026-10-22', {
      sticker: 'fuji',
      journal: '天氣晴朗',
    });
    expect(days2['2026-10-22']).toEqual({
      title: '富士山一日遊',
      note: '富士',
      sticker: 'fuji',
      journal: '天氣晴朗',
      itinerary: [],
    });
  });
});

describe('preparePersistedExpense — classic & notebook write compatibility', () => {
  it('formats ISO date into classic zh display date and computes hkdAmount from exchangeRates', () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    const { record, refRecord, isEdit, lastPayment } = preparePersistedExpense(
      {
        currency: 'JPY',
        originalAmount: 1923,
        store: '一蘭拉麵',
        place: '淺草',
        category: '飲食',
        assignedTo: 'Oscar',
        payer: 'Oscar',
        payment: 'cash',
        date: '2026-10-22',
        time: '13:05',
      },
      {
        tripCurrency: 'JPY',
        exchangeRates: { HKD: 1, JPY: 19.23 },
        now,
      },
    );

    expect(isEdit).toBe(false);
    expect(lastPayment).toBe('cash');
    expect(record.date).toBe('2026年10月22日');
    expect(record.store).toBe('一蘭拉麵');
    expect(record.location).toBe('淺草');
    expect(record.place).toBe('淺草');
    expect(record.payment).toBe('cash');
    expect(record.paymentMethod).toBe('cash');
    expect(record.payer).toBe('Oscar');
    expect(record.time).toBe('13:05');
    expect(record.hkdAmount).toBeCloseTo(100, 5);
    expect(record.rate).toBe(19.23);
    expect(refRecord.place).toBe('淺草');
    expect(refRecord.payment).toBe('cash');
  });

  it('preserves numeric id and AI fields when editing an existing expense', () => {
    const existing = {
      id: 1729650000999,
      date: '2026年10月21日',
      store: '澀谷 PARCO',
      location: '澀谷',
      category: '購物',
      assignedTo: '共同',
      currency: 'JPY',
      originalAmount: 10000,
      hkdAmount: 520,
      rate: 19.23,
      sourceHash: 'abc123hash',
      items: [{ name: '外套', price: 10000, assignedTo: 'Oscar' }],
      createdAt: '2026-10-21T10:00:00.000Z',
    };

    const { record, isEdit, lastPayment } = preparePersistedExpense(
      {
        id: '1729650000999', // string from route hash
        date: '2026-10-21',
        store: '澀谷 PARCO 本館',
        place: '澀谷',
        payment: 'card',
        payer: 'Oscar',
        time: '17:30',
        originalAmount: 10000,
      },
      {
        existing,
        tripCurrency: 'JPY',
        exchangeRates: { HKD: 1, JPY: 20 },
      },
    );

    expect(isEdit).toBe(true);
    expect(record.id).toBe(1729650000999);
    expect(typeof record.id).toBe('number');
    expect(record.store).toBe('澀谷 PARCO 本館');
    expect(record.date).toBe('2026年10月21日');
    expect(record.sourceHash).toBe('abc123hash');
    expect(record.items).toEqual(existing.items);
    expect(record.createdAt).toBe('2026-10-21T10:00:00.000Z');
    expect(record.hkdAmount).toBe(500);
    expect(lastPayment).toBe('card');
  });

  it('merges scanBase on a new scanned draft: preserves items/sourceHash/AI fields, user-edited amount/category win, and isEdit is false', () => {
    const scanBase = {
      id: 1729650000888,
      date: '2026年10月22日',
      store: 'ローソン 河口湖駅前店',
      storeOriginal: 'ローソン 河口湖駅前店',
      storeEn: 'LAWSON Kawaguchiko Station',
      location: '河口湖',
      locationEn: 'Kawaguchiko',
      category: '飲食',
      assignedTo: '共同',
      currency: 'JPY',
      originalAmount: 1680,
      hkdAmount: 88.42,
      rate: 19,
      subtotal: 1680,
      tax: 124,
      taxRefund: 0,
      discount: 0,
      paymentMethod: '現金',
      receiptType: 'tax_inclusive',
      aiDetectedMarket: 'JP',
      aiMarketEvidence: ['￥', '内消費税'],
      sourceHash: 'deadbeefcafebabe1234567890',
      items: [
        { name: '炸雞塊', originalName: 'からあげクン', nameEn: 'Karaage-kun', price: 248 },
        { name: '幕之內便當', originalName: '幕の内弁当', nameEn: 'Makunouchi Bento', price: 1432 },
      ],
    };

    const now = new Date('2026-10-22T13:10:00.000Z');
    const { record, refRecord, isEdit, lastPayment } = preparePersistedExpense(
      {
        currency: 'JPY',
        amount: '2100',
        originalAmount: 2100,
        store: 'ローソン 河口湖駅前店',
        place: '河口湖站',
        category: '購物',
        assignedTo: 'Oscar',
        payer: 'Oscar',
        payment: 'card',
        date: '2026-10-22',
        time: '13:05',
        subtotal: '',
        tax: '',
        taxRefund: '',
        discount: '',
        note: '買手信同零食',
        scanned: true,
      },
      {
        scanBase,
        tripCurrency: 'JPY',
        exchangeRates: { HKD: 1, JPY: 21 },
        now,
      },
    );

    expect(isEdit).toBe(false);
    expect(lastPayment).toBe('card');
    expect(record.id).toBe(`exp-${now.getTime()}`);
    expect(record.createdAt).toBe('2026-10-22T13:10:00.000Z');
    expect(record.originalAmount).toBe(2100);
    expect(record.hkdAmount).toBe(100);
    expect(record.category).toBe('購物');
    expect(record.place).toBe('河口湖站');
    expect(record.location).toBe('河口湖站');
    expect(record.payer).toBe('Oscar');
    expect(record.payment).toBe('card');
    expect(record.paymentMethod).toBe('card');
    expect(record.assignedTo).toBe('Oscar');
    expect(record.time).toBe('13:05');
    expect(record.scanned).toBe(true);
    // Preserved AI fields from scanBase
    expect(record.items).toEqual(scanBase.items);
    expect(record.items[0].nameEn).toBe('Karaage-kun');
    expect(record.sourceHash).toBe('deadbeefcafebabe1234567890');
    expect(record.aiDetectedMarket).toBe('JP');
    expect(record.receiptType).toBe('tax_inclusive');
    expect(record.storeEn).toBe('LAWSON Kawaguchiko Station');
    expect(record.locationEn).toBe('Kawaguchiko');
    expect(record.subtotal).toBe(1680);
    expect(record.tax).toBe(124);
    expect(refRecord.scanned).toBe(true);
    expect(refRecord.items).toHaveLength(2);
  });
});

describe('adaptTripForNotebook & NotebookApp smoke render', () => {
  it('guarantees usable startDate and endDate even when real trip has missing endDate', () => {
    const minimalRealTrip = {
      id: 'trip-default',
      name: '我的第一個旅程',
      startDate: '2026-10-23',
      expenses: [],
    };
    const adapted = adaptTripForNotebook(minimalRealTrip, {
      people: ['共同', 'Oscar'],
      exchangeRates: { HKD: 1, JPY: 19.23 },
      today: '2026-10-23',
    });

    expect(adapted.startDate).toBe('2026-10-23');
    expect(adapted.endDate).toBe('2026-10-23');
    expect(adapted.settings.people).toEqual(['共同', 'Oscar']);
    expect(adapted.settings.rate).toBeCloseTo(1 / 19.23, 8);
  });

  it('renders Home via NotebookApp with createRefTrip() containing data-testid="home"', () => {
    const trip = createRefTrip();
    const html = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22' }),
    );
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('data-testid="summary"');
    expect(html).toContain('data-testid="calendar"');
    expect(html).toContain('data-testid="nav"');
    expect(html).toContain('東京秋日之旅');
    expect(html).toContain('HKD $11,222');
  });

  it('renders Home via NotebookApp in uncontrolled mock preview mode (?proto=notebook)', () => {
    const html = renderToStaticMarkup(createElement(NotebookApp, { today: '2026-10-22' }));
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('data-testid="trip-switcher"');
  });

  it('renders Day, Ledger, Charts, Add, and Settings routes via NotebookApp initialHash', () => {
    const trip = createRefTrip();
    const dayHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#day=2026-10-22' }),
    );
    expect(dayHtml).toContain('data-testid="day-view"');

    const ledgerHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#ledger' }),
    );
    expect(ledgerHtml).toContain('data-testid="ledger"');

    const chartsHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#charts' }),
    );
    expect(chartsHtml).toContain('data-testid="page-charts"');

    const addHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#add&date=2026-10-22' }),
    );
    expect(addHtml).toContain('data-testid="expense-form"');

    const settingsHtml = renderToStaticMarkup(
      createElement(NotebookApp, { trip, today: '2026-10-22', initialHash: '#settings' }),
    );
    expect(settingsHtml).toContain('data-testid="page-settings"');
  });

  it('renders Home safely even when given an empty trip with no startDate or endDate', () => {
    const html = renderToStaticMarkup(
      createElement(NotebookApp, { trip: { id: 'empty-1', name: '空白旅程' }, today: '2026-10-23' }),
    );
    expect(html).toContain('data-testid="home"');
    expect(html).toContain('空白旅程');
  });
});
