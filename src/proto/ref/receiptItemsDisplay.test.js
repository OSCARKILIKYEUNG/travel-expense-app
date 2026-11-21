import { describe, expect, it } from 'vitest';
import {
  formatRecordedAmount,
  isKnownScan,
  normalizeReceiptItemsForDisplay,
  readExplicitQuantity,
  readFiniteAmount,
  resolveReceiptItemSource,
} from './receiptItemsDisplay';

describe('receipt item display normalizer', () => {
  it('keeps recorded zero and negative prices and does not invent zero', () => {
    expect(readFiniteAmount(0)).toBe(0);
    expect(readFiniteAmount(-30)).toBe(-30);
    expect(readFiniteAmount('1,280.50')).toBe(1280.5);
    expect(readFiniteAmount(' -12 ')).toBe(-12);
    expect(readFiniteAmount('')).toBeNull();
    expect(readFiniteAmount('nope')).toBeNull();
    expect(readFiniteAmount('12px')).toBeNull();
    expect(readFiniteAmount(true)).toBeNull();
    expect(readFiniteAmount(false)).toBeNull();
    expect(readFiniteAmount(Infinity)).toBeNull();
    expect(readFiniteAmount(Number.NaN)).toBeNull();
    expect(formatRecordedAmount(0)).toBe('0');
    expect(formatRecordedAmount(-30)).toBe('-30');
    expect(formatRecordedAmount(1680)).toBe('1,680');
    expect(formatRecordedAmount(null)).toBe('');

    const view = normalizeReceiptItemsForDisplay([
      { name: '零', price: 0 },
      { name: '負', price: -30 },
      { name: '壞', price: 'nope' },
      { price: true },
    ], { lang: 'zh-TW' });
    expect(view.rows.map((row) => row.price)).toEqual([0, -30, null]);
    expect(view.rows[2].name).toBe('壞');
  });

  it('shows an English alias only in English and an explicit positive quantity without multiplying', () => {
    const item = Object.freeze({
      name: '茶',
      name_en: 'Tea',
      original_name: 'お茶',
      price: 220,
      price_actual: 200,
      qty: 2,
    });
    const items = Object.freeze([item]);
    const zh = normalizeReceiptItemsForDisplay(items, { lang: 'zh-TW', scanned: true });
    const en = normalizeReceiptItemsForDisplay(items, { lang: 'en-US', scanned: true });
    expect(zh.rows[0].name).toBe('茶');
    expect(en.rows[0].name).toBe('Tea');
    expect(zh.rows[0].price).toBe(220);
    expect(zh.rows[0].priceActual).toBe(200);
    expect(zh.rows[0].quantity).toBe(2);
    expect(item.price).toBe(220);
    expect(items).toHaveLength(1);

    const namedSet = normalizeReceiptItemsForDisplay([
      { name: 'Shorts set x12', price: 5940 },
    ]);
    expect(namedSet.rows[0].quantity).toBeNull();
    expect(namedSet.rows[0].price).toBe(5940);

    expect(readExplicitQuantity({ quantity: 2, qty: 9 })).toBe(2);
    expect(readExplicitQuantity({ quantity: 0, qty: 3 })).toBe(3);
    expect(readExplicitQuantity({ quantity: 'x', qty: -1 })).toBeNull();
    expect(readExplicitQuantity({ qty: '1.5' })).toBe(1.5);
    expect(readExplicitQuantity({ name: 'x12' })).toBeNull();
  });

  it('labels a supplied actual of zero and ignores an invalid actual', () => {
    const zeroActual = normalizeReceiptItemsForDisplay([
      { name: '零實', price: 10, priceActual: 0, price_actual: 4 },
    ]);
    expect(zeroActual.rows[0].priceActual).toBe(0);
    const snake = normalizeReceiptItemsForDisplay([
      { name: '蛇', price_actual: -2 },
    ]);
    expect(snake.rows[0].price).toBeNull();
    expect(snake.rows[0].priceActual).toBe(-2);
  });

  it('shows the empty scan state only when a scan has no usable lines', () => {
    expect(normalizeReceiptItemsForDisplay([], { scanned: true })).toMatchObject({
      show: true,
      empty: true,
      rows: [],
    });
    expect(normalizeReceiptItemsForDisplay(undefined, { scanned: false })).toMatchObject({
      show: false,
      empty: false,
    });
    expect(normalizeReceiptItemsForDisplay([null, {}, { price: 'abc' }], { scanned: true }).empty).toBe(true);
    const manualLines = normalizeReceiptItemsForDisplay([{ name: '手動', price: 5 }], { scanned: false });
    expect(manualLines.show).toBe(true);
    expect(manualLines.empty).toBe(false);
  });

  it('prefers the saved record over a stale draft and keeps the source currency', () => {
    const savedItems = [{ name: '本體', price: 10 }];
    const resolved = resolveReceiptItemSource({
      initial: {
        id: 'keep',
        currency: 'JPY',
        originalCurrency: 'eur',
        scanned: true,
        items: savedItems,
      },
      scanDraft: { id: 'stale', currency: 'USD', items: [{ name: '過期', price: 9 }] },
      scanToken: 3,
      demoScanned: true,
    });
    expect(resolved.items).toBe(savedItems);
    expect(resolved.currency).toBe('EUR');
    expect(resolved.scanned).toBe(true);
    expect(resolved.identity).toBe('edit:keep');

    const draft = resolveReceiptItemSource({
      scanDraft: { id: 'scan-1', currency: 'jpy', items: [] },
      scanToken: 8,
    });
    expect(draft.scanned).toBe(true);
    expect(draft.currency).toBe('JPY');
    expect(draft.identity).toBe('scan:8');
    expect(resolveReceiptItemSource({ demoScanned: true }).identity).toBe('demo-scan');
    expect(resolveReceiptItemSource({}).scanned).toBe(false);
    expect(isKnownScan({ scanned: false, receiptType: 'tax_inclusive' })).toBe(false);
    expect(isKnownScan({ sourceHash: 'abc' })).toBe(true);
  });
});

describe('formatRecordedAmount preserves recorded magnitude', () => {
  it.each([
    [1.2e-10, '1.2e-10'],
    [-1.23e-20, '-1.23e-20'],
    [1.2e30, '1.2e+30'],
    [-1.2e30, '-1.2e+30'],
    [1e-10, '1e-10'],
    [-1e-10, '-1e-10'],
    [1e30, '1e+30'],
    [-1e30, '-1e+30'],
    [Number.MAX_VALUE, '1.7976931348623157e+308'],
    [-Number.MAX_VALUE, '-1.7976931348623157e+308'],
    [Number.MIN_VALUE, '5e-324'],
    [-Number.MIN_VALUE, '-5e-324'],
  ])('keeps finite scientific value %s as %s', (value, text) => {
    const formatted = formatRecordedAmount(value);
    expect(formatted).toBe(text);
    expect(Number(formatted.replace(/,/g, ''))).toBe(value);
  });

  it.each([
    [0, '0'],
    [-30, '-30'],
    [1680, '1,680'],
    [0.125, '0.125'],
  ])('keeps ordinary recorded formatting %s as %s', (value, text) => {
    const formatted = formatRecordedAmount(value);
    expect(formatted).toBe(text);
    expect(Number(formatted.replace(/,/g, ''))).toBe(value);
  });

  it('keeps negative zero displayed as 0', () => {
    expect(formatRecordedAmount(-0)).toBe('0');
  });
});

describe('readFiniteAmount rejects a repeated sign', () => {
  it.each([
    '+-1',
    '+-0',
    '+-1,200.50',
    ' +-0 ',
    '++1',
    '--1',
    '-+1',
    '++0',
    '--0',
    '+-+1',
    '---1',
    '+--1',
    '++-1',
  ])('rejects malformed sign text %s', (raw) => {
    expect(readFiniteAmount(raw)).toBeNull();
  });

  it.each([
    ['+1', 1],
    ['-1', -1],
    ['+0', 0],
    ['-0', -0],
    ['+1,200.50', 1200.5],
    ['-1,200.50', -1200.5],
    ['1,200.50', 1200.5],
    [' +12.5 ', 12.5],
    [' -12 ', -12],
  ])('keeps a single optional sign in %s', (raw, amount) => {
    expect(Object.is(readFiniteAmount(raw), amount)).toBe(true);
  });

  it('keeps booleans and blank invalid and does not parse scientific text', () => {
    expect(readFiniteAmount(true)).toBeNull();
    expect(readFiniteAmount(false)).toBeNull();
    expect(readFiniteAmount('')).toBeNull();
    expect(readFiniteAmount('   ')).toBeNull();
    expect(readFiniteAmount('1.2e-10')).toBeNull();
    expect(readFiniteAmount('1e+30')).toBeNull();
  });

  it('normalizes a double-signed zero price to null', () => {
    const view = normalizeReceiptItemsForDisplay([
      { name: 'synthetic', price: '+-0' },
      { name: 'mixed', price: '+-1' },
      { name: 'grouped', price: '+-1,200.50' },
    ]);
    expect(view.rows.map((row) => row.price)).toEqual([null, null, null]);
  });
});
