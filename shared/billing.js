export const FREE_RECEIPT_SCAN_LIMIT = 5;

const PAID_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

/**
 * Dev/test kill-switch (server / Vercel): RECEIPT_SCAN_QUOTA_DISABLED=1|true|yes
 * → all users treated as unlimited for parse-receipt. Unset to restore free limit.
 * Prefer per-account `user_app_data.subscription_status=active` for one tester.
 * Client UI follows subscription_status from Supabase (no VITE flag required).
 */
export function isReceiptScanQuotaDisabled() {
  const v = String(process.env.RECEIPT_SCAN_QUOTA_DISABLED || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

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
  quotaDisabled = isReceiptScanQuotaDisabled(),
} = {}) {
  const paid = isPaidSubscriptionStatus(subscriptionStatus) || quotaDisabled;
  const used = Number.isFinite(usedReceiptScans) ? Math.max(0, usedReceiptScans) : 0;
  const remaining = paid ? null : getRemainingFreeScans(used, freeScanLimit);

  return {
    plan: paid ? 'pro' : 'free',
    subscriptionStatus: subscriptionStatus || null,
    hasUnlimitedScans: paid,
    freeScanLimit,
    usedReceiptScans: used,
    remainingFreeScans: remaining,
    quotaDisabled: Boolean(quotaDisabled),
  };
}
