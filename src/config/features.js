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

/**
 * Resolve active UI mode from URL search query (`?ui=classic` | `?ui=notebook`)
 * with optional fallback to `VITE_UI`.
 *
 * @param {string} [search]
 * @param {Record<string, any>} [env]
 * @returns {'classic' | 'notebook'}
 */
export function resolveUiMode(
  search = typeof window !== 'undefined' ? window.location.search : '',
  env = import.meta.env,
) {
  const raw = String(search || '');
  const qIndex = raw.indexOf('?');
  const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : raw;
  const params = new URLSearchParams(qs);
  const uiParam = String(params.get('ui') ?? '').trim().toLowerCase();
  if (uiParam === 'classic' || uiParam === 'legacy') return 'classic';
  if (uiParam === 'notebook' || uiParam === 'redesign' || uiParam === 'ref') return 'notebook';

  const envUi = String(env?.VITE_UI ?? '').trim().toLowerCase();
  if (envUi === 'classic' || envUi === 'legacy') return 'classic';

  return 'notebook';
}

/**
 * Detect whether the classic UI is requested via `?ui=classic` (or `VITE_UI=classic`).
 *
 * @param {string} [search]
 * @param {Record<string, any>} [env]
 * @returns {boolean}
 */
export function isClassicUi(
  search = typeof window !== 'undefined' ? window.location.search : '',
  env = import.meta.env,
) {
  return resolveUiMode(search, env) === 'classic';
}
