import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from '../../api/receipt-prompt/index.js';
import {
  buildExpenseFromAI,
  shouldShowListSubtotal,
  shouldShowSeparateDiscount,
  sumForInstantTaxFreeCheck,
} from './AIService.js';

function fromAI(result) {
  return buildExpenseFromAI(result, 0, 'JPY', 1, 'JPY');
}

describe('JP prompt — E2 exemption and A inclusive multi-rate', () => {
  it('tells the model a 免税 row is exemption, never tax, on 免税取引', () => {
    expect(SYSTEM_PROMPT).toContain('免税取引');
    expect(SYSTEM_PROMPT).toContain('絕不是');
    expect(SYSTEM_PROMPT).toContain('receipt_tax_exemption_amount: 609');
    expect(SYSTEM_PROMPT).toContain('禁止 tax: 609');
    expect(SYSTEM_PROMPT).toContain('total_amount: 6093');
    expect(SYSTEM_PROMPT).toContain('tax: 0, tax_refund: 0');
  });

  it('anchors LAWSON inclusive totals on 合計 and forbids generic item names', () => {
    expect(SYSTEM_PROMPT).toContain('total_amount: 2359');
    expect(SYSTEM_PROMPT).toContain('subtotal: 2359');
    expect(SYSTEM_PROMPT).toContain('tax: 0, total_amount: 2359');
    expect(SYSTEM_PROMPT).toContain('錨定「合計」');
    expect(SYSTEM_PROMPT).toContain('禁止 total_amount = subtotal + tax');
    expect(SYSTEM_PROMPT).toContain('禁止 subtotal 1076、tax 92');
    expect(SYSTEM_PROMPT).toContain('禁止改成「食品」「飲料」「商品」「日用品」');
    expect(SYSTEM_PROMPT).toContain('是已含在合計裡的摘要，不是新的品項');
    expect(SYSTEM_PROMPT).toContain('禁止改成「商品A」');
    expect(SYSTEM_PROMPT).toContain('抄寫收據該行印出的文字');
    expect(SYSTEM_PROMPT).toContain('不要當成細項與實付不一致');
  });

  it('leaves B/C/D/E example figures in place', () => {
    expect(SYSTEM_PROMPT).toContain('subtotal: 2680, tax: 268, total_amount: 2948, tax_refund: 0');
    expect(SYSTEM_PROMPT).toContain('subtotal: 20576, total_amount: 18732, tax_refund: -1844');
    expect(SYSTEM_PROMPT).toContain('セット金額 ¥5,940');
    expect(SYSTEM_PROMPT).toContain('items 加總應 ≈ 28,130');
    expect(SYSTEM_PROMPT).toContain('receipt_tax_exemption_amount: 1034');
    expect(SYSTEM_PROMPT).toContain('vat_refund_later');
    expect(SYSTEM_PROMPT).toContain('tax_refund 只填 -2557');
    expect(SYSTEM_PROMPT).toContain('discount 必須為 0');
    expect(SYSTEM_PROMPT).toContain('不要改成實付 25573');
    expect(SYSTEM_PROMPT).toContain('不要改成實付 18732');
    expect(SYSTEM_PROMPT).toContain('加總核對時排除該行');
  });
});

describe('buildExpenseFromAI — E2 Donki net_tax_free', () => {
  it('moves a 609 misread as 消費税 into the exemption and keeps tax at 0', () => {
    const expense = fromAI({
      detected_market: 'JP',
      receipt_type: 'net_tax_free',
      currency: 'JPY',
      items: [
        { name: '零食', name_en: 'Snack', price: 1280 },
        { name: '飲料', name_en: 'Drink', price: 2980 },
        { name: '雜貨', name_en: 'Goods', price: 1833 },
      ],
      subtotal: 6093,
      tax: 609,
      total_amount: 6093,
      tax_refund: 0,
    });

    expect(expense.receiptType).toBe('net_tax_free');
    expect(expense.tax).toBe(0);
    expect(expense.taxRefund).toBe(0);
    expect(expense.receiptTaxExemptionAmount).toBe(609);
    expect(expense.originalAmount).toBe(6093);
    expect(expense.subtotal).toBe(6093);
    expect(expense.originalAmount).not.toBe(6093 + 609);
  });

  it('keeps a correct exemption and does not touch Matsukiyo (E)', () => {
    const donki = fromAI({
      receipt_type: 'net_tax_free',
      items: [{ name: '零食', name_en: 'Snack', price: 6093 }],
      tax: 0,
      total_amount: 6093,
      receipt_tax_exemption_amount: 609,
    });
    expect(donki.tax).toBe(0);
    expect(donki.receiptTaxExemptionAmount).toBe(609);
    expect(donki.originalAmount).toBe(6093);

    const matsukiyo = fromAI({
      receipt_type: 'net_tax_free',
      items: [{ name: '藥妝', name_en: 'Drugstore item', price: 10340 }],
      subtotal: 10340,
      tax: 0,
      tax_refund: 0,
      total_amount: 10340,
      receipt_tax_exemption_amount: 1034,
    });
    expect(matsukiyo.tax).toBe(0);
    expect(matsukiyo.taxRefund).toBe(0);
    expect(matsukiyo.receiptTaxExemptionAmount).toBe(1034);
    expect(matsukiyo.originalAmount).toBe(10340);
    expect(matsukiyo.subtotal).toBe(10340);
  });
});

describe('buildExpenseFromAI — A LAWSON tax-inclusive multi-rate', () => {
  it('drops the 1076+92 reconstruction and anchors subtotal on 合計', () => {
    const expense = fromAI({
      detected_market: 'JP',
      receipt_type: 'tax_inclusive',
      currency: 'JPY',
      items: [
        { name: '炸雞塊', name_en: 'Karaage-kun', price: 148 },
        { name: '茶', name_en: 'Tea', price: 220 },
        { name: '飯糰', name_en: 'Onigiri', price: 398 },
        { name: '口香糖', name_en: 'Gum', price: 130 },
        { name: '布丁', name_en: 'Pudding', price: 180 },
      ],
      subtotal: 1076,
      tax: 92,
      total_amount: 2359,
      tax_refund: 0,
    });

    expect(expense.items.map((item) => item.name)).toEqual(['炸雞塊', '茶', '飯糰', '口香糖', '布丁']);
    expect(expense.receiptType).toBe('tax_inclusive');
    expect(expense.subtotal).toBe(2359);
    expect(expense.tax).toBe(0);
    expect(expense.originalAmount).toBe(2359);
    expect(expense.originalAmount).not.toBe(1076 + 92);
    expect(expense.needsReview).toBeUndefined();
  });

  it('drops 対象額/内税 summary rows, keeps printed names, and does not warn', () => {
    const expense = fromAI({
      detected_market: 'JP',
      receipt_type: 'tax_inclusive',
      currency: 'JPY',
      items: [
        { name: '商品A', original_name: 'からあげくん', name_en: 'Karaage-kun', price: 148 },
        { name: 'お茶', name_en: 'Tea', price: 220 },
        { name: 'おにぎり', name_en: 'Onigiri', price: 398 },
        { name: 'ガム', name_en: 'Gum', price: 130 },
        { name: 'プリン', name_en: 'Pudding', price: 180 },
        { name: '8%対象額', name_en: '8% taxable amount', price: 278 },
        { name: '内消費税(8%)', name_en: 'Tax included 8%', price: 20 },
        { name: '(10%)対象額', name_en: '10% taxable amount', price: 798 },
        { name: '内消費税(10%)', name_en: 'Tax included 10%', price: 72 },
      ],
      subtotal: 1076,
      tax: 92,
      total_amount: 2359,
      tax_refund: 0,
    });

    expect(expense.items.map((item) => item.name)).toEqual([
      'からあげくん', 'お茶', 'おにぎり', 'ガム', 'プリン',
    ]);
    expect(expense.items.some((item) => /^商品[A-E]$/.test(item.name))).toBe(false);
    expect(expense.subtotal).toBe(2359);
    expect(expense.tax).toBe(0);
    expect(expense.originalAmount).toBe(2359);
    expect(expense.needsReview).toBeUndefined();
  });

  it('keeps an 内税 summary when inclusive lines already sum to 合計', () => {
    const expense = fromAI({
      detected_market: 'JP',
      receipt_type: 'tax_inclusive',
      currency: 'JPY',
      items: [
        { name: '炸雞塊', name_en: 'Karaage-kun', price: 1380 },
        { name: '茶', name_en: 'Tea', price: 160 },
        { name: '飯糰', name_en: 'Onigiri', price: 819 },
      ],
      subtotal: 2149,
      tax: 210,
      total_amount: 2359,
      tax_refund: 0,
    });

    expect(expense.items.map((item) => item.name)).toEqual(['炸雞塊', '茶', '飯糰']);
    expect(expense.subtotal).toBe(2359);
    expect(expense.tax).toBe(210);
    expect(expense.originalAmount).toBe(2359);
    expect(expense.originalAmount).not.toBe(expense.subtotal + expense.tax);
    expect(expense.needsReview).toBeUndefined();
  });
});

describe('buildExpenseFromAI — B/C/D/G unchanged', () => {
  it('still derives exclusive tax from 合計 − 小計 (B)', () => {
    const expense = fromAI({
      receipt_type: 'tax_exclusive',
      items: [
        { name: '品項A', name_en: 'A', price: 850 },
        { name: '品項B', name_en: 'B', price: 1800 },
        { name: '品項C', name_en: 'C', price: 30 },
      ],
      subtotal: 2680,
      total_amount: 2948,
    });
    expect(expense.subtotal).toBe(2680);
    expect(expense.tax).toBe(268);
    expect(expense.originalAmount).toBe(2948);
    expect(expense.taxRefund).toBe(0);
    expect(expense.receiptTaxExemptionAmount).toBeUndefined();
  });

  it('keeps instant tax-free refund (C) and later VAT refund (G)', () => {
    const uniqlo = fromAI({
      receipt_type: 'instant_tax_free',
      has_bundle: true,
      items: [{ name: '女士內褲 セット×12', name_en: 'Shorts set x12', price: 5940 }],
      subtotal: 28130,
      total_amount: 25573,
      tax_refund: -2557,
    });
    expect(uniqlo.taxRefund).toBe(-2557);
    expect(uniqlo.originalAmount).toBe(25573);
    expect(uniqlo.subtotal).toBe(28130);

    const duplicated = fromAI({
      receipt_type: 'instant_tax_free',
      has_bundle: true,
      items: [
        { name: '女士內褲 セット×12', name_en: 'Shorts set x12', price: 5940 },
        { name: '襪子', name_en: 'Socks', price: 1990 },
        { name: 'T恤', name_en: 'T-shirt', price: 990 },
        { name: '外套', name_en: 'Jacket', price: 19210 },
      ],
      subtotal: 25573,
      total_amount: 25573,
      tax_refund: -2557,
      discount: -2557,
      tax: 2557,
    });
    expect(duplicated.items.map((item) => item.name)).toEqual([
      '女士內褲 セット×12', '襪子', 'T恤', '外套',
    ]);
    expect(duplicated.items.filter((item) => /セット/.test(item.name))).toHaveLength(1);
    expect(duplicated.subtotal).toBe(28130);
    expect(duplicated.originalAmount).toBe(25573);
    expect(duplicated.taxRefund).toBe(-2557);
    expect(duplicated.discount).toBe(0);
    expect(duplicated.tax).toBe(0);
    expect(duplicated.needsReview).toBeUndefined();
    expect(shouldShowSeparateDiscount(duplicated)).toBe(false);
    expect(shouldShowSeparateDiscount(
      { currency: 'JPY', discount: -2557, taxRefund: 0 },
      2557,
    )).toBe(false);
    expect(shouldShowSeparateDiscount(
      { currency: 'JPY', discount: -500, taxRefund: -2557 },
      2557,
    )).toBe(true);
    expect(shouldShowListSubtotal(duplicated)).toBe(true);

    const later = fromAI({
      receipt_type: 'vat_refund_later',
      items: [{ name: '包', name_en: 'Bag', price: 55000 }],
      subtotal: 55000,
      tax: 0,
      tax_refund: 0,
      total_amount: 55000,
    });
    expect(later.receiptType).toBe('vat_refund_later');
    expect(later.originalAmount).toBe(55000);
    expect(later.taxRefund).toBe(0);
    expect(later.tax).toBe(0);
  });

  it('keeps ZARA dual prices and the printed refund (D)', () => {
    const expense = fromAI({
      receipt_type: 'instant_tax_free',
      items: [
        { name: '西裝外套', name_en: 'Blazer', price: 6590, price_actual: 5991 },
        { name: '外套', name_en: 'Jacket', price: 7690, price_actual: 6991 },
        { name: 'GB 佣金', name_en: 'GB commission', price: 286, price_actual: 286, exclude_from_refund_split: true },
      ],
      subtotal: 20576,
      total_amount: 18732,
      tax_refund: -1844,
    });
    expect(expense.originalAmount).toBe(18732);
    expect(expense.taxRefund).toBe(-1844);
    expect(expense.subtotal).toBe(20576);
    expect(expense.items[0].priceActual).toBe(5991);
    expect(expense.items[1].priceActual).toBe(6991);
    expect(expense.items[2].excludeFromRefundSplit).toBe(true);
    expect(expense.needsReview).toBeUndefined();
    expect(sumForInstantTaxFreeCheck(expense.items)).toBe(5991 + 6991);
    expect(shouldShowListSubtotal(expense)).toBe(true);
  });

  it('restores ZARA subtotal 20576 when the model copied the paid total', () => {
    const expense = fromAI({
      receipt_type: 'instant_tax_free',
      items: [
        { name: 'BLAZER', name_en: 'Blazer', price: 6590, price_actual: 5991 },
        { name: 'JACKET', name_en: 'Jacket', price: 7690, price_actual: 6991 },
        { name: 'GB 佣金', name_en: 'GB commission', price: 286, price_actual: 286, exclude_from_refund_split: true },
      ],
      subtotal: 18732,
      total_amount: 18732,
      tax_refund: -1844,
    });
    expect(expense.subtotal).toBe(20576);
    expect(expense.originalAmount).toBe(18732);
    expect(expense.taxRefund).toBe(-1844);
    expect(expense.items[0].priceActual).toBe(5991);
    expect(expense.items[1].priceActual).toBe(6991);
    expect(expense.items[2].excludeFromRefundSplit).toBe(true);
    expect(expense.items[2].priceActual).toBeUndefined();
    expect(sumForInstantTaxFreeCheck(expense.items)).toBe(5991 + 6991);
    expect(expense.needsReview).toBeUndefined();
    expect(shouldShowListSubtotal(expense)).toBe(true);
  });

  it('does not let GB commission fail the instant tax-free sum check', () => {
    const expense = fromAI({
      receipt_type: 'instant_tax_free',
      items: [
        { name: '西裝外套', name_en: 'Blazer', price: 10000, price_actual: 9000 },
        { name: '外套', name_en: 'Jacket', price: 11000, price_actual: 9732 },
        { name: 'GB 佣金', name_en: 'GB commission', price: 5000, exclude_from_refund_split: true },
      ],
      subtotal: 18732,
      total_amount: 20000,
      tax_refund: 0,
    });
    expect(sumForInstantTaxFreeCheck(expense.items)).toBe(18732);
    expect(expense.needsReview).toBeUndefined();
    expect(expense.items[2].excludeFromRefundSplit).toBe(true);
  });
});
