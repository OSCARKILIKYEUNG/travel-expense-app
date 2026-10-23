import { describe, expect, it } from 'vitest';
import { expenseRecordedAt, expenseTimeMinutes, sortExpenses } from './date';

describe('expenseTimeMinutes', () => {
  it('parses H:MM and HH:MM (trimmed, 00:00..23:59) from time or receiptTime fallback', () => {
    expect(expenseTimeMinutes({ time: '00:00' })).toBe(0);
    expect(expenseTimeMinutes({ time: '9:05' })).toBe(545);
    expect(expenseTimeMinutes({ time: ' 18:30 ' })).toBe(1110);
    expect(expenseTimeMinutes({ time: '23:59' })).toBe(1439);
    expect(expenseTimeMinutes({ receiptTime: '12:10' })).toBe(730);
    expect(expenseTimeMinutes({ time: '', receiptTime: '08:15' })).toBe(495);
  });

  it('returns null for invalid or missing times', () => {
    expect(expenseTimeMinutes({ time: '25:00' })).toBeNull();
    expect(expenseTimeMinutes({ time: '24:00' })).toBeNull();
    expect(expenseTimeMinutes({ time: '12:60' })).toBeNull();
    expect(expenseTimeMinutes({ time: '9:5' })).toBeNull();
    expect(expenseTimeMinutes({ time: 'abc' })).toBeNull();
    expect(expenseTimeMinutes({ time: '' })).toBeNull();
    expect(expenseTimeMinutes({})).toBeNull();
    expect(expenseTimeMinutes(null)).toBeNull();
  });
});

describe('expenseRecordedAt', () => {
  it('prefers finite Date.parse(createdAt), then numeric id >= 1e12, then 13-digit run in id, else -Infinity', () => {
    expect(expenseRecordedAt({ createdAt: '2026-10-22T10:00:00.000Z' })).toBe(
      Date.parse('2026-10-22T10:00:00.000Z'),
    );
    expect(expenseRecordedAt({ id: 1729600000123 })).toBe(1729600000123);
    expect(expenseRecordedAt({ id: 'exp-1729600000456' })).toBe(1729600000456);
    expect(expenseRecordedAt({ id: 'n1729600000789' })).toBe(1729600000789);
    expect(expenseRecordedAt({ id: 'r15' })).toBe(-Infinity);
    expect(expenseRecordedAt({ id: 42 })).toBe(-Infinity);
    expect(expenseRecordedAt({ createdAt: 'not-a-date', id: 'r1' })).toBe(-Infinity);
    expect(expenseRecordedAt(null)).toBe(-Infinity);
  });
});

describe('sortExpenses', () => {
  it('orders dates newest first across ISO and zh-TW formats', () => {
    const input = [
      { id: 'd1', date: '2026-10-18', hkdAmount: 500 },
      { id: 'd3', date: '2026-10-22', hkdAmount: 100 },
      { id: 'd2', date: '2026年10月20日', hkdAmount: 300 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual(['d3', 'd2', 'd1']);
  });

  it('orders same-day timed expenses by time descending', () => {
    const input = [
      { id: 'a', date: '2026-10-22', time: '09:40', hkdAmount: 263 },
      { id: 'b', date: '2026-10-22', time: '18:30', hkdAmount: 389 },
      { id: 'c', date: '2026-10-22', time: '12:10', hkdAmount: 434 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('orders same-day untimed expenses by createdAt descending', () => {
    const input = [
      { id: 'r1', date: '2026-10-20', createdAt: '2026-10-20T08:00:00.000Z', hkdAmount: 900 },
      { id: 'r2', date: '2026-10-20', createdAt: '2026-10-20T14:00:00.000Z', hkdAmount: 10 },
      { id: 'r3', date: '2026-10-20', createdAt: '2026-10-20T11:00:00.000Z', hkdAmount: 500 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('orders same-day untimed expenses by id-embedded 13-digit timestamp (exp-1729…, n1729…, numeric)', () => {
    const input = [
      { id: 'exp-1729600000100', date: '2026-10-20', hkdAmount: 999 },
      { id: 1729600000300, date: '2026-10-20', hkdAmount: 1 },
      { id: 'n1729600000200', date: '2026-10-20', hkdAmount: 50 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual([
      1729600000300,
      'n1729600000200',
      'exp-1729600000100',
    ]);
  });

  it('orders same-day untimed expenses without timestamps by original input index descending', () => {
    const input = [
      { id: 'r8', date: '2026-10-20', hkdAmount: 359 },
      { id: 'r9', date: '2026-10-20', hkdAmount: 1920 },
      { id: 'r10', date: '2026-10-20', hkdAmount: 263 },
      { id: 'r11', date: '2026-10-20', hkdAmount: 941 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual(['r11', 'r10', 'r9', 'r8']);
  });

  it('places timed items before untimed items on the same day, including 00:00, and treats invalid times as untimed', () => {
    const input = [
      { id: 'u-old', date: '2026-10-22', time: '', hkdAmount: 10 },
      { id: 'u-bad1', date: '2026-10-22', time: '25:00', hkdAmount: 20 },
      { id: 't-midnight', date: '2026-10-22', time: '00:00', hkdAmount: 30 },
      { id: 'u-bad2', date: '2026-10-22', time: 'abc', hkdAmount: 40 },
      { id: 't-noon', date: '2026-10-22', time: '12:00', hkdAmount: 50 },
    ];
    expect(sortExpenses(input).map((e) => e.id)).toEqual([
      't-noon',
      't-midnight',
      'u-bad2',
      'u-bad1',
      'u-old',
    ]);
  });

  it('does not mutate the input array and ignores hkdAmount for ordering', () => {
    const input = [
      { id: 'first', date: '2026-10-21', hkdAmount: 9999 },
      { id: 'second', date: '2026-10-21', hkdAmount: 1 },
      { id: 'third', date: '2026-10-21', hkdAmount: 500 },
    ];
    const snapshot = [...input];
    const sorted = sortExpenses(input);
    expect(sorted).not.toBe(input);
    expect(input).toEqual(snapshot);
    expect(sorted.map((e) => e.id)).toEqual(['third', 'second', 'first']);
  });
});
