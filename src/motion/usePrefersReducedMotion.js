import { useEffect, useState } from 'react';
import { REDUCED_MOTION_QUERY } from './tokens.js';

function resolveMatchMedia(target) {
  if (target && typeof target.matchMedia === 'function') {
    return target.matchMedia.bind(target);
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.matchMedia === 'function') {
    return globalThis.matchMedia.bind(globalThis);
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia.bind(window);
  }
  return null;
}

/**
 * Pure check for `(prefers-reduced-motion: reduce)`.
 * Safe in Node / SSR environments without `matchMedia`; defaults to `false`.
 */
export function getPrefersReducedMotion(target) {
  const matchMediaFn = resolveMatchMedia(target);
  if (!matchMediaFn) return false;
  try {
    const mql = matchMediaFn(REDUCED_MOTION_QUERY);
    return Boolean(mql && mql.matches);
  } catch {
    return false;
  }
}

/**
 * Subscribes to changes on `(prefers-reduced-motion: reduce)`.
 * Returns an unsubscribe cleanup function.
 */
export function subscribePrefersReducedMotion(onChange, target) {
  if (typeof onChange !== 'function') return () => {};
  const matchMediaFn = resolveMatchMedia(target);
  if (!matchMediaFn) return () => {};

  let mql;
  try {
    mql = matchMediaFn(REDUCED_MOTION_QUERY);
  } catch {
    return () => {};
  }
  if (!mql) return () => {};

  const handler = (event) => {
    const nextMatches =
      event && typeof event.matches === 'boolean' ? event.matches : Boolean(mql.matches);
    onChange(nextMatches);
  };

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler);
      }
    };
  }

  if (typeof mql.addListener === 'function') {
    mql.addListener(handler);
    return () => {
      if (typeof mql.removeListener === 'function') {
        mql.removeListener(handler);
      }
    };
  }

  return () => {};
}

/**
 * React hook returning whether the user prefers reduced motion.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => getPrefersReducedMotion());

  useEffect(() => {
    setReduced(getPrefersReducedMotion());
    return subscribePrefersReducedMotion(setReduced);
  }, []);

  return reduced;
}

export default usePrefersReducedMotion;
