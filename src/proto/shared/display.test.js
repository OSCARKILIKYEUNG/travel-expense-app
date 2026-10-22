import { describe, it, expect } from 'vitest';
import { capCellNote, dayCounter, spendOnDate } from './display.js';

const trip = { startDate: '2026-10-19', endDate: '2026-10-27' };

describe('capCellNote', () => {
  it('keeps at most 4 CJK chars', () => {
    expect(capCellNote('抵達成田')).toBe('抵達成田');
    expect(capCellNote('淺草寺與晴空塔')).toBe('淺草寺與');
  });
  it('keeps about 6 Latin letters', () => {
    expect(capCellNote('Shibuya Sky')).toBe('Shibuy');
    expect(capCellNote('Kyoto')).toBe('Kyoto');
  });
  it('handles empty', () => expect(capCellNote(undefined)).toBe(''));
});

describe('dayCounter', () => {
  it('before trip', () => expect(dayCounter(trip, '2026-10-16').label).toBe('倒數 3 日'));
  it('during trip', () => expect(dayCounter(trip, '2026-10-23').label).toBe('第 5 日／共 9 日'));
  it('last day', () => expect(dayCounter(trip, '2026-10-27').label).toBe('第 9 日／共 9 日'));
  it('after trip', () => expect(dayCounter(trip, '2026-11-02').label).toBe('旅程完成，共 9 日'));
});

describe('spendOnDate', () => {
  it('sums HKD for one date', () => {
    expect(spendOnDate([{ date: 'a', hkdAmount: 1.5 }, { date: 'a', hkdAmount: 2 }, { date: 'b', hkdAmount: 9 }], 'a')).toBe(3.5);
  });
});
