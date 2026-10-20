// Feature flags (build-time, Vite). Default: hidden.
// VITE_ENABLE_STRIPE_UI=1 (or true/on/yes) restores Stripe / Pro upgrade UI.
const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

export function parseFlag(value) {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase());
}

export function isStripeUiEnabled(env = import.meta.env) {
  return parseFlag(env?.VITE_ENABLE_STRIPE_UI);
}

export const STRIPE_UI_ENABLED = isStripeUiEnabled();
