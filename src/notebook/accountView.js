/**
 * Pure view-model builder for the notebook Settings "Account" card.
 *
 * @param {{
 *   user?: { email?: string | null } | null,
 *   planView?: {
 *     state?: 'loading' | 'error' | 'pro' | 'free',
 *     remainingFreeScans?: number,
 *     freeScanLimit?: number,
 *   } | null,
 * }} [input]
 * @returns {{
 *   email: string,
 *   plan: 'pro' | 'free' | 'loading',
 *   remainingFreeScans: number | null,
 *   freeScanLimit: number | null,
 * } | null}
 */
export function buildAccountView({ user, planView } = {}) {
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (!email) return null;

  const state = planView?.state;
  if (state === 'pro') {
    return {
      email,
      plan: 'pro',
      remainingFreeScans: null,
      freeScanLimit: null,
    };
  }

  if (state === 'free') {
    const remainingFreeScans = Number.isFinite(planView.remainingFreeScans)
      ? planView.remainingFreeScans
      : 0;
    const freeScanLimit = Number.isFinite(planView.freeScanLimit)
      ? planView.freeScanLimit
      : 0;
    return {
      email,
      plan: 'free',
      remainingFreeScans,
      freeScanLimit,
    };
  }

  return {
    email,
    plan: 'loading',
    remainingFreeScans: null,
    freeScanLimit: null,
  };
}
