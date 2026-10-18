import { describe, it, expect } from 'vitest';
import {
  normalizeDate, normalizeStoreName, storesMatch, compareExpenses, findDuplicateOf,
  splitBatchByDuplicates, detectDuplicates, isUserEdited,
} from './duplicates';

const item = (name, price = 100) => ({ name, price });
const lawson = (o = {}) => ({
  id: 1, date: '2026年10月18日', store: '羅森', storeOriginal: 'ローソン', storeEn: 'Lawson',
  items: [item('a'), item('b'), item('c')], subtotal: 1080, originalAmount: 1080, currency: 'JPY', ...o,
});

describe('normalizeDate', () => {
  it.each([
    ['2026年10月19日', '2026-10-19'],
    ['2026/10/19', '2026-10-19'],
    ['2026/1/9', '2026-01-09'],
    ['2026-10-19', '2026-10-19'],
    ['2026.10.19 14:32', '2026-10-19'],
    ['19/10/2026', '2026-10-19'],
    ['２０２６年１０月１９日', '2026-10-19'],
  ])('%s', (input, out) => expect(normalizeDate(input)).toBe(out));
  it('invalid -> null', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
    expect(normalizeDate('yesterday')).toBeNull();
    expect(normalizeDate('2026/13/40')).toBeNull();
  });
});

describe('store matching', () => {
  it('normalizes width/case/punctuation', () => {
    expect(normalizeStoreName('ＬＡＷＳＯＮ ・ Shibuya')).toBe('lawsonshibuya');
  });
  it('matches across zh/ja/en via any field', () => {
    expect(storesMatch({ store: '羅森' }, { store: '羅森便利店', storeEn: 'Lawson' })).toBe(true);
    expect(storesMatch({ storeOriginal: 'ローソン' }, { storeEn: 'LAWSON' })).toBe(true);
    expect(storesMatch({ store: '唐吉訶德' }, { storeOriginal: 'ドン・キホーテ' })).toBe(true);
    expect(storesMatch({ storeEn: 'Lawson Shibuya Store' }, { storeEn: 'Lawson' })).toBe(true);
  });
  it('different shops do not match', () => {
    expect(storesMatch({ store: '羅森' }, { store: '全家' })).toBe(false);
    expect(storesMatch({ store: 'Uniqlo' }, { store: 'Daiso' })).toBe(false);
  });
  it('placeholder / missing names never match', () => {
    expect(storesMatch({ store: '未知店舖' }, { store: '未知店舖' })).toBe(false);
    expect(storesMatch({}, { store: '羅森' })).toBe(false);
  });
});

describe('compareExpenses levels', () => {
  it('strong: same date/store/amount/count even with different date format and language', () => {
    const b = lawson({ id: 2, date: '2026/10/18', store: 'Lawson', storeOriginal: undefined, storeEn: undefined });
    expect(compareExpenses(lawson(), b)).toBe('strong');
  });
  it('likely: item count differs', () => {
    expect(compareExpenses(lawson(), lawson({ id: 2, items: [item('a')] }))).toBe('likely');
  });
  it('weak: legacy rule when store differs', () => {
    const other = lawson({ id: 2, store: '全家', storeOriginal: 'ファミマ', storeEn: 'FamilyMart' });
    expect(compareExpenses(lawson(), other)).toBe('weak');
  });
  it('legit same-day same-amount different store and count => no prompt, no match', () => {
    const other = lawson({ id: 2, store: '全家', storeOriginal: undefined, storeEn: undefined, items: [item('x')] });
    expect(compareExpenses(lawson(), other)).toBeNull();
  });
  it('different date / amount / currency => null', () => {
    expect(compareExpenses(lawson(), lawson({ id: 2, date: '2026年10月19日' }))).toBeNull();
    expect(compareExpenses(lawson(), lawson({ id: 2, originalAmount: 1200, subtotal: 1200 }))).toBeNull();
    expect(compareExpenses(lawson(), lawson({ id: 2, currency: 'HKD' }))).toBeNull();
  });
  it('JPY needs exact total; 2-decimal currency allows 1 cent', () => {
    expect(compareExpenses(lawson(), lawson({ id: 2, originalAmount: 1081, subtotal: 1081 }))).toBeNull();
    const usd = (id, amt) => ({ ...lawson({ id }), currency: 'USD', originalAmount: amt, subtotal: amt });
    expect(compareExpenses(usd(1, 12.34), usd(2, 12.35))).toBe('strong');
    expect(compareExpenses(usd(1, 12.34), usd(2, 12.4))).toBe('weak'); // legacy rounded rule only, never prompts
  });
  it('tax-free: pre-refund total vs post-refund total still match', () => {
    const scanned1 = lawson({ originalAmount: 10000, subtotal: 10000, taxRefund: 0 });
    const scanned2 = lawson({ id: 2, originalAmount: 9091, subtotal: 9091, taxRefund: 909 });
    expect(compareExpenses(scanned1, scanned2)).toBe('strong');
  });
  it('tax-free receipt vs unrelated normal receipt same store/day stays separate', () => {
    const taxFree = lawson({ originalAmount: 9091, subtotal: 9091, taxRefund: 909 });
    const normal = lawson({ id: 2, originalAmount: 500, subtotal: 463, items: [item('x')] });
    expect(compareExpenses(taxFree, normal)).toBeNull();
  });
  it('unparseable dates only reach weak, never strong', () => {
    expect(compareExpenses(lawson({ date: 'n/a' }), lawson({ id: 2, date: 'n/a' }))).toBe('weak');
  });
  it('edited record whose amount changed is not matched (acceptable miss)', () => {
    expect(compareExpenses(lawson({ originalAmount: 1000, subtotal: 1000, editedAt: 1 }), lawson({ id: 2 }))).toBeNull();
  });
  it('edited record whose store was renamed still matches via other name fields', () => {
    const edited = lawson({ store: '我的便利店', editedAt: 5 });
    expect(compareExpenses(edited, lawson({ id: 2 }))).toBe('strong');
  });
});

describe('findDuplicateOf / splitBatchByDuplicates', () => {
  it('picks the strongest match', () => {
    const weak = lawson({ id: 5, store: '全家', storeOriginal: undefined, storeEn: undefined });
    const strong = lawson({ id: 6 });
    const r = findDuplicateOf(lawson({ id: 99 }), [weak, strong]);
    expect(r.match.id).toBe(6);
    expect(r.level).toBe('strong');
  });
  it('splits clean vs conflicts, weak stays clean', () => {
    const existing = [lawson({ id: 1 })];
    const dup = lawson({ id: 10 });
    const fresh = lawson({ id: 11, date: '2026年10月20日' });
    const weak = lawson({ id: 12, store: '全家', storeOriginal: undefined, storeEn: undefined });
    const { clean, conflicts } = splitBatchByDuplicates([dup, fresh, weak], existing);
    expect(conflicts.map((c) => [c.record.id, c.matchId, c.level])).toEqual([[10, 1, 'strong']]);
    expect(clean.map((c) => c.id)).toEqual([11, 12]);
  });
  it('same file twice in one batch is caught', () => {
    const { clean, conflicts } = splitBatchByDuplicates([lawson({ id: 10 }), lawson({ id: 11 })], []);
    expect(clean.map((c) => c.id)).toEqual([10]);
    expect(conflicts[0]).toMatchObject({ matchId: 10, level: 'strong' });
  });
  it('does not mutate inputs', () => {
    const existing = Object.freeze([Object.freeze(lawson({ id: 1 }))]);
    expect(() => splitBatchByDuplicates([lawson({ id: 2 })], existing)).not.toThrow();
  });
});

describe('detectDuplicates (banner)', () => {
  it('flags both records of a pair with pointer to the other', () => {
    const m = detectDuplicates([lawson({ id: 1 }), lawson({ id: 2 })]);
    expect(m.has(1) && m.has(2)).toBe(true);
    expect(m.get(1)).toEqual({ ofId: 2, level: 'strong' });
  });
  it('legacy weak rule still flags', () => {
    const m = detectDuplicates([lawson({ id: 1 }), lawson({ id: 2, store: '全家', storeOriginal: undefined, storeEn: undefined })]);
    expect(m.has(1)).toBe(true);
  });
  it('duplicateDismissed on either record clears the pair', () => {
    const m = detectDuplicates([lawson({ id: 1 }), lawson({ id: 2, duplicateDismissed: true })]);
    expect(m.size).toBe(0);
  });
  it('unrelated records are not flagged', () => {
    expect(detectDuplicates([lawson({ id: 1 }), lawson({ id: 2, date: '2026年10月01日' })]).size).toBe(0);
  });
});

describe('isUserEdited', () => {
  it('uses editedAt or userEditedPricing', () => {
    expect(isUserEdited({ editedAt: 1 })).toBe(true);
    expect(isUserEdited({ userEditedPricing: true })).toBe(true);
    expect(isUserEdited({})).toBe(false);
  });
});
