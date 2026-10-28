export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export const DURATION_MS = Object.freeze({
  fast: 200,
  normal: 300,
  slow: 400,
});

export const EASING = Object.freeze({
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  springy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
});

export const STICKER = Object.freeze({
  tiltDegMin: -6,
  tiltDegMax: 6,
  scalePeak: 1.05,
});

export const KEYFRAME_NAMES = Object.freeze({
  stickerPop: 'motion-sticker-pop',
  toastSlide: 'motion-toast-slide',
  pageFlip: 'motion-page-flip',
  circleDraw: 'motion-circle-draw',
});
