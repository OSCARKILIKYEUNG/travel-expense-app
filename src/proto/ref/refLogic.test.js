import { describe, expect, it } from 'vitest';
import { createRefTrip, REF_PEOPLE, REF_TODAY } from './mockRefTrip';
import {
  buildAddHash,
  dayExpenses,
  dayStats,
  dayStrip,
  filterExpenses,
  fmtHKD,
  groupLedger,
  parseRoute,
  personCounts,
  shortenTitle,
  undatedHint,
  zhDate,
} from './refLogic';

const trip = createRefTrip();

describe('ref routes (two-pane day view)', () => {
  it('opens the day on 行程手札 by default and maps the old overview pane to it', () => {
    expect(parseRoute('#day=2026-10-22')).toMatchObject({ screen: 'day', pane: 'itinerary', edit: false });
    expect(parseRoute('#day=2026-10-22&pane=overview').pane).toBe('itinerary');
    expect(parseRoute('#day=2026-10-22&pane=expenses').pane).toBe('expenses');
    expect(parseRoute('#day=2026-10-22&pane=itinerary&edit=1').edit).toBe(true);
  });
  it('parses add, ledger (with filter/focus params) and home', () => {
    expect(parseRoute('#add&date=2026-10-22&scan=1')).toEqual({ screen: 'add', date: '2026-10-22', scan: true, expenseId: null });
    expect(parseRoute('#ledger')).toEqual({
      screen: 'ledger',
      filters: { category: '全部', payment: '全部', payer: '全部', person: '全部' },
      focus: null,
    });
    expect(parseRoute('#ledger&cat=飲食&pay=card&payer=Oscar&person=阿明&focus=r9')).toEqual({
      screen: 'ledger',
      filters: { category: '飲食', payment: 'card', payer: 'Oscar', person: '阿明' },
      focus: 'r9',
    });
    expect(parseRoute('').screen).toBe('home');
  });
  it('builds day-view 掃描收據 / 記一筆 routes with the selected day iso (not REF_TODAY)', () => {
    const selectedIso = '2026-10-20';
    expect(selectedIso).not.toBe(REF_TODAY);
    const scanHash = buildAddHash({ scan: true, date: selectedIso });
    expect(parseRoute(scanHash)).toEqual({
      screen: 'add',
      date: '2026-10-20',
      scan: true,
      expenseId: null,
    });
    const manualHash = buildAddHash({ date: selectedIso });
    expect(parseRoute(manualHash)).toEqual({
      screen: 'add',
      date: '2026-10-20',
      scan: false,
      expenseId: null,
    });
  });
});

describe('display', () => {
  it('formats zh-HK dates instead of mm/dd/yyyy', () => {
    expect(zhDate('2026-10-22')).toBe('10月22日 週四');
    expect(zhDate('')).toBe('未有日期');
  });
  it('keeps the day strip on one line by shortening the title, not the font', () => {
    expect(dayStrip({ n: 5, title: '富士山一日遊', hkd: 1086 })).toBe('Day 5・富士山一日遊・HKD $1,086');
    expect(shortenTitle('河口湖與富士五湖環湖巴士一日遊', 8)).toBe('河口湖與富士五…');
    expect(fmtHKD(11222)).toBe('HKD $11,222');
  });
  it('splits the day total into scanned and manual', () => {
    expect(dayStats(trip.expenses, '2026-10-22')).toEqual({ count: 3, total: 1086, scanned: 2, manual: 1 });
  });
});

describe('ledger (帳本) and dayExpenses', () => {
  it('puts dated groups newest first and 未有日期 last with unchanged subtotals', () => {
    const g = groupLedger(trip.expenses);
    expect(g[0].iso).toBe('2026-10-22');
    expect(g[0].total).toBe(1086);
    expect(g.slice(0, -1).map((x) => x.iso)).toEqual([
      '2026-10-22',
      '2026-10-21',
      '2026-10-20',
      '2026-10-19',
      '2026-10-18',
    ]);
    expect(g[g.length - 1]).toMatchObject({ key: 'undated', label: '未有日期', iso: null });
    expect(g.reduce((s, x) => s + x.items.length, 0)).toBe(17);

    // Multiple undated items are ordered newest-recorded first
    const multiUndated = groupLedger([
      { id: 'u1', date: '', store: 'Old', hkdAmount: 10 },
      { id: 'u2', date: '', store: 'Middle', hkdAmount: 20 },
      { id: 'u3', date: '', store: 'Newest', createdAt: '2026-10-23T01:00:00.000Z', hkdAmount: 30 },
    ]);
    expect(multiUndated).toHaveLength(1);
    expect(multiUndated[0].items.map((e) => e.id)).toEqual(['u3', 'u2', 'u1']);
  });
  it('computes undatedHint for 0, 1, and 3 undated items', () => {
    expect(undatedHint(groupLedger(trip.expenses.filter((e) => e.date)))).toBeNull();
    expect(undatedHint(groupLedger(trip.expenses))).toEqual({
      count: 1,
      label: '1 筆未有日期',
    });
    const threeUndated = groupLedger([
      ...trip.expenses,
      { id: 'u2', date: '', store: 'A', hkdAmount: 50 },
      { id: 'u3', date: '', store: 'B', hkdAmount: 60 },
    ]);
    expect(undatedHint(threeUndated)).toEqual({
      count: 3,
      label: '3 筆未有日期',
    });
  });
  it('orders dayExpenses newest first (by time on 10-22, by recorded order on 10-20)', () => {
    expect(dayExpenses(trip.expenses, '2026-10-22').map((e) => e.store)).toEqual([
      'ほうとう不動 東恋路店',
      '天上山纜車',
      '富士急行 河口湖站',
    ]);
    expect(dayExpenses(trip.expenses, '2026-10-20').map((e) => e.store)).toEqual([
      'UNIQLO 銀座',
      'Suica 增值',
      '壽司 銀座 久兵衛',
      '銀座 伊東屋',
    ]);
  });
  it('filters by person, category, date, payment, payer and search', () => {
    const day = trip.expenses.filter((e) => e.date === '2026-10-22');
    expect(personCounts(day, REF_PEOPLE)).toEqual({ 全部: 3, 共同: 2, Oscar: 1, 阿明: 0 });
    expect(filterExpenses(trip.expenses, { person: '阿明' }, REF_PEOPLE)).toHaveLength(2);
    expect(filterExpenses(trip.expenses, { category: '交通' }, REF_PEOPLE)).toHaveLength(3);
    expect(filterExpenses(trip.expenses, { date: 'undated' }, REF_PEOPLE)).toHaveLength(1);
    expect(filterExpenses(trip.expenses, { query: '河口湖' }, REF_PEOPLE)).toHaveLength(3);
    expect(filterExpenses(trip.expenses, { payment: 'cash' }, REF_PEOPLE)).toHaveLength(8);
    expect(filterExpenses(trip.expenses, { payment: 'card' }, REF_PEOPLE)).toHaveLength(9);
    expect(filterExpenses(trip.expenses, { payer: 'Oscar' }, REF_PEOPLE)).toHaveLength(10);
    expect(filterExpenses(trip.expenses, { payer: '阿明' }, REF_PEOPLE)).toHaveLength(7);
    expect(filterExpenses(trip.expenses, { payment: 'card', payer: 'Oscar' }, REF_PEOPLE)).toHaveLength(5);
  });
});
