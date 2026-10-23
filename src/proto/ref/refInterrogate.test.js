import { describe, expect, it } from 'vitest';
import { dayStats, expensesOn, filterExpenses, matchesPerson } from './refLogic';

const people = ['Oscar', 'Mei'];
const list = [
  { id: 'a', date: '2026年10月22日', hkdAmount: 100, scanned: true, assignedTo: 'Oscar', items: [] },
  { id: 'b', date: '2026-10-22', hkdAmount: 50, scanned: false, assignedTo: '', items: [{ assignedTo: 'Mei' }] },
  { id: 'c', date: '', hkdAmount: 9, scanned: false, assignedTo: 'Mei', items: [] },
];

describe('interrogate fixes (grok-4.7-xhigh review, 2026-10-23)', () => {
  it('F1: joins stored zh dates to the ISO calendar day', () => {
    expect(expensesOn(list, '2026-10-22').map((e) => e.id)).toEqual(['a', 'b']);
    expect(dayStats(list, '2026-10-22')).toMatchObject({ count: 2, total: 150, scanned: 1, manual: 1 });
    expect(filterExpenses(list, { date: '2026-10-22' }, people).map((e) => e.id)).toEqual(['a', 'b']);
  });
  it('F8: one person predicate covers blank assignee (共同) and line-item assignees', () => {
    expect(matchesPerson(list[1], 'Mei', people)).toBe(true);
    expect(matchesPerson(list[0], 'Mei', people)).toBe(false);
    expect(matchesPerson(list[0], '全部', people)).toBe(true);
    expect(filterExpenses(list, { person: 'Mei' }, people).map((e) => e.id)).toEqual(['b', 'c']);
  });
});
