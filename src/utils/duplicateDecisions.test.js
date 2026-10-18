import { describe, it, expect } from 'vitest';
import {
  applyDuplicateDecisions, createUndoState, isUndoActive, undoReplace, dismissDuplicate, UNDO_TTL_MS,
} from './duplicateDecisions';

const rec = (id, o = {}) => ({ id, date: '2026年10月18日', store: '羅森', items: [{ name: 'a', price: 1 }], originalAmount: 1080, currency: 'JPY', ...o });
const old = rec(1, { editedAt: 123 });
const other = rec(2, { store: 'Uniqlo' });
const fresh = rec(10);
const conflicts = [{ record: fresh, matchId: 1, level: 'strong' }];

const freeze = (x) => JSON.parse(JSON.stringify(x));

describe('applyDuplicateDecisions', () => {
  it('skip adds nothing and leaves records untouched', () => {
    const exp = [old, other];
    const r = applyDuplicateDecisions(exp, conflicts, { 10: 'skip' });
    expect(r.expenses).toEqual(exp);
    expect(r.summary).toEqual({ skipped: 1, kept: 0, replaced: 0, pending: 0 });
    expect(r.undoEntries).toEqual([]);
  });
  it('keep adds new with duplicateOf + duplicateDismissed, old untouched', () => {
    const r = applyDuplicateDecisions([old], conflicts, { 10: 'keep' });
    expect(r.expenses).toHaveLength(2);
    expect(r.expenses.find((e) => e.id === 10)).toMatchObject({ duplicateOf: 1, duplicateDismissed: true });
    expect(r.expenses.find((e) => e.id === 1)).toBe(old);
  });
  it('undecided (dialog closed) keeps new, flags duplicateOf without dismissal, deletes nothing', () => {
    const r = applyDuplicateDecisions([old, other], conflicts, {});
    expect(r.expenses.map((e) => e.id).sort()).toEqual([1, 10, 2]);
    const added = r.expenses.find((e) => e.id === 10);
    expect(added.duplicateOf).toBe(1);
    expect(added.duplicateDismissed).toBeUndefined();
    expect(r.summary.pending).toBe(1);
  });
  it('replace removes exactly the target and adds new, with undo entry', () => {
    const r = applyDuplicateDecisions([old, other], conflicts, { 10: 'replace' });
    expect(r.expenses.map((e) => e.id).sort()).toEqual([10, 2]);
    expect(r.expenses.find((e) => e.id === 2)).toBe(other);
    expect(r.undoEntries).toHaveLength(1);
    expect(r.undoEntries[0]).toMatchObject({ addedId: 10, removed: { id: 1, editedAt: 123 } });
    expect(r.summary.replaced).toBe(1);
  });
  it('unknown choice values never replace', () => {
    const r = applyDuplicateDecisions([old], conflicts, { 10: 'REPLACE' });
    expect(r.expenses.some((e) => e.id === 1)).toBe(true);
  });
  it('replace with missing target falls back to keep both', () => {
    const r = applyDuplicateDecisions([other], conflicts, { 10: 'replace' });
    expect(r.expenses.map((e) => e.id).sort()).toEqual([10, 2]);
    expect(r.summary.kept).toBe(1);
  });
  it('two receipts replacing same old record: second becomes keep (nothing lost)', () => {
    const c2 = [...conflicts, { record: rec(11), matchId: 1, level: 'strong' }];
    const r = applyDuplicateDecisions([old], c2, { 10: 'replace', 11: 'replace' });
    expect(r.summary).toMatchObject({ replaced: 1, kept: 1 });
    expect(r.expenses.map((e) => e.id).sort()).toEqual([10, 11]);
  });
  it('mixed per-receipt choices', () => {
    const c = [
      { record: rec(10), matchId: 1, level: 'strong' },
      { record: rec(11, { store: 'Uniqlo' }), matchId: 2, level: 'likely' },
    ];
    const r = applyDuplicateDecisions([old, other], c, { 10: 'skip', 11: 'keep' });
    expect(r.expenses.map((e) => e.id).sort()).toEqual([1, 11, 2]);
  });
  it('does not mutate inputs', () => {
    const exp = [old, other];
    const snapshot = freeze({ exp, conflicts });
    applyDuplicateDecisions(exp, conflicts, { 10: 'replace' });
    expect(freeze({ exp, conflicts })).toEqual(snapshot);
  });
  it('undo entry is a deep copy (later mutation of state cannot corrupt it)', () => {
    const o = rec(1, { items: [{ name: 'a', price: 1 }] });
    const r = applyDuplicateDecisions([o], conflicts, { 10: 'replace' });
    o.items[0].price = 999;
    expect(r.undoEntries[0].removed.items[0].price).toBe(1);
  });
});

describe('undo', () => {
  it('restores old record and removes the replacement', () => {
    const r = applyDuplicateDecisions([old, other], conflicts, { 10: 'replace' });
    const state = createUndoState(r.undoEntries, 'trip1', 1000);
    const u = undoReplace(r.expenses, state);
    expect(u.expenses.map((e) => e.id).sort()).toEqual([1, 2]);
    expect(u.expenses.find((e) => e.id === 1)).toEqual(old);
    expect(u.restored).toBe(1);
  });
  it('keeps the replacement if the user edited it meanwhile', () => {
    const r = applyDuplicateDecisions([old], conflicts, { 10: 'replace' });
    const edited = r.expenses.map((e) => (e.id === 10 ? { ...e, editedAt: 5 } : e));
    const u = undoReplace(edited, createUndoState(r.undoEntries, 't', 0));
    expect(u.expenses.map((e) => e.id).sort()).toEqual([1, 10]);
    expect(u.keptEdited).toBe(1);
  });
  it('does not duplicate the old record if it already exists', () => {
    const state = createUndoState([{ removed: old, addedId: 10 }], 't', 0);
    const u = undoReplace([old], state);
    expect(u.expenses.filter((e) => e.id === 1)).toHaveLength(1);
    expect(u.restored).toBe(0);
  });
  it('window: active until expiry, only for same trip', () => {
    const state = createUndoState([{ removed: old, addedId: 10 }], 'trip1', 1000);
    expect(state.expiresAt).toBe(1000 + UNDO_TTL_MS);
    expect(isUndoActive(state, 'trip1', 1000 + UNDO_TTL_MS - 1)).toBe(true);
    expect(isUndoActive(state, 'trip1', 1000 + UNDO_TTL_MS)).toBe(false);
    expect(isUndoActive(state, 'trip2', 1001)).toBe(false);
    expect(isUndoActive(null, 'trip1')).toBe(false);
    expect(createUndoState([], 't')).toBeNull();
  });
  it('no replace -> no undo state', () => {
    const r = applyDuplicateDecisions([old], conflicts, { 10: 'keep' });
    expect(createUndoState(r.undoEntries, 't')).toBeNull();
  });
});

describe('dismissDuplicate', () => {
  it('sets only duplicateDismissed on the target and not editedAt', () => {
    const out = dismissDuplicate([rec(1), rec(2)], 2);
    expect(out[1].duplicateDismissed).toBe(true);
    expect(out[1].editedAt).toBeUndefined();
    expect(out[0]).toEqual(rec(1));
  });
});
