import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from '../../api/receipt-prompt/index.js';
import { USER_TEXT } from '../../api/receipt-prompt/user-text.js';
import { buildExpenseFromAI, dropDuplicateSetComponents } from './AIService.js';

const base = [
  { name: '修身奇諾褲', price: 3990 },
  { name: '休閒牛仔褲', price: 3990 },
  { name: '圓領T恤', price: 1990 },
];
const rest = [790, 990, 790, 2290, 2290, 1990, 790, 2290].map((price, i) => ({ name: `其他${i}`, price }));
const setLine = { name: '女士內褲 套裝×12', original_name: 'Wショーツ セット×12', price: 5940 };
const comps = Array.from({ length: 12 }, () => ({ name: '女士內褲', price: 590 }));
const uniqlo = (items) => ({
  detected_market: 'JP',
  receipt_type: 'instant_tax_free',
  has_bundle: true,
  items,
  subtotal: 28130,
  tax_refund: -2557,
  total_amount: 25573,
});
const build = (r) => buildExpenseFromAI(r, 0, 'JPY', 1, 'JPY');

describe('set/multipack prompt rules', () => {
  it('base prompt states set + components = one item and sum check', () => {
    expect(SYSTEM_PROMPT).toContain('套裝／multipack 規則');
    expect(SYSTEM_PROMPT).toContain('只算一個品項');
    expect(SYSTEM_PROMPT).toContain('絕對不可');
    expect(SYSTEM_PROMPT).toContain('輸出前自我檢查');
    expect(SYSTEM_PROMPT).toContain('免稅／折扣扣除**之前**');
  });
  it('example C shows real layout, wrong output and sum 28,130', () => {
    expect(SYSTEM_PROMPT).toContain('之後才出現一行「<セット金額> 12点 ¥5,940」');
    expect(SYSTEM_PROMPT).toContain('套裝 5940 + 12 行 590（多出 7,080，加總 35,210）');
    expect(SYSTEM_PROMPT).toContain('items 加總必須 = 28,130');
    expect(SYSTEM_PROMPT).toContain('subtotal 必須是 28130');
  });
  it('user text reminds about component lines', () => {
    expect(USER_TEXT).toContain('成分行');
  });
});

describe('dropDuplicateSetComponents', () => {
  it('drops 12x590 when set line present and excess is exactly 7080 (via buildExpenseFromAI)', () => {
    const e = build(uniqlo([...base, setLine, ...comps, ...rest]));
    expect(e.items).toHaveLength(12);
    expect(e.items.reduce((s, i) => s + i.price, 0)).toBe(28130);
    expect(e.subtotal).toBe(28130);
    expect(e.taxRefund ?? e.tax_refund).toBeDefined();
  });
  it('keeps totals untouched', () => {
    const a = build(uniqlo([...base, setLine, ...rest]));
    const b = build(uniqlo([...base, setLine, ...comps, ...rest]));
    expect(b.subtotal).toBe(a.subtotal);
    expect(b.amount ?? b.originalAmount).toBe(a.amount ?? a.originalAmount);
  });
  it('no-op when sum already matches', () => {
    const items = [...base, setLine, ...rest].map((i) => ({ ...i }));
    expect(dropDuplicateSetComponents(items, 28130).removed).toHaveLength(0);
  });
  it('no-op without a set line', () => {
    const items = [...base, ...comps, ...rest];
    expect(dropDuplicateSetComponents(items, 28130 - 5940).removed).toHaveLength(0);
  });
  it('no-op when count of identical lines differs from N', () => {
    const items = [...base, setLine, ...comps.slice(0, 11), ...rest];
    expect(dropDuplicateSetComponents(items, 28130).removed).toHaveLength(0);
  });
  it('no-op when excess does not equal N*p', () => {
    const items = [...base, setLine, ...comps, ...rest];
    expect(dropDuplicateSetComponents(items, 28130 + 100).removed).toHaveLength(0);
  });
  it('works for English "set x3"', () => {
    const items = [
      { name: 'Socks set x3', price: 1000 },
      { name: 'Sock', price: 400 },
      { name: 'Sock', price: 400 },
      { name: 'Sock', price: 400 },
      { name: 'Hat', price: 500 },
    ];
    const r = dropDuplicateSetComponents(items, 1500);
    expect(r.items.map((i) => i.name)).toEqual(['Socks set x3', 'Hat']);
  });
  it('does not mutate input', () => {
    const items = [...base, setLine, ...comps, ...rest];
    const n = items.length;
    dropDuplicateSetComponents(items, 28130);
    expect(items).toHaveLength(n);
  });
});
