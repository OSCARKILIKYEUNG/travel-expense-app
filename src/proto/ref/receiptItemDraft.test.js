import { describe, expect, it } from 'vitest';
import {
  commitItemDrafts,
  createEmptyRowDraft,
  createItemDrafts,
  parseDraftAmount,
  withDraftField,
  withoutDraftRow,
} from './receiptItemDraft';

function commit(items, mutate, sourceCount = items.length) {
  let drafts = createItemDrafts(items, 'case');
  drafts = mutate(drafts);
  return { drafts, result: commitItemDrafts(drafts, { sourceCount }) };
}

describe('receipt item drafts', () => {
  it('parses finite amounts at commit time and leaves temporary text invalid', () => {
    expect(parseDraftAmount('')).toEqual({ ok: false, reason: 'blank' });
    expect(parseDraftAmount('-')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDraftAmount('.')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDraftAmount('-.')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDraftAmount('1.')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseDraftAmount('0').value).toBe(0);
    expect(parseDraftAmount('-30').value).toBe(-30);
    expect(parseDraftAmount('1,280').value).toBe(1280);
    expect(parseDraftAmount('nope')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('keeps an untouched legacy row as the same object, including malformed fields', () => {
    const bad = Object.freeze({
      name: '壞',
      price: 'nope',
      quantity: 0,
      qty: -2,
      name_en: 'Bad',
      original_name: 'わるい',
      sku: 'keep',
    });
    const drafts = createItemDrafts([bad], 'keep');
    const result = commitItemDrafts(drafts, { sourceCount: 1 });
    expect(result).toEqual({ ok: true, dirty: false, items: null, errors: [] });
    expect(bad.price).toBe('nope');
    expect(bad.name_en).toBe('Bad');
  });

  it('clears only English aliases when the canonical name changes and keeps provenance', () => {
    const item = {
      name: '茶',
      name_en: 'Tea',
      nameEn: 'TeaEn',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      assignedTo: 'Oscar',
      sku: 'T-1',
    };
    const { result } = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'name', '焙茶'));
    expect(result.ok).toBe(true);
    expect(result.items[0]).toMatchObject({
      name: '焙茶',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      assignedTo: 'Oscar',
      sku: 'T-1',
    });
    expect(result.items[0].name_en).toBeUndefined();
    expect(result.items[0].nameEn).toBeUndefined();
    expect(result.items[0]).not.toBe(item);
    expect(item.name_en).toBe('Tea');
    expect(item.name).toBe('茶');
  });

  it('does not clear aliases or rewrite price when the name text is unchanged', () => {
    const item = { name: '茶', name_en: 'Tea', price: '1,280' };
    const { result } = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'name', '茶'));
    expect(result.dirty).toBe(false);
    expect(result.items).toBeNull();
  });

  it('keeps a separate actual price when only the printed amount changes, and never multiplies quantity', () => {
    const item = {
      name: '實',
      price: 100,
      priceActual: 180,
      price_actual: 90,
      quantity: 3,
      qty: 2,
    };
    const { result } = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'price', '-5'));
    expect(result.items[0].price).toBe(-5);
    expect(result.items[0].priceActual).toBe(180);
    expect(result.items[0].price_actual).toBe(90);
    expect(result.items[0].quantity).toBe(3);
    expect(result.items[0].qty).toBe(2);
    expect(result.items[0].price).not.toBe(-15);
  });

  it('clears both actual-price aliases and both quantity aliases', () => {
    const item = { name: '實', price: 10, priceActual: 4, price_actual: 9, quantity: 2, qty: 8 };
    const clearedActual = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'priceActual', ''));
    expect(clearedActual.result.items[0].price).toBe(10);
    expect(clearedActual.result.items[0].priceActual).toBeUndefined();
    expect(clearedActual.result.items[0].price_actual).toBeUndefined();
    expect(item.price_actual).toBe(9);

    const clearedQty = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'quantity', '  '));
    expect(clearedQty.result.items[0].quantity).toBeUndefined();
    expect(clearedQty.result.items[0].qty).toBeUndefined();
    expect(item.qty).toBe(8);
  });

  it('updates only the supplied actual-price alias and rejects a half-typed amount', () => {
    const snake = { name: '蛇', price: 3, price_actual: -2 };
    const edited = commit([snake], (drafts) => withDraftField(drafts, drafts[0].key, 'priceActual', '0'));
    expect(edited.result.items[0].price_actual).toBe(0);
    expect(edited.result.items[0].priceActual).toBeUndefined();
    expect(edited.result.items[0].price).toBe(3);

    const blocked = commit([snake], (drafts) => withDraftField(drafts, drafts[0].key, 'priceActual', '-'));
    expect(blocked.result.ok).toBe(false);
    expect(blocked.result.items).toBeNull();
    expect(blocked.result.errors.map((error) => error.code)).toEqual(['actualInvalid']);
    expect(snake.price_actual).toBe(-2);
  });

  it('does not infer quantity from a name and preserves an explicit positive edit', () => {
    const named = { name: 'Shorts set x12', price: 5940 };
    const drafts = createItemDrafts([named], 'set');
    expect(drafts[0].fields.quantity.present).toBe(false);
    const added = commitItemDrafts([
      ...drafts,
      withDraftField(
        withDraftField([createEmptyRowDraft('new-1')], 'new-1', 'name', '新'),
        'new-1',
        'price',
        '0',
      )[0],
    ], { sourceCount: 1 });
    expect(added.ok).toBe(true);
    expect(added.items[0]).toBe(named);
    expect(added.items[1]).toEqual({ name: '新', price: 0 });

    const withQty = withDraftField(
      withDraftField(
        withDraftField([createEmptyRowDraft('new-2')], 'new-2', 'name', '  兩件  '),
        'new-2',
        'price',
        '-2',
      ),
      'new-2',
      'quantity',
      '1.5',
    );
    const saved = commitItemDrafts(withQty, { sourceCount: 0 });
    expect(saved.items).toEqual([{ name: '  兩件  ', price: -2, quantity: 1.5 }]);
  });

  it('blocks a new or dirty incomplete price instead of coercing it to zero', () => {
    const blank = commitItemDrafts([createEmptyRowDraft('new-3')], { sourceCount: 0 });
    expect(blank.ok).toBe(false);
    expect(blank.errors.map((error) => error.code)).toEqual(['nameRequired', 'priceRequired']);

    const item = { name: '茶', price: 5 };
    const broken = commit([item], (drafts) => withDraftField(drafts, drafts[0].key, 'price', '-'));
    expect(broken.result.ok).toBe(false);
    expect(broken.result.errors[0].code).toBe('priceInvalid');
    expect(item.price).toBe(5);
  });

  it('emits an explicit empty array when every row is removed and leaves siblings exact', () => {
    const keep = { name: '留', price: 'nope', extra: { n: 1 } };
    const drop = { name: '走', price: 2, name_en: 'Go' };
    const { result } = commit([keep, drop], (drafts) => {
      const named = withDraftField(drafts, drafts[1].key, 'name', '走了');
      return withoutDraftRow(named, named[0].key);
    }, 2);
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('走了');
    expect(result.items[0].name_en).toBeUndefined();
    expect(drop.name_en).toBe('Go');
    expect(keep.extra.n).toBe(1);

    const removed = commitItemDrafts([], { sourceCount: 2 });
    expect(removed).toMatchObject({ ok: true, dirty: true, items: [] });
  });
});
