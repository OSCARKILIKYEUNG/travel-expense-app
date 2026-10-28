import { runMotion } from './runMotion.js';
import { DURATION_MS, EASING, STICKER } from './tokens.js';

export const STICKER_INITIAL_TILT_DEG = STICKER.tiltDegMin * 0.5;
export const STICKER_PEAK_TILT_DEG = STICKER.tiltDegMax * 0.25;

export const STICKER_POP_OPTIONS = Object.freeze({
  duration: DURATION_MS.normal,
  easing: EASING.springy,
});

export const TOAST_SLIDE_OPTIONS = Object.freeze({
  duration: DURATION_MS.fast,
  easing: EASING.out,
});

function clampStickerTilt(deg) {
  return Math.max(STICKER.tiltDegMin, Math.min(STICKER.tiltDegMax, deg));
}

export function buildStickerPopKeyframes({
  scalePeak = STICKER.scalePeak,
  initialTiltDeg = STICKER_INITIAL_TILT_DEG,
  peakTiltDeg = STICKER_PEAK_TILT_DEG,
} = {}) {
  const startTilt = clampStickerTilt(initialTiltDeg);
  const midTilt = clampStickerTilt(peakTiltDeg);
  return [
    {
      offset: 0,
      opacity: 0.85,
      transform: `scale(0.92) rotate(${startTilt}deg)`,
    },
    {
      offset: 0.65,
      opacity: 1,
      transform: `scale(${scalePeak}) rotate(${midTilt}deg)`,
    },
    {
      offset: 1,
      opacity: 1,
      transform: 'scale(1) rotate(0deg)',
    },
  ];
}

export function buildToastSlideKeyframes() {
  return [
    {
      offset: 0,
      opacity: 0,
      transform: 'translateY(12px) scale(0.98)',
    },
    {
      offset: 1,
      opacity: 1,
      transform: 'translateY(0) scale(1)',
    },
  ];
}

export function shouldPlaySticker({ isEdit = false } = {}) {
  return !isEdit;
}

export function resolveStickerIdAfterSave({ isEdit = false, savedId = null } = {}) {
  if (!shouldPlaySticker({ isEdit })) return null;
  if (savedId == null || savedId === '') return null;
  return savedId;
}

export function isStickerTarget(expenseId, stickerId) {
  if (expenseId == null || stickerId == null || expenseId === '' || stickerId === '') {
    return false;
  }
  return String(expenseId) === String(stickerId);
}

/**
 * Plays the add-only sticker pop on `el` when `stickerPop` is true.
 * Delegates to `runMotion` (no-op under prefers-reduced-motion). Never blocks input.
 */
export function runStickerPop(
  el,
  { stickerPop = false, reducedMotion, onStickerPlayed, expenseId } = {},
) {
  if (!stickerPop || !el) return null;
  const options =
    typeof reducedMotion === 'boolean'
      ? { ...STICKER_POP_OPTIONS, reducedMotion }
      : { ...STICKER_POP_OPTIONS };
  const handle = runMotion(el, buildStickerPopKeyframes(), options);
  if (onStickerPlayed && handle?.finished && typeof handle.finished.then === 'function') {
    handle.finished
      .then(() => {
        onStickerPlayed(expenseId);
      })
      .catch(() => {});
  }
  return handle;
}

/**
 * Plays the slide-up animation on `el` once per `toast.id`.
 * Tracks the last animated toast id in `lastIdRef` (when supplied) so re-renders
 * with the same toast do not replay, while a new `toast.id` triggers a fresh slide.
 */
export function runToastSlide(el, { toast = null, lastIdRef = null, reducedMotion } = {}) {
  if (!toast || !el) {
    if (lastIdRef) lastIdRef.current = null;
    return null;
  }
  const toastId = toast.id ?? toast.message ?? 'toast';
  if (lastIdRef && lastIdRef.current === toastId) {
    return null;
  }
  if (lastIdRef) {
    lastIdRef.current = toastId;
  }
  const options =
    typeof reducedMotion === 'boolean'
      ? { ...TOAST_SLIDE_OPTIONS, reducedMotion }
      : { ...TOAST_SLIDE_OPTIONS };
  return runMotion(el, buildToastSlideKeyframes(), options);
}
