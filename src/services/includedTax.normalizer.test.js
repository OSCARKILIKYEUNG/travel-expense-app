import { describe, expect, it } from 'vitest';
import { fromRefExpense } from '../adapters/refDataAdapter';
import {
  commitIncludedTaxDraft,
  createIncludedTaxDraft,
  withIncludedTaxAmountText,
  withIncludedTaxRow,
} from '../domain/includedTax';
import { preparePersistedExpense } from '../notebook/tripRate';
import { buildExpenseFromAI } from './AIService';
import { getEffectiveRefundPositive, getPartialMatchPersonShareOriginal } from '../utils/personShare';

const LAWSON_ROWS = [
  { name: '飯糰', name_en: 'Onigiri', price: 199 },
  { name: '茶', name_en: 'Tea', price: 195 },
  { name: '零食', name_en: 'Snack', price: 181 },
  { name: '便當', name_en: 'Bento', price: 440 },
];

function lawsonRaw(extra = {}) {
  return {
    detected_market: 'JP',
    receipt_type: 'tax_inclusive',
    currency: 'JPY',
    store: '羅森',
    items: LAWSON_ROWS,
    subtotal: 1015,
    tax: 0,
    tax_refund: 0,
    discount: 0,
    total_amount: 1015,
    ...extra,
  };
}

const PRINTED_BREAKDOWN = [
  { rate_percent: 10, target_amount: 440, basis: 'gross', included_tax_amount: 40 },
  { rate_percent: 8, target_amount: 575, basis: 'gross', included_tax_amount: 42 },
];

describe('included tax stays informational on the synthetic LAWSON receipt', () => {
  it('keeps printed 82 and mixed-rate rows without repricing 1015', () => {
    const expense = buildExpenseFromAI(
      lawsonRaw({ included_tax_amount: 82, included_tax_breakdown: PRINTED_BREAKDOWN }),
      0,
      'JPY',
      20,
      'JPY',
    );

    expect(expense.items.map((item) => item.price)).toEqual([199, 195, 181, 440]);
    expect(expense.subtotal).toBe(1015);
    expect(expense.originalAmount).toBe(1015);
    expect(expense.tax).toBe(0);
    expect(expense.taxRefund).toBe(0);
    expect(expense.discount).toBe(0);
    expect(expense.hkdAmount).toBe(1015 / 20);
    expect(expense.originalAmount).not.toBe(1097);
    expect(expense.subtotal).not.toBe(933);
    expect(expense.includedTaxAmount).toBe(82);
    expect(expense.includedTaxBreakdown).toEqual([
      { ratePercent: 10, targetAmount: 440, basis: 'gross', includedTaxAmount: 40 },
      { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
    ]);
  });

  it('does not invent included tax from generic tax, including a legacy positive inclusive tax', () => {
    const unseen = buildExpenseFromAI(lawsonRaw({ tax: 82 }), 0, 'JPY', 1, 'JPY');
    expect(unseen.tax).toBe(82);
    expect(unseen.originalAmount).toBe(1015);
    expect(unseen.includedTaxAmount).toBeUndefined();
    expect(unseen.includedTaxBreakdown).toBeUndefined();

    const legacyPositive = buildExpenseFromAI(
      {
        receipt_type: 'tax_inclusive',
        items: [
          { name: '炸雞塊', price: 1380 },
          { name: '茶', price: 160 },
          { name: '飯糰', price: 819 },
        ],
        subtotal: 2149,
        tax: 210,
        total_amount: 2359,
      },
      0,
      'JPY',
      1,
      'JPY',
    );
    expect(legacyPositive.tax).toBe(210);
    expect(legacyPositive.originalAmount).toBe(2359);
    expect(legacyPositive.includedTaxAmount).toBeUndefined();
    expect(legacyPositive.includedTaxBreakdown).toBeUndefined();
  });

  it('keeps printed included tax when generic inclusive tax is safety-zeroed', () => {
    const expense = buildExpenseFromAI(
      {
        receipt_type: 'tax_inclusive',
        items: [{ name: '品項', price: 1076 }],
        subtotal: 1076,
        tax: 92,
        total_amount: 2359,
        included_tax_amount: 92,
        included_tax_breakdown: [
          { rate_percent: 8, target_amount: 278, basis: 'gross', included_tax_amount: 20 },
          { rate_percent: 10, target_amount: 798, basis: 'gross', included_tax_amount: 72 },
        ],
      },
      0,
      'JPY',
      1,
      'JPY',
    );
    expect(expense.tax).toBe(0);
    expect(expense.originalAmount).toBe(2359);
    expect(expense.subtotal).toBe(2359);
    expect(expense.includedTaxAmount).toBe(92);
    expect(expense.includedTaxBreakdown[0].includedTaxAmount).toBe(20);
    expect(expense.includedTaxBreakdown[1].includedTaxAmount).toBe(72);
  });

  it('distinguishes omitted, zero, and explicit null, and does not recompute a mismatched printed tax', () => {
    const omitted = buildExpenseFromAI(lawsonRaw(), 0, 'JPY', 1, 'JPY');
    const zero = buildExpenseFromAI(lawsonRaw({ included_tax_amount: 0, included_tax_breakdown: [] }), 0, 'JPY', 1, 'JPY');
    const cleared = buildExpenseFromAI(
      lawsonRaw({ included_tax_amount: null, included_tax_breakdown: [] }),
      0,
      'JPY',
      1,
      'JPY',
    );
    const mismatched = buildExpenseFromAI(
      lawsonRaw({
        included_tax_amount: 82,
        included_tax_breakdown: [
          { rate_percent: 10, target_amount: 440, basis: 'gross', included_tax_amount: 41 },
          { rate_percent: 8, target_amount: 575, basis: 'gross', included_tax_amount: 42 },
        ],
      }),
      0,
      'JPY',
      1,
      'JPY',
    );

    expect(omitted.includedTaxAmount).toBeUndefined();
    expect(omitted.includedTaxBreakdown).toBeUndefined();
    expect(zero.includedTaxAmount).toBe(0);
    expect(zero.includedTaxBreakdown).toEqual([]);
    expect(cleared.includedTaxAmount).toBeNull();
    expect(cleared.includedTaxBreakdown).toEqual([]);
    expect(mismatched.includedTaxBreakdown[0].includedTaxAmount).toBe(41);
    expect(mismatched.includedTaxAmount).toBe(82);
    expect(mismatched.originalAmount).toBe(1015);
  });

  it('does not add included tax into refund or person share', () => {
    const expense = buildExpenseFromAI(
      lawsonRaw({ included_tax_amount: 82, included_tax_breakdown: PRINTED_BREAKDOWN }),
      0,
      'JPY',
      1,
      'JPY',
    );
    expense.assignedTo = 'Oscar';
    expect(getEffectiveRefundPositive(expense)).toBe(0);
    expect(getPartialMatchPersonShareOriginal(expense, 'Oscar')).toBe(1015);
  });
});

describe('included tax clear replaces scanBase instead of resurrecting', () => {
  it('persists explicit null and [] over a scanned base and leaves generic tax alone', () => {
    const scanBase = buildExpenseFromAI(
      lawsonRaw({ included_tax_amount: 82, included_tax_breakdown: PRINTED_BREAKDOWN, tax: 0 }),
      0,
      'JPY',
      20,
      'JPY',
    );
    const { record } = preparePersistedExpense(
      {
        amount: '1015',
        store: '羅森',
        currency: 'JPY',
        includedTaxAmount: null,
        includedTaxBreakdown: [],
      },
      { scanBase, tripCurrency: 'JPY', exchangeRates: { JPY: 20, HKD: 1 } },
    );

    expect(record.originalAmount).toBe(1015);
    expect(record.hkdAmount).toBe(1015 / 20);
    expect(record.tax).toBe(0);
    expect(record.includedTaxAmount).toBeNull();
    expect(record.includedTaxBreakdown).toEqual([]);
    expect(record.subtotal).toBe(1015);
  });

  it('keeps an omitted field unknown while an explicit zero stays zero', () => {
    const base = { originalAmount: 10, tax: 4, includedTaxAmount: 3, includedTaxBreakdown: [{ ratePercent: 10, targetAmount: 10, basis: 'gross', includedTaxAmount: 1 }] };
    const omitted = fromRefExpense({ amount: '10', store: '店' }, { existing: base });
    const zero = fromRefExpense(
      { amount: '10', store: '店', includedTaxAmount: 0, includedTaxBreakdown: [] },
      { existing: base },
    );
    expect(omitted.includedTaxAmount).toBe(3);
    expect(omitted.tax).toBe(4);
    expect(zero.includedTaxAmount).toBe(0);
    expect(zero.includedTaxBreakdown).toEqual([]);
    expect(zero.tax).toBe(4);
  });
});

describe('included tax drafts copy printed text and do not recompute it', () => {
  it('keeps an untouched source immutable and leaves a blank row tax blank', () => {
    const source = {
      includedTaxAmount: 82,
      includedTaxBreakdown: [
        { ratePercent: 10, targetAmount: 440, basis: 'gross', includedTaxAmount: 40 },
      ],
    };
    const draft = createIncludedTaxDraft(source);
    const typed = withIncludedTaxAmountText(draft, '8.');
    const blankTax = withIncludedTaxRow(typed, typed.rows[0].key, 'taxText', '');
    const committed = commitIncludedTaxDraft(blankTax);

    expect(draft.amount.text).toBe('82');
    expect(source.includedTaxAmount).toBe(82);
    expect(source.includedTaxBreakdown[0].includedTaxAmount).toBe(40);
    expect(typed.amount.text).toBe('8.');
    expect(committed.ok).toBe(true);
    expect(committed.patch.includedTaxAmount).toBe(8);
    expect(committed.patch.includedTaxBreakdown[0].ratePercent).toBe(10);
    expect(committed.patch.includedTaxBreakdown[0].targetAmount).toBe(440);
    expect(committed.patch.includedTaxBreakdown[0].includedTaxAmount).toBeUndefined();
    expect(committed.patch.includedTaxBreakdown[0].includedTaxAmount).not.toBe(40);
  });

  it('accepts camelCase aliases without turning them into generic tax', () => {
    const expense = buildExpenseFromAI(
      lawsonRaw({
        tax: 0,
        includedTaxAmount: 82,
        includedTaxBreakdown: [
          { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
        ],
      }),
      0,
      'JPY',
      1,
      'JPY',
    );
    expect(expense.tax).toBe(0);
    expect(expense.includedTaxAmount).toBe(82);
    expect(expense.includedTaxBreakdown).toEqual([
      { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
    ]);
  });
});
