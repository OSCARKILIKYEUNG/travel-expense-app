import { describe, expect, it } from 'vitest';
import { addDays, localISODate, monthGrid, tripDayIndex } from './dates.js';

describe('proto dates (device local)', () => {
  it('formats the local calendar date, not the UTC one', () => {
    expect(localISODate(new Date(2026, 9, 23, 0, 30))).toBe('2026-10-23');
    expect(localISODate(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });
  it('counts trip days from 1 and stops at endDate', () => {
    const trip = { startDate: '2026-10-19', endDate: '2026-10-27' };
    expect(tripDayIndex(trip, '2026-10-19')).toBe(1);
    expect(tripDayIndex(trip, '2026-10-23')).toBe(5);
    expect(tripDayIndex(trip, '2026-10-18')).toBeNull();
    expect(tripDayIndex(trip, '2026-10-28')).toBeNull();
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('builds a Monday-first month grid', () => {
    const weeks = monthGrid('2026-10-15');
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]).toBe('2026-10-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });
});
