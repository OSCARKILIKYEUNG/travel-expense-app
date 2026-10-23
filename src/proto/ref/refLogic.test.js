import { describe, expect, it } from 'vitest';
import { createRefTrip, REF_PEOPLE } from './mockRefTrip';
import { dayStats, dayStrip, filterExpenses, fmtHKD, groupLedger, parseRoute, personCounts, shortenTitle, zhDate } from './refLogic';

const trip = createRefTrip();

describe('ref routes (two-pane day view)', () => {
  it('opens the day on 行程手札 by default and maps the old overview pane to it', () => {
    expect(parseRoute('#day=2026-10-22')).toMatchObject({ screen: 'day', pane: 'itinerary', edit: false });
    expect(parseRoute('#day=2026-10-22&pane=overview').pane).toBe('itinerary');
    expect(parseRoute('#day=2026-10-22&pane=expenses').pane).toBe('expenses');
    expect(parseRoute('#day=2026-10-22&pane=itinerary&edit=1').edit).toBe(true);
  });
  it('parses add, ledger and home', () => {
    expect(parseRoute('#add&date=2026-10-22&scan=1')).toEqual({ screen: 'add', date: '2026-10-22', scan: true, expenseId: null });
    expect(parseRoute('#ledger').screen).toBe('ledger');
    expect(parseRoute('').screen).toBe('home');
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

describe('ledger (帳本)', () => {
  it('puts 未有日期 first, then dates newest first with subtotals', () => {
    const g = groupLedger(trip.expenses);
    expect(g[0]).toMatchObject({ key: 'undated', label: '未有日期' });
    expect(g[1].iso).toBe('2026-10-22');
    expect(g[1].total).toBe(1086);
    expect(g.reduce((s, x) => s + x.items.length, 0)).toBe(17);
  });
  it('filters by person, category, date and search', () => {
    const day = trip.expenses.filter((e) => e.date === '2026-10-22');
    expect(personCounts(day, REF_PEOPLE)).toEqual({ 全部: 3, 共同: 2, Oscar: 1, 阿明: 0 });
    expect(filterExpenses(trip.expenses, { person: '阿明' }, REF_PEOPLE)).toHaveLength(2);
    expect(filterExpenses(trip.expenses, { category: '交通' }, REF_PEOPLE)).toHaveLength(3);
    expect(filterExpenses(trip.expenses, { date: 'undated' }, REF_PEOPLE)).toHaveLength(1);
    expect(filterExpenses(trip.expenses, { query: '河口湖' }, REF_PEOPLE)).toHaveLength(3);
  });
});
