import { describe, expect, it } from 'vitest';
import { createRefTrip, monthGridSunday, REF_TODAY } from './mockRefTrip';
import { capCellNote, dayCounter, spendOnDate } from '../shared/display';

describe('reference mock trip', () => {
  const trip = createRefTrip();
  it('matches the reference totals', () => {
    expect(trip.expenses).toHaveLength(17);
    expect(trip.expenses.reduce((s, e) => s + e.originalAmount, 0)).toBe(213352);
    expect(trip.expenses.reduce((s, e) => s + e.hkdAmount, 0)).toBe(11222);
    expect(spendOnDate(trip.expenses, REF_TODAY)).toBe(1086);
    expect(trip.expenses.filter((e) => !e.date)).toHaveLength(1);
  });
  it('shows Day 5 of 10 on 10/22', () => {
    expect(dayCounter(trip, REF_TODAY).label).toBe('第 5 日／共 10 日');
  });
  it('keeps every cell note within the 4-CJK cap', () => {
    for (const d of Object.values(trip.days)) expect(capCellNote(d.note)).toBe(d.note);
  });
  it('builds a Sunday-first October 2026 grid with adjacent days', () => {
    const w = monthGridSunday('2026-10-01');
    expect(w[0][0]).toEqual({ iso: '2026-09-27', inMonth: false });
    expect(w[0][4]).toEqual({ iso: '2026-10-01', inMonth: true });
    expect(w).toHaveLength(5);
    expect(w[4][6].iso).toBe('2026-10-31');
  });
});
