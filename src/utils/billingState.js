/**
 * Billing envelope transitions. `requestId` is monotonic: an older refresh
 * cannot overwrite a newer success or a snapshot applied from an upload.
 *
 * @typedef {object} BillingState
 * @property {'loading'|'ready'|'error'} phase
 * @property {object|null} snapshot
 * @property {boolean} refreshing
 * @property {string} error
 * @property {number} requestId
 *
 * @typedef {{ type: 'start', requestId: number }} BillingStartAction
 * @typedef {{ type: 'success', requestId: number, snapshot: object }} BillingSuccessAction
 * @typedef {{ type: 'failure', requestId: number, error?: string }} BillingFailureAction
 * @typedef {{ type: 'apply', requestId: number, snapshot: object }} BillingApplyAction
 * @typedef {BillingStartAction|BillingSuccessAction|BillingFailureAction|BillingApplyAction} BillingAction
 */

export const initialBillingState = {
  phase: 'loading',
  snapshot: null,
  refreshing: true,
  error: '',
  requestId: 0,
};

/**
 * @param {BillingState} state
 * @param {BillingAction} action
 * @returns {BillingState}
 */
export function billingReducer(state, action) {
  const requestId = Number(action?.requestId) || 0;
  if (requestId < (state?.requestId || 0)) return state;

  switch (action.type) {
    case 'start':
      return {
        phase: state.snapshot ? 'ready' : 'loading',
        snapshot: state.snapshot,
        refreshing: true,
        error: '',
        requestId,
      };
    case 'success':
    case 'apply':
      return {
        phase: 'ready',
        snapshot: action.snapshot ?? null,
        refreshing: false,
        error: '',
        requestId,
      };
    case 'failure': {
      const error = action.error || 'billing failed';
      if (state.snapshot) {
        return {
          phase: 'ready',
          snapshot: state.snapshot,
          refreshing: false,
          error,
          requestId,
        };
      }
      return {
        phase: 'error',
        snapshot: null,
        refreshing: false,
        error,
        requestId,
      };
    }
    default:
      return state;
  }
}
