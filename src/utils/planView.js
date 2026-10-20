/**
 * One derived view of the billing envelope. UI must not read free-plan
 * fields off a snapshot that has not arrived.
 *
 * @typedef {object} BillingEnvelope
 * @property {'loading'|'ready'|'error'} phase
 * @property {object|null} snapshot
 * @property {boolean} [refreshing]
 * @property {string} [error]
 *
 * @typedef {{ state: 'loading' }} PlanViewLoading
 * @typedef {{ state: 'error', error: string }} PlanViewError
 * @typedef {{ state: 'pro', subscriptionStatus: (string|null), stale: boolean }} PlanViewPro
 * @typedef {{
 *   state: 'free',
 *   remainingFreeScans: number,
 *   usedReceiptScans: number,
 *   freeScanLimit: number,
 *   subscriptionStatus: (string|null),
 *   stale: boolean,
 * }} PlanViewFree
 * @typedef {PlanViewLoading|PlanViewError|PlanViewPro|PlanViewFree} PlanView
 */

/**
 * @param {BillingEnvelope|null|undefined} billing
 * @returns {PlanView}
 */
export function derivePlanView(billing) {
  const snapshot = billing?.snapshot ?? null;
  const phase = billing?.phase || 'loading';
  const refreshing = Boolean(billing?.refreshing);
  const error = typeof billing?.error === 'string' ? billing.error : '';

  if (snapshot) {
    const stale = refreshing || Boolean(error);
    const subscriptionStatus = snapshot.subscriptionStatus ?? null;
    if (snapshot.hasUnlimitedScans || snapshot.plan === 'pro') {
      return { state: 'pro', subscriptionStatus, stale };
    }
    return {
      state: 'free',
      remainingFreeScans: Number.isFinite(snapshot.remainingFreeScans) ? snapshot.remainingFreeScans : 0,
      usedReceiptScans: Number.isFinite(snapshot.usedReceiptScans) ? snapshot.usedReceiptScans : 0,
      freeScanLimit: Number.isFinite(snapshot.freeScanLimit) ? snapshot.freeScanLimit : 0,
      subscriptionStatus,
      stale,
    };
  }

  if (phase === 'error') return { state: 'error', error };
  return { state: 'loading' };
}

/**
 * Block the picker only after a free plan has settled at zero remaining.
 * Loading, error, and Pro (including a stale Pro snapshot) stay open;
 * the server still enforces quota.
 *
 * @param {PlanView|null|undefined} view
 * @returns {boolean}
 */
export function isUploadBlocked(view) {
  return view?.state === 'free' && (view.remainingFreeScans ?? 0) <= 0;
}
