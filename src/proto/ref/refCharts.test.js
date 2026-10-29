import { describe, expect, it } from 'vitest';
import { toRefExpense } from '../../adapters/refDataAdapter';
import { createLegacySeedTrip } from '../../notebook/legacySeed';
import { adaptTripForNotebook } from '../../notebook/tripRate';
import { createRefTrip, REF_CATEGORIES, REF_TODAY } from './mockRefTrip';
import {
  assigneeSplit,
  categorySplit,
  chartsMode,
  dailyStacks,
  ledgerHash,
  paymentSplit,
  remainingPerDay,
  settleUp,
  todayVsAverage,
  topExpenses,
} from './refCharts';

const trip = createRefTrip(); // 2026-10-18 .. 2026-10-27, budget 15000

describe('chartsMode', () => {
  it('returns before / during / review including boundary start and end days', () => {
    expect(chartsMode(trip, '2026-10-17')).toBe('before');
    expect(chartsMode(trip, '2026-10-18')).toBe('during');
    expect(chartsMode(trip, '2026-10-22')).toBe('during');
    expect(chartsMode(trip, '2026-10-27')).toBe('during');
    expect(chartsMode(trip, '2026-10-28')).toBe('review');
  });
});

describe('remainingPerDay', () => {
  it('matches Tokyo oracle @2026-10-22 with budget 15000', () => {
    const res = remainingPerDay({
      budget: 15000,
      expenses: trip.expenses,
      startDate: trip.startDate,
      endDate: trip.endDate,
      today: REF_TODAY,
    });
    expect(res).toEqual({
      budget: 15000,
      spent: 11222,
      left: 3778,
      pct: 75,
      over: false,
      daysLeft: 5,
      perDay: 755,
      lastDay: false,
    });
  });

  it('handles last day of trip (daysLeft 0, lastDay true, perDay = left)', () => {
    const res = remainingPerDay({
      budget: 15000,
      expenses: trip.expenses,
      startDate: trip.startDate,
      endDate: trip.endDate,
      today: '2026-10-27',
    });
    expect(res).toMatchObject({
      daysLeft: 0,
      lastDay: true,
      perDay: 3778,
      over: false,
    });
  });

  it('handles over budget (over true, perDay 0)', () => {
    const res = remainingPerDay({
      budget: 10000,
      expenses: trip.expenses,
      startDate: trip.startDate,
      endDate: trip.endDate,
      today: REF_TODAY,
    });
    expect(res).toEqual({
      budget: 10000,
      spent: 11222,
      left: -1222,
      pct: 112,
      over: true,
      daysLeft: 5,
      perDay: 0,
      lastDay: false,
    });
  });

  it('handles before trip (daysLeft = inclusive trip length)', () => {
    const res = remainingPerDay({
      budget: 15000,
      expenses: trip.expenses,
      startDate: trip.startDate,
      endDate: trip.endDate,
      today: '2026-10-10',
    });
    expect(res).toMatchObject({
      daysLeft: 10,
      perDay: 377,
      lastDay: false,
      over: false,
    });
  });

  it('returns null when budget is not a positive number', () => {
    expect(remainingPerDay({ budget: null, expenses: trip.expenses, startDate: trip.startDate, endDate: trip.endDate, today: REF_TODAY })).toBeNull();
    expect(remainingPerDay({ budget: 0, expenses: trip.expenses, startDate: trip.startDate, endDate: trip.endDate, today: REF_TODAY })).toBeNull();
    expect(remainingPerDay({ budget: -500, expenses: trip.expenses, startDate: trip.startDate, endDate: trip.endDate, today: REF_TODAY })).toBeNull();
  });
});

describe('todayVsAverage', () => {
  it('matches Tokyo oracle @2026-10-22 (today 1086, avg 2048, elapsed 5)', () => {
    expect(todayVsAverage(trip.expenses, trip, REF_TODAY)).toEqual({
      today: 1086,
      avg: 2048,
      elapsedDays: 5,
    });
  });

  it('returns elapsedDays 0 and avg 0 before trip', () => {
    expect(todayVsAverage(trip.expenses, trip, '2026-10-15')).toEqual({
      today: 0,
      avg: 0,
      elapsedDays: 0,
    });
  });
});

describe('paymentSplit & categorySplit', () => {
  it('matches Tokyo paymentSplit oracle (cash 2122, card 9100)', () => {
    const split = paymentSplit(trip.expenses);
    expect(split.cash).toEqual({ total: 2122, count: 8 });
    expect(split.card).toEqual({ total: 9100, count: 9 });
    expect(split.none).toEqual({ total: 0, count: 0 });
    expect(split.total).toBe(11222);
  });

  it('computes categorySplit sorted descending and summing to 11222', () => {
    const cats = categorySplit(trip.expenses, REF_CATEGORIES);
    expect(cats.reduce((s, c) => s + c.total, 0)).toBe(11222);
    expect(cats.reduce((s, c) => s + c.count, 0)).toBe(17);
    for (let i = 1; i < cats.length; i += 1) {
      expect(cats[i - 1].total).toBeGreaterThanOrEqual(cats[i].total);
    }
  });
});

describe('dailyStacks & topExpenses', () => {
  it('builds dailyStacks during trip (5 rows, last isToday, segments sum = row total) and in review (10 rows)', () => {
    const during = dailyStacks(trip.expenses, trip, REF_TODAY, REF_CATEGORIES);
    expect(during.rows).toHaveLength(5);
    expect(during.rows[0].iso).toBe('2026-10-18');
    expect(during.rows[4].iso).toBe('2026-10-22');
    expect(during.rows[4].isToday).toBe(true);
    expect(during.rows.slice(0, 4).every((r) => !r.isToday)).toBe(true);
    for (const r of during.rows) {
      expect(r.segments.reduce((s, seg) => s + seg.total, 0)).toBe(r.total);
    }
    expect(during.max).toBe(Math.max(...during.rows.map((r) => r.total)));
    expect(during.avg).toBe(2048);

    const review = dailyStacks(trip.expenses, trip, '2026-10-30', REF_CATEGORIES);
    expect(review.rows).toHaveLength(10);
    expect(review.rows[9].iso).toBe('2026-10-27');

    const before = dailyStacks(trip.expenses, trip, '2026-10-10', REF_CATEGORIES);
    expect(before).toEqual({ rows: [], max: 0, avg: 0 });
  });

  it('returns topExpenses highest first (淺草 雷門酒店 2030 first)', () => {
    const top = topExpenses(trip.expenses, 5);
    expect(top).toHaveLength(5);
    expect(top[0].store).toBe('淺草 雷門酒店');
    expect(top[0].hkdAmount).toBe(2030);
    for (let i = 1; i < top.length; i += 1) {
      expect(top[i - 1].hkdAmount).toBeGreaterThanOrEqual(top[i].hkdAmount);
    }
  });
});

describe('settleUp & ledgerHash', () => {
  it('matches Tokyo settleUp oracle (Oscar paid 7953 owed 6316.5, 阿明 paid 3269 owed 4905.5, transfer 阿明 -> Oscar 1637)', () => {
    const res = settleUp(trip.expenses, trip.settings.people);
    expect(res.rows).toEqual([
      { person: 'Oscar', paid: 7953, owed: 6316.5, net: 1636.5 },
      { person: '阿明', paid: 3269, owed: 4905.5, net: -1636.5 },
    ]);
    expect(res.transfers).toEqual([{ from: '阿明', to: 'Oscar', amount: 1637 }]);
  });

  it('handles 3 participants with equal split, assigned expense, unknown payer -> first participant, and minimal 2 transfers', () => {
    const people = ['共同', 'Oscar', '阿明', 'May'];
    const expenses = [
      { id: 'e1', hkdAmount: 300, payer: 'Oscar', assignedTo: '共同' }, // owed: 100 each
      { id: 'e2', hkdAmount: 90, payer: 'Oscar', assignedTo: '阿明' }, // 阿明 owes 90
      { id: 'e3', hkdAmount: 60, payer: 'Ghost', assignedTo: 'May' }, // unknown payer -> Oscar paid 60, May owes 60
    ];
    const res = settleUp(expenses, people);
    expect(res.rows).toEqual([
      { person: 'Oscar', paid: 450, owed: 100, net: 350 },
      { person: '阿明', paid: 0, owed: 190, net: -190 },
      { person: 'May', paid: 0, owed: 160, net: -160 },
    ]);
    expect(res.transfers).toEqual([
      { from: '阿明', to: 'Oscar', amount: 190 },
      { from: 'May', to: 'Oscar', amount: 160 },
    ]);
  });

  it('returns empty rows and transfers when there are no non-共同 participants', () => {
    expect(settleUp(trip.expenses, ['共同'])).toEqual({ rows: [], transfers: [] });
    expect(settleUp(trip.expenses, [])).toEqual({ rows: [], transfers: [] });
  });

  it('formats ledgerHash with URLSearchParams only for provided keys', () => {
    expect(ledgerHash()).toBe('ledger');
    expect(ledgerHash({ category: '全部', payment: '全部' })).toBe('ledger');
    expect(ledgerHash({ payment: 'card' })).toBe('ledger&pay=card');
    expect(ledgerHash({ person: 'Oscar' })).toBe('ledger&person=Oscar');
    expect(ledgerHash({ payer: 'Oscar' })).toBe('ledger&payer=Oscar');
    expect(ledgerHash({ category: '飲食', payer: 'Oscar', focus: 'r9' })).toBe(
      `ledger&${new URLSearchParams({ cat: '飲食', payer: 'Oscar', focus: 'r9' }).toString()}`,
    );
  });
});

describe('assigneeSplit', () => {
  it('matches Tokyo mock oracle (共同 8781/10, Oscar 1926/5, 阿明 515/2; shares 6316.5 & 4905.5)', () => {
    const res = assigneeSplit(trip.expenses, trip.settings.people);
    expect(res.total).toBe(11222);
    expect(res.rows).toEqual([
      { person: '共同', total: 8781, count: 10, pct: 78 },
      { person: 'Oscar', total: 1926, count: 5, pct: 17 },
      { person: '阿明', total: 515, count: 2, pct: 5 },
    ]);
    expect(res.shares).toEqual([
      { person: 'Oscar', share: 6316.5 },
      { person: '阿明', share: 4905.5 },
    ]);
    expect(res.rows.reduce((s, r) => s + r.total, 0)).toBe(11222);
    expect(res.shares.reduce((s, x) => s + x.share, 0)).toBe(11222);

    const settled = settleUp(trip.expenses, trip.settings.people);
    expect(res.shares).toEqual(settled.rows.map((r) => ({ person: r.person, share: r.owed })));
  });

  it('counts blank assignedTo as 共同, keeps 0 rows for people with no spend, and lists unknown assignees last', () => {
    const people = ['Oscar', '共同', '阿明', 'May'];
    const expenses = [
      { id: '1', hkdAmount: 200, payer: 'Oscar', assignedTo: '' },
      { id: '2', hkdAmount: 100, payer: 'Oscar', assignedTo: 'Oscar' },
      { id: '3', hkdAmount: 100, payer: 'Oscar', assignedTo: '小美' },
    ];
    const res = assigneeSplit(expenses, people);
    expect(res.total).toBe(400);
    expect(res.rows).toEqual([
      { person: '共同', total: 200, count: 1, pct: 50 },
      { person: 'Oscar', total: 100, count: 1, pct: 25 },
      { person: '阿明', total: 0, count: 0, pct: 0 },
      { person: 'May', total: 0, count: 0, pct: 0 },
      { person: '小美', total: 100, count: 1, pct: 25 },
    ]);
  });

  it('returns total 0 and all pct 0 for empty expenses', () => {
    const res = assigneeSplit([], ['共同', 'Oscar', '阿明']);
    expect(res).toEqual({
      total: 0,
      rows: [
        { person: '共同', total: 0, count: 0, pct: 0 },
        { person: 'Oscar', total: 0, count: 0, pct: 0 },
        { person: '阿明', total: 0, count: 0, pct: 0 },
      ],
      shares: [
        { person: 'Oscar', share: 0 },
        { person: '阿明', share: 0 },
      ],
    });
  });
});

describe('P4: Charts calculations on adapted legacySeed (toRefExpense / adaptTripForNotebook)', () => {
  const rawLegacy = createLegacySeedTrip();
  const adaptedTrip = adaptTripForNotebook(rawLegacy, { today: '2026-10-22' });
  const mappedExpenses = rawLegacy.expenses.map((e) => toRefExpense(e));

  it('computes remainingPerDay with budget 15000 on adapted legacy seed @2026-10-22', () => {
    const rem = remainingPerDay({
      budget: adaptedTrip.settings.budget,
      expenses: adaptedTrip.expenses,
      startDate: adaptedTrip.startDate,
      endDate: adaptedTrip.endDate,
      today: '2026-10-22',
    });
    expect(rem).toEqual({
      budget: 15000,
      spent: 5397,
      left: 9603,
      pct: 36,
      over: false,
      daysLeft: 5,
      perDay: 1920,
      lastDay: false,
    });
  });

  it('computes non-zero cash and card paymentSplit from legacy paymentMethod after toRefExpense', () => {
    const pay = paymentSplit(mappedExpenses);
    expect(pay.cash).toEqual({ total: 1086, count: 3 });
    expect(pay.card).toEqual({ total: 4311, count: 5 });
    expect(pay.none).toEqual({ total: 0, count: 0 });
    expect(pay.total).toBe(5397);
  });

  it('computes assigneeSplit (assignedTo ≠ payer) and settleUp (共同 split evenly) on adapted legacy seed', () => {
    const people = adaptedTrip.settings.people;
    const assignee = assigneeSplit(adaptedTrip.expenses, people);
    expect(assignee.total).toBe(5397);
    // 松本清 is card-assigned 共同, but its line items move 300 to Oscar and 200 to 阿明
    // before the remaining 共同 pool is split. The old whole-card totals double-counted that 500.
    expect(assignee.rows).toEqual([
      { person: '共同', total: 3548, count: 4, pct: 66 },
      { person: 'Oscar', total: 1215, count: 3, pct: 23 },
      { person: '阿明', total: 634, count: 2, pct: 12 },
    ]);
    expect(assignee.shares).toEqual([
      { person: 'Oscar', share: 2989 },
      { person: '阿明', share: 2408 },
    ]);

    const settled = settleUp(adaptedTrip.expenses, people);
    expect(settled.rows).toEqual([
      { person: 'Oscar', paid: 3979, owed: 2989, net: 990 },
      { person: '阿明', paid: 1418, owed: 2408, net: -990 },
    ]);
    expect(settled.transfers).toEqual([
      { from: '阿明', to: 'Oscar', amount: 990 },
    ]);

    // Person filter hash ≠ payer filter hash
    expect(ledgerHash({ person: 'Oscar' })).toBe('ledger&person=Oscar');
    expect(ledgerHash({ payer: 'Oscar' })).toBe('ledger&payer=Oscar');
    expect(ledgerHash({ person: 'Oscar' })).not.toBe(ledgerHash({ payer: 'Oscar' }));
  });
});
