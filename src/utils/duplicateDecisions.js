/**
 * Pure logic for applying per-receipt duplicate decisions, and undoing a replace.
 * Nothing here mutates its inputs.
 */

export const UNDO_TTL_MS = 2 * 60 * 1000;

/**
 * @param {object[]} expenses current trip expenses
 * @param {Array<{record: object, matchId: number, level: string}>} conflicts
 * @param {Record<string|number, 'skip'|'keep'|'replace'>} decisions keyed by record.id.
 *   Missing = undecided (dialog closed): keep new record, flag with duplicateOf, nothing removed.
 * @returns {{ expenses: object[], summary: {skipped:number, kept:number, replaced:number, pending:number}, undoEntries: Array<{removed: object, addedId: number}> }}
 */
export function applyDuplicateDecisions(expenses, conflicts, decisions = {}) {
  let next = [...expenses];
  const summary = { skipped: 0, kept: 0, replaced: 0, pending: 0 };
  const undoEntries = [];
  const replacedTargets = new Set();

  for (const { record, matchId } of conflicts) {
    let choice = decisions[record.id];
    if (choice === 'replace') {
      const target = next.find((e) => e.id === matchId);
      // Target gone, or already replaced by another receipt in this batch: never lose data, keep both.
      if (!target || replacedTargets.has(matchId)) choice = 'keep';
    }

    if (choice === 'skip') {
      summary.skipped += 1;
    } else if (choice === 'keep') {
      next = [{ ...record, duplicateOf: matchId, duplicateDismissed: true }, ...next];
      summary.kept += 1;
    } else if (choice === 'replace') {
      const target = next.find((e) => e.id === matchId);
      replacedTargets.add(matchId);
      undoEntries.push({ removed: JSON.parse(JSON.stringify(target)), addedId: record.id });
      next = [record, ...next.filter((e) => e.id !== matchId)];
      summary.replaced += 1;
    } else {
      next = [{ ...record, duplicateOf: matchId }, ...next];
      summary.pending += 1;
    }
  }
  return { expenses: next, summary, undoEntries };
}

export function createUndoState(undoEntries, tripId, now = Date.now(), ttl = UNDO_TTL_MS) {
  if (!undoEntries?.length) return null;
  return { entries: undoEntries, tripId, expiresAt: now + ttl };
}

export function isUndoActive(state, tripId, now = Date.now()) {
  return Boolean(state && state.entries?.length && state.tripId === tripId && state.expiresAt > now);
}

/**
 * Restore replaced records. The record added by the replace is removed, unless the user has
 * edited it in the meantime (then both are kept, so no edits are lost).
 */
export function undoReplace(expenses, state) {
  let next = [...expenses];
  let restored = 0;
  let keptEdited = 0;
  for (const { removed, addedId } of state?.entries || []) {
    const added = next.find((e) => e.id === addedId);
    if (added?.editedAt) {
      keptEdited += 1;
    } else {
      next = next.filter((e) => e.id !== addedId);
    }
    if (!next.some((e) => e.id === removed.id)) {
      next = [removed, ...next];
      restored += 1;
    }
  }
  return { expenses: next, restored, keptEdited };
}

export function dismissDuplicate(expenses, id) {
  return expenses.map((e) => (e.id === id ? { ...e, duplicateDismissed: true } : e));
}
