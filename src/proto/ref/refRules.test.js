import { describe, it, expect } from 'vitest';
import { createRefTrip, createRefTrips } from './mockRefTrip';
import {
  TOAST_DURATION_MS,
  activeFilterCount,
  addPerson,
  applyUndo,
  buildReport,
  countRecomputed,
  dayNav,
  defaultExpenseDate,
  defaultPayer,
  defaultPayment,
  defaultTime,
  exportBackupJSON,
  exportTripJSON,
  isTimeEntryInvalid,
  makeUndo,
  parseHHMM,
  parseRate,
  postSaveTarget,
  removePerson,
  renamePerson,
  resolveToday,
  saveBlockReason,
  saveToastMessage,
  setBudget,
  setRate,
  shouldKeepToastOnRoute,
  sortStops,
  stopMinutes,
  switchTripRoute,
  tripDates,
  tripMonth,
} from './refRules';

describe('P0-1: parseHHMM, stopMinutes, sortStops', () => {
  it('parses valid HH:MM and rejects corrupted / out-of-range / empty strings', () => {
    expect(parseHHMM('9:5')).toBe('09:05');
    expect(parseHHMM('09:05')).toBe('09:05');
    expect(parseHHMM(' 15:00 ')).toBe('15:00');
    expect(parseHHMM('00:00')).toBe('00:00');
    expect(parseHHMM('23:59')).toBe('23:59');

    expect(parseHHMM('09:15:0030')).toBeNull();
    expect(parseHHMM('25:00')).toBeNull();
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('12:60')).toBeNull();
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM('   ')).toBeNull();
    expect(parseHHMM('abc')).toBeNull();
    expect(parseHHMM(null)).toBeNull();
  });

  it('computes stopMinutes with Infinity for untimed or invalid strings', () => {
    expect(stopMinutes('00:00')).toBe(0);
    expect(stopMinutes('09:30')).toBe(570);
    expect(stopMinutes('')).toBe(Infinity);
    expect(stopMinutes('09:15:0030')).toBe(Infinity);
  });

  it('sorts stops chronologically and keeps untimed stops last in stable order', () => {
    const stops = [
      { id: 'u1', time: '', title: '晚餐' },
      { id: 't2', time: '14:00', title: '下午茶' },
      { id: 'u2', time: '', title: '宵夜' },
      { id: 't1', time: '09:05', title: '早餐' },
    ];
    const sorted = sortStops(stops);
    expect(sorted.map((s) => s.id)).toEqual(['t1', 't2', 'u1', 'u2']);
    expect(stops.map((s) => s.id)).toEqual(['u1', 't2', 'u2', 't1']); // does not mutate input
  });

  it('validates time entry with isTimeEntryInvalid (empty+badInput vs untimed vs strict HH:MM)', () => {
    expect(isTimeEntryInvalid({ value: '', badInput: false })).toBe(false);
    expect(isTimeEntryInvalid({ value: '   ', badInput: false })).toBe(false);
    expect(isTimeEntryInvalid({ value: '', badInput: true })).toBe(true);
    expect(isTimeEntryInvalid({ value: '9:5', badInput: false })).toBe(true);
    expect(isTimeEntryInvalid({ value: '25:00', badInput: false })).toBe(true);
    expect(isTimeEntryInvalid({ value: '12:60', badInput: false })).toBe(true);
    expect(isTimeEntryInvalid({ value: '09:15:0030', badInput: false })).toBe(true);
    expect(isTimeEntryInvalid({ value: '09:30', badInput: false })).toBe(false);
    expect(isTimeEntryInvalid({ value: '00:00', badInput: false })).toBe(false);
    expect(isTimeEntryInvalid({ value: '23:59', badInput: false })).toBe(false);
  });
});

describe('P1-1: resolveToday & defaultExpenseDate', () => {
  it('honours valid ISO today override and falls back on invalid override', () => {
    const fallbackNow = new Date(2026, 9, 23, 14, 0); // 2026-10-23 local
    expect(resolveToday('?proto=ref&today=2026-10-30', fallbackNow)).toBe('2026-10-30');
    expect(resolveToday('?proto=ref&today=2026-10-22', fallbackNow)).toBe('2026-10-22');
    expect(resolveToday('?proto=ref&today=2026-02-30', fallbackNow)).toBe('2026-10-23');
    expect(resolveToday('?proto=ref&today=not-a-date', fallbackNow)).toBe('2026-10-23');
    expect(resolveToday('?proto=ref', fallbackNow)).toBe('2026-10-23');
  });

  it('returns today when inside trip, startDate before trip, and endDate after trip', () => {
    const trip = createRefTrip(); // 2026-10-18 .. 2026-10-27
    expect(defaultExpenseDate(trip, '2026-10-22')).toBe('2026-10-22');
    expect(defaultExpenseDate(trip, '2026-10-10')).toBe('2026-10-18');
    expect(defaultExpenseDate(trip, '2026-11-02')).toBe('2026-10-27');
  });
});

describe('P1-3 & P1-4: postSaveTarget & saveToastMessage', () => {
  it('routes postSaveTarget consistently for ledger, day, home, and undated', () => {
    expect(postSaveTarget({ origin: 'ledger', savedDate: '2026-10-22' })).toBe('ledger');
    expect(postSaveTarget({ origin: 'ledger', savedDate: '' })).toBe('ledger');
    expect(postSaveTarget({ origin: 'day', savedDate: '2026-10-20' })).toBe('day=2026-10-20&pane=expenses');
    expect(postSaveTarget({ origin: 'home', savedDate: '2026-10-22' })).toBe('day=2026-10-22&pane=expenses');
    expect(postSaveTarget({ origin: 'home', savedDate: '' })).toBe('ledger');
    expect(postSaveTarget({ origin: 'day', savedDate: null })).toBe('ledger');
  });

  it('formats saveToastMessage for add, edit, delete, and undated expenses', () => {
    expect(saveToastMessage({ kind: 'add', expense: { hkdAmount: 88, date: '2026-10-22' } })).toBe(
      '已記錄 HKD $88 · 10月22日',
    );
    expect(saveToastMessage({ kind: 'edit', expense: { hkdAmount: 316, date: '2026-10-20' } })).toBe(
      '已更新 HKD $316 · 10月20日',
    );
    expect(saveToastMessage({ kind: 'delete', expense: { hkdAmount: 984, date: '' } })).toBe(
      '已刪除 HKD $984 · 未有日期',
    );
    expect(saveToastMessage({ kind: 'add', expense: { hkdAmount: 50, date: null } })).toBe(
      '已記錄 HKD $50 · 未有日期',
    );
  });

  it('undo add keeps an expense added afterwards and preserves concurrent changes', () => {
    const firstAdd = { id: 'n1', store: 'First', hkdAmount: 50, assignedTo: 'Oscar' };
    const secondAdd = { id: 'n2', store: 'Second', hkdAmount: 80, assignedTo: '奧斯卡' };
    const base = [{ id: 'r1', store: 'Existing', hkdAmount: 100, assignedTo: '奧斯卡' }];
    const undoOp = makeUndo('add', { expense: firstAdd });

    const withBothAndRenamed = [...base, firstAdd, secondAdd];
    const afterUndo = applyUndo(withBothAndRenamed, undoOp);

    expect(afterUndo.map((e) => e.id)).toEqual(['r1', 'n2']);
    expect(afterUndo.find((e) => e.id === 'n2')?.assignedTo).toBe('奧斯卡');
  });

  it('undo delete restores index and clamps out-of-bounds indices', () => {
    const r15 = { id: 'r15', store: 'A', hkdAmount: 10 };
    const r16 = { id: 'r16', store: 'B', hkdAmount: 20 };
    const r17 = { id: 'r17', store: 'C', hkdAmount: 30 };
    const undoOp = makeUndo('delete', { expense: r16, index: 1 });

    const afterDelete = [r15, r17];
    const restored = applyUndo(afterDelete, undoOp);
    expect(restored.map((e) => e.id)).toEqual(['r15', 'r16', 'r17']);

    const clampedHigh = applyUndo([r15], makeUndo('delete', { expense: r17, index: 99 }));
    expect(clampedHigh.map((e) => e.id)).toEqual(['r15', 'r17']);

    const clampedLow = applyUndo([r17], makeUndo('delete', { expense: r15, index: -3 }));
    expect(clampedLow.map((e) => e.id)).toEqual(['r15', 'r17']);
  });

  it('undo edit replaces only the edited record with its previous version', () => {
    const before = { id: 'r15', store: '富士急行 河口湖站', hkdAmount: 263, assignedTo: '共同' };
    const after = { id: 'r15', store: '富士急行 改', hkdAmount: 500, assignedTo: '共同' };
    const other = { id: 'r16', store: '不動', hkdAmount: 389, assignedTo: '奧斯卡' };
    const undoOp = makeUndo('edit', { expense: after, previous: before });

    const result = applyUndo([after, other], undoOp);
    expect(result).toEqual([before, other]);
  });

  it('returns saveBlockReason hint when amount or store is missing and null when valid', () => {
    expect(saveBlockReason({ amount: '', store: '' })).toBe('請填寫金額及店舗');
    expect(saveBlockReason({ amount: '0', store: '   ' })).toBe('請填寫金額及店舗');
    expect(saveBlockReason({ amount: '', store: '一蘭拉麵' })).toBe('請填寫金額');
    expect(saveBlockReason({ amount: '-20', store: '一蘭拉麵' })).toBe('請填寫金額');
    expect(saveBlockReason({ amount: '1500', store: '' })).toBe('請填寫店舗');
    expect(saveBlockReason({ amount: '1500', store: '   ' })).toBe('請填寫店舗');
    expect(saveBlockReason({ amount: '1500', store: '一蘭拉麵' })).toBeNull();
    expect(saveBlockReason({ amount: 1500, store: '一蘭拉麵' })).toBeNull();
  });

  it('uses a 6000 ms toast duration', () => {
    expect(TOAST_DURATION_MS).toBe(6000);
  });

  it('dismisses toast when entering add/edit route and keeps it across other routes', () => {
    expect(shouldKeepToastOnRoute('home', 'add')).toBe(false);
    expect(shouldKeepToastOnRoute('day', 'add')).toBe(false);
    expect(shouldKeepToastOnRoute('ledger', 'add')).toBe(false);
    expect(shouldKeepToastOnRoute('add', 'add')).toBe(false);
    expect(shouldKeepToastOnRoute('#day=2026-10-22&pane=expenses', '#add&date=2026-10-22')).toBe(false);
    expect(shouldKeepToastOnRoute({ screen: 'day' }, { screen: 'add' })).toBe(false);

    expect(shouldKeepToastOnRoute('add', 'day')).toBe(true);
    expect(shouldKeepToastOnRoute('add', 'ledger')).toBe(true);
    expect(shouldKeepToastOnRoute('day', 'ledger')).toBe(true);
    expect(shouldKeepToastOnRoute('home', 'day')).toBe(true);
  });
});

describe('P1-6: activeFilterCount', () => {
  it('counts non-全部 filters across category, date, payment, and payer', () => {
    expect(activeFilterCount({ category: '全部', date: '全部' })).toBe(0);
    expect(activeFilterCount({ category: '飲食', date: '全部' })).toBe(1);
    expect(activeFilterCount({ category: '全部', date: 'undated' })).toBe(1);
    expect(activeFilterCount({ category: '購物', date: '2026-10-20' })).toBe(2);
    expect(activeFilterCount({ category: '飲食', date: '全部', payment: 'card', payer: 'Oscar' })).toBe(3);
    expect(activeFilterCount({ category: '購物', date: '2026-10-20', payment: 'cash', payer: '阿明' })).toBe(4);
  });
});

describe('r7 rules: defaultTime, defaultPayer, defaultPayment, setBudget', () => {
  it('formats defaultTime from a fixed Date to zero-padded HH:MM', () => {
    expect(defaultTime(new Date(2026, 9, 23, 9, 5))).toBe('09:05');
    expect(defaultTime(new Date(2026, 9, 23, 18, 30))).toBe('18:30');
  });

  it('picks first non-共同 person in defaultPayer or empty string', () => {
    expect(defaultPayer(['共同', 'Oscar', '阿明'])).toBe('Oscar');
    expect(defaultPayer(['阿明', 'Oscar'])).toBe('阿明');
    expect(defaultPayer(['共同'])).toBe('');
    expect(defaultPayer([])).toBe('');
  });

  it('resolves defaultPayment: lastPayment wins, else last valid item payment, else cash', () => {
    const trip = createRefTrip(); // last item r17 is cash
    expect(defaultPayment(trip)).toBe('cash');
    expect(defaultPayment({ ...trip, lastPayment: 'card' })).toBe('card');
    expect(
      defaultPayment({
        expenses: [
          { id: '1', payment: 'cash' },
          { id: '2', payment: 'card' },
        ],
      }),
    ).toBe('card');
    expect(defaultPayment({ expenses: [] })).toBe('cash');
    expect(defaultPayment({})).toBe('cash');
  });

  it('sets positive integer budget or null on empty/invalid/non-positive in setBudget', () => {
    const trip = createRefTrip();
    expect(setBudget(trip, 20000).settings.budget).toBe(20000);
    expect(setBudget(trip, '15,000').settings.budget).toBe(15000);
    expect(setBudget(trip, ' 18,500 ').settings.budget).toBe(18500);
    expect(setBudget(trip, '').settings.budget).toBeNull();
    expect(setBudget(trip, '0').settings.budget).toBeNull();
    expect(setBudget(trip, -100).settings.budget).toBeNull();
    expect(setBudget(trip, 'abc').settings.budget).toBeNull();
    expect(setBudget(trip, null).settings.budget).toBeNull();
  });
});

describe('P1-7: switchTripRoute & tripMonth', () => {
  const [tokyo, osaka] = createRefTrips();

  it('resets day route outside new trip range to home and keeps in-range or tab routes', () => {
    expect(switchTripRoute('#day=2026-10-22&pane=expenses', osaka)).toBe('');
    expect(switchTripRoute('#day=2026-11-14&pane=expenses', osaka)).toBe('day=2026-11-14&pane=expenses');
    expect(switchTripRoute({ screen: 'day', day: '2026-10-22', pane: 'itinerary' }, osaka)).toBe('');
    expect(switchTripRoute({ screen: 'day', day: '2026-10-22', pane: 'expenses' }, tokyo)).toBe(
      'day=2026-10-22&pane=expenses',
    );
    expect(switchTripRoute('#ledger', osaka)).toBe('ledger');
    expect(switchTripRoute('#charts', osaka)).toBe('charts');
    expect(switchTripRoute('#settings', osaka)).toBe('settings');
    expect(switchTripRoute('#add&edit=r1', osaka)).toBe('');
  });

  it('selects today month when in trip and startDate month otherwise', () => {
    expect(tripMonth(tokyo, '2026-10-22')).toBe('2026-10');
    expect(tripMonth(osaka, '2026-10-22')).toBe('2026-11');
  });
});

describe('P1-8: exports, report, people management, and exchange rate', () => {
  it('round-trip parses exportTripJSON and exportBackupJSON', () => {
    const trips = createRefTrips();
    const single = exportTripJSON(trips[0]);
    expect(single.filename).toBe('trip-trip-ref-tokyo-autumn.json');
    const parsedSingle = JSON.parse(single.text);
    expect(parsedSingle.id).toBe(trips[0].id);
    expect(parsedSingle.expenses).toHaveLength(17);

    const backup = exportBackupJSON(trips, new Date(2026, 9, 23, 12, 0));
    expect(backup.filename).toBe('travel-backup-2026-10-23.json');
    const parsedBackup = JSON.parse(backup.text);
    expect(parsedBackup.version).toBe(1);
    expect(parsedBackup.trips).toHaveLength(2);
  });

  it('builds a zh-HK report containing trip name, dates, and total HKD', () => {
    const trip = createRefTrip();
    const report = buildReport(trip);
    expect(report).toContain('東京秋日之旅');
    expect(report).toContain('2026-10-18 – 2026-10-27');
    expect(report).toContain('HKD $11,222');
    expect(report).toContain('Oscar');
    expect(report).toContain('飲食');
  });

  it('renames a person, updates assignedTo, and rejects blank or duplicate names', () => {
    const trip = createRefTrip();
    expect(renamePerson(trip, 'Oscar', '   ')).toBe(trip);
    expect(renamePerson(trip, 'Oscar', '阿明')).toBe(trip);
    expect(renamePerson(trip, '共同', '大家')).toBe(trip);

    const renamed = renamePerson(trip, 'Oscar', '小奧');
    expect(renamed.settings.people).toEqual(['共同', '小奧', '阿明']);
    expect(renamed.expenses.filter((e) => e.assignedTo === 'Oscar')).toHaveLength(0);
    expect(renamed.expenses.filter((e) => e.assignedTo === '小奧').length).toBeGreaterThan(0);
    expect(renamed.expenses.filter((e) => e.payer === 'Oscar')).toHaveLength(0);
    expect(renamed.expenses.filter((e) => e.payer === '小奧')).toHaveLength(10);
  });

  it('adds a person with duplicate/blank validation and removes a person while keeping 共同 and reassigning payer', () => {
    const trip = createRefTrip();
    expect(addPerson(trip, '')).toBe(trip);
    expect(addPerson(trip, 'Oscar')).toBe(trip);
    const withNew = addPerson(trip, 'May');
    expect(withNew.settings.people).toEqual(['共同', 'Oscar', '阿明', 'May']);

    expect(removePerson(trip, '共同')).toBe(trip);
    const oscarCount = trip.expenses.filter((e) => e.assignedTo === 'Oscar').length;
    const sharedBefore = trip.expenses.filter((e) => e.assignedTo === '共同').length;
    const afterRemove = removePerson(trip, 'Oscar');
    expect(afterRemove.settings.people).toEqual(['共同', '阿明']);
    expect(afterRemove.expenses.filter((e) => e.assignedTo === 'Oscar')).toHaveLength(0);
    expect(afterRemove.expenses.filter((e) => e.assignedTo === '共同')).toHaveLength(sharedBefore + oscarCount);
    expect(afterRemove.expenses.filter((e) => e.payer === 'Oscar')).toHaveLength(0);
    expect(afterRemove.expenses.every((e) => e.payer === '阿明')).toBe(true);

    const afterRemoveAll = removePerson(afterRemove, '阿明');
    expect(afterRemoveAll.settings.people).toEqual(['共同']);
    expect(afterRemoveAll.expenses.every((e) => e.payer === '')).toBe(true);
  });

  it('setRate rejects 0/negative/NaN and recomputes JPY hkdAmount on valid rate', () => {
    const trip = createRefTrip();
    expect(setRate(trip, 0)).toBe(trip);
    expect(setRate(trip, -0.05)).toBe(trip);
    expect(setRate(trip, Number.NaN)).toBe(trip);
    expect(setRate(trip, 'abc')).toBe(trip);

    const updated = setRate(trip, 0.06);
    expect(updated.settings.rate).toBe(0.06);
    for (const e of updated.expenses) {
      expect(e.hkdAmount).toBe(Math.round(e.originalAmount * 0.06));
    }
    expect(countRecomputed(trip)).toBe(17);
    expect(updated.recomputedCount).toBe(17);

    const mixedTrip = {
      ...trip,
      expenses: [
        ...trip.expenses,
        { id: 'hk1', currency: 'HKD', originalCurrency: 'HKD', originalAmount: 200, hkdAmount: 200 },
      ],
    };
    expect(countRecomputed(mixedTrip)).toBe(17);
    const updatedMixed = setRate(mixedTrip, 0.05);
    expect(updatedMixed.expenses.find((e) => e.id === 'hk1')?.hkdAmount).toBe(200);
  });

  it('validates rate input with parseRate (> 0, finite)', () => {
    expect(parseRate('0.0526')).toBe(0.0526);
    expect(parseRate(' 0.06 ')).toBe(0.06);
    expect(parseRate(0.055)).toBe(0.055);
    expect(parseRate('0')).toBeNull();
    expect(parseRate(0)).toBeNull();
    expect(parseRate('-0.05')).toBeNull();
    expect(parseRate('')).toBeNull();
    expect(parseRate('   ')).toBeNull();
    expect(parseRate('abc')).toBeNull();
    expect(parseRate('Infinity')).toBeNull();
    expect(parseRate(Number.NaN)).toBeNull();
    expect(parseRate(null)).toBeNull();
  });
});

describe('P1-9: dayNav & tripDates', () => {
  const trip = createRefTrip(); // 2026-10-18 .. 2026-10-27

  it('bounds first, middle, last, and outside-trip dates', () => {
    expect(dayNav(trip, '2026-10-18')).toEqual({ prev: null, next: '2026-10-19', inTrip: true });
    expect(dayNav(trip, '2026-10-22')).toEqual({ prev: '2026-10-21', next: '2026-10-23', inTrip: true });
    expect(dayNav(trip, '2026-10-27')).toEqual({ prev: '2026-10-26', next: null, inTrip: true });
    expect(dayNav(trip, '2026-10-15')).toEqual({ prev: null, next: '2026-10-18', inTrip: false });
    expect(dayNav(trip, '2026-10-28')).toEqual({ prev: '2026-10-27', next: null, inTrip: false });
  });

  it('lists all trip dates inclusively', () => {
    const dates = tripDates(trip);
    expect(dates).toHaveLength(10);
    expect(dates[0]).toBe('2026-10-18');
    expect(dates[9]).toBe('2026-10-27');
  });
});
