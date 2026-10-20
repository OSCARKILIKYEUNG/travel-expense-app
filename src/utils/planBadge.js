/**
 * Plan pill text. Null while the billing snapshot is still loading so the
 * badge does not flash the free plan before subscription status arrives.
 * Does not change how the snapshot itself is computed.
 */
export function visiblePlanLabel(billing, labels) {
  if (!billing || billing.loading) return null;
  return billing.hasUnlimitedScans ? labels.pro : labels.free;
}
