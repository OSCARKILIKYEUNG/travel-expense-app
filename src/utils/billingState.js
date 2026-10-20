/**
 * Billing envelope transitions.
 *
 * Two clocks, because "which request is newest" and "which snapshot is newest"
 * are different questions:
 * - `activeId`: id of the most recently started refresh. Only its failure is
 *   reported; an older refresh failing while a newer one runs is noise.
 * - `settledId`: id of the snapshot on screen. A success/apply is accepted when
 *   its id is newer than the settled one, even if a later refresh has started,
 *   so an in-flight newer request can't make an older good answer disappear.
 * Ids come from one monotonic counter shared by refreshes and upload-applied
 * snapshots.
 *
 * @typedef {object} BillingState
 * @property {'loading'|'ready'|'error'} phase
 * @property {object|null} snapshot
 * @property {boolean} refreshing   a started refresh newer than the snapshot is pending
 * @property {string} error         last failure of the active refresh ('' when none)
 * @property {number} activeId
 * @property {number} settledId
 *
 * @typedef {{ type: 'start', requestId: number }} BillingStartAction
 * @typedef {{ type: 'success'|'apply', requestId: number, snapshot: object }} BillingSettleAction
 * @typedef {{ type: 'failure', requestId: number, error?: string }} BillingFailureAction
 * @typedef {BillingStartAction|BillingSettleAction|BillingFailureAction} BillingAction
 */

export const initialBillingState = {
  phase: 'loading',
  snapshot: null,
  refreshing: true,
  error: '',
  activeId: 0,
  settledId: 0,
};

/**
 * @param {BillingState} state
 * @param {BillingAction} action
 * @returns {BillingState}
 */
export function billingReducer(state, action) {
  const id = Number(action?.requestId) || 0;
  switch (action?.type) {
    case 'start':
      if (id <= state.activeId) return state;
      return { ...state, activeId: id, refreshing: true, error: '' };
    case 'success':
    case 'apply': {
      if (id <= state.settledId) return state;
      return {
        ...state,
        phase: 'ready',
        snapshot: action.snapshot ?? null,
        settledId: id,
        // Still refreshing only if a newer refresh than this snapshot is pending.
        refreshing: state.activeId > id && state.refreshing,
        error: '',
      };
    }
    case 'failure': {
      // Only the newest refresh reports; and a newer snapshot already answers it.
      if (id !== state.activeId || id <= state.settledId) return state;
      const error = action.error || 'billing failed';
      return {
        ...state,
        phase: state.snapshot ? 'ready' : 'error',
        refreshing: false,
        error,
      };
    }
    default:
      return state;
  }
}

/**
 * Outcome of one refresh as seen by its caller.
 * @param {BillingState} state after the refresh's own action was reduced
 * @param {number} requestId
 * @returns {'ok'|'failed'|'superseded'}
 */
export function refreshOutcome(state, requestId) {
  if (state.settledId >= requestId) return 'ok';
  if (state.activeId === requestId && state.error) return 'failed';
  return 'superseded';
}
