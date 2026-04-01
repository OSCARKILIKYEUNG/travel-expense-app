export const FREE_RECEIPT_SCAN_LIMIT = 5;

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function isPaidSubscriptionStatus(status) {
  return PAID_SUBSCRIPTION_STATUSES.has(String(status || '').toLowerCase());
}

export function getRemainingFreeScans(usedCount, limit = FREE_RECEIPT_SCAN_LIMIT) {
  const safeUsed = Number.isFinite(usedCount) ? Math.max(0, usedCount) : 0;
  return Math.max(0, limit - safeUsed);
}

export function buildBillingSnapshot({
  subscriptionStatus,
  usedReceiptScans = 0,
  freeScanLimit = FREE_RECEIPT_SCAN_LIMIT,
} = {}) {
  const paid = isPaidSubscriptionStatus(subscriptionStatus);
  const used = Number.isFinite(usedReceiptScans) ? Math.max(0, usedReceiptScans) : 0;
  const remaining = paid ? null : getRemainingFreeScans(used, freeScanLimit);

  return {
    plan: paid ? 'pro' : 'free',
    subscriptionStatus: subscriptionStatus || null,
    hasUnlimitedScans: paid,
    freeScanLimit,
    usedReceiptScans: used,
    remainingFreeScans: remaining,
  };
}
