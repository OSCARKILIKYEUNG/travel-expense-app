/**
 * Rate limit for cloud-sync toasts. A failing network makes every debounced
 * save fail; without a limit the notebook would show a new error toast every
 * 500 ms. One toast per kind per window is enough: the retry button covers the rest.
 */
export const SYNC_TOAST_MIN_INTERVAL_MS = 30_000;

/**
 * @param {{ minIntervalMs?: number, now?: () => number }} [options]
 */
export function createSyncToastLimiter({ minIntervalMs = SYNC_TOAST_MIN_INTERVAL_MS, now = () => Date.now() } = {}) {
  const lastShown = new Map();
  return {
    /** True when a toast of this kind may be shown now; records the show. */
    allow(kind) {
      const t = now();
      const prev = lastShown.get(kind);
      if (prev != null && t - prev < minIntervalMs) return false;
      lastShown.set(kind, t);
      return true;
    },
    /** Forget a kind, e.g. after a successful retry, so the next failure shows again. */
    reset(kind) {
      lastShown.delete(kind);
    },
  };
}

/** Short, user-facing text for a sync failure. Never surfaces raw JSON. */
export function syncErrorText(err) {
  if (!err) return '';
  if (typeof err === 'string') return err.slice(0, 160);
  const msg = err.message || err.error_description || err.details || '';
  return String(msg).slice(0, 160);
}
