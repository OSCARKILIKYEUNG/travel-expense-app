import { DURATION_MS, EASING } from './tokens.js';
import { getPrefersReducedMotion } from './usePrefersReducedMotion.js';

export function createNoopMotionHandle() {
  return {
    finished: Promise.resolve(),
    cancel() {},
  };
}

/**
 * Runs a Web Animations API animation on `el` unless reduced motion is active
 * or `el.animate` is unavailable. Never blocks pointer input.
 */
export function runMotion(el, keyframes, options = {}) {
  const rawOptions = typeof options === 'number' ? { duration: options } : options || {};
  const { reducedMotion, ...waapiOptions } = rawOptions;
  const isReduced =
    typeof reducedMotion === 'boolean' ? reducedMotion : getPrefersReducedMotion();

  if (isReduced || !el || typeof el.animate !== 'function') {
    return createNoopMotionHandle();
  }

  const mergedOptions = {
    ...waapiOptions,
    duration: waapiOptions.duration ?? DURATION_MS.normal,
    easing: waapiOptions.easing ?? EASING.out,
    fill: waapiOptions.fill ?? 'both',
  };

  const animation = el.animate(keyframes, mergedOptions);

  if (
    animation &&
    typeof animation === 'object' &&
    typeof animation.cancel === 'function' &&
    animation.finished &&
    typeof animation.finished.then === 'function'
  ) {
    return animation;
  }

  return {
    finished:
      animation && animation.finished && typeof animation.finished.then === 'function'
        ? animation.finished
        : Promise.resolve(),
    cancel() {
      if (animation && typeof animation.cancel === 'function') {
        animation.cancel();
      }
    },
  };
}

export default runMotion;
