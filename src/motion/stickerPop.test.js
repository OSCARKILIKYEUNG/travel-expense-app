import { afterEach, describe, expect, it, vi } from 'vitest';
import * as runMotionModule from './runMotion.js';
import {
  STICKER_INITIAL_TILT_DEG,
  STICKER_PEAK_TILT_DEG,
  STICKER_POP_OPTIONS,
  TOAST_SLIDE_OPTIONS,
  buildStickerPopKeyframes,
  buildToastSlideKeyframes,
  isStickerTarget,
  resolveStickerIdAfterSave,
  runStickerPop,
  runToastSlide,
  shouldPlaySticker,
} from './stickerKeyframes.js';
import { DURATION_MS, EASING, REDUCED_MOTION_QUERY, STICKER } from './tokens.js';

const originalMatchMedia = globalThis.matchMedia;

function mockReducedMotion(matches) {
  globalThis.matchMedia = vi.fn((query) => ({
    matches: query === REDUCED_MOTION_QUERY ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function createMockElement() {
  const cancel = vi.fn();
  const animationHandle = {
    finished: Promise.resolve(),
    cancel,
  };
  const animate = vi.fn(() => animationHandle);
  return {
    el: { animate, style: {} },
    animate,
    cancel,
    animationHandle,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMatchMedia === undefined) {
    delete globalThis.matchMedia;
  } else {
    globalThis.matchMedia = originalMatchMedia;
  }
});

describe('stickerKeyframes — deterministic keyframes and add-only predicates', () => {
  it('builds deterministic sticker pop keyframes within token scalePeak and tilt bounds', () => {
    const first = buildStickerPopKeyframes();
    const second = buildStickerPopKeyframes();
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);

    expect(STICKER_INITIAL_TILT_DEG).toBeGreaterThanOrEqual(STICKER.tiltDegMin);
    expect(STICKER_INITIAL_TILT_DEG).toBeLessThanOrEqual(STICKER.tiltDegMax);
    expect(STICKER_PEAK_TILT_DEG).toBeGreaterThanOrEqual(STICKER.tiltDegMin);
    expect(STICKER_PEAK_TILT_DEG).toBeLessThanOrEqual(STICKER.tiltDegMax);

    expect(first[0].transform).toContain(`rotate(${STICKER_INITIAL_TILT_DEG}deg)`);
    expect(first[1].transform).toContain(`scale(${STICKER.scalePeak})`);
    expect(first[1].transform).toContain(`rotate(${STICKER_PEAK_TILT_DEG}deg)`);
    expect(first[2]).toMatchObject({
      offset: 1,
      opacity: 1,
      transform: 'scale(1) rotate(0deg)',
    });

    expect(STICKER_POP_OPTIONS.duration).toBe(DURATION_MS.normal);
    expect(STICKER_POP_OPTIONS.duration).toBeGreaterThanOrEqual(200);
    expect(STICKER_POP_OPTIONS.duration).toBeLessThanOrEqual(400);
    expect(STICKER_POP_OPTIONS.easing).toBe(EASING.springy);
  });

  it('clamps custom tilt values to STICKER bounds', () => {
    const clamped = buildStickerPopKeyframes({
      initialTiltDeg: -99,
      peakTiltDeg: 99,
    });
    expect(clamped[0].transform).toContain(`rotate(${STICKER.tiltDegMin}deg)`);
    expect(clamped[1].transform).toContain(`rotate(${STICKER.tiltDegMax}deg)`);
  });

  it('activates stickerId only for add (!isEdit) and never for edit', () => {
    expect(shouldPlaySticker({ isEdit: false })).toBe(true);
    expect(shouldPlaySticker({ isEdit: true })).toBe(false);

    expect(resolveStickerIdAfterSave({ isEdit: false, savedId: 'n101' })).toBe('n101');
    expect(resolveStickerIdAfterSave({ isEdit: false, savedId: 1729490000999 })).toBe(
      1729490000999,
    );
    expect(resolveStickerIdAfterSave({ isEdit: true, savedId: 'n101' })).toBeNull();
    expect(resolveStickerIdAfterSave({ isEdit: false, savedId: null })).toBeNull();
    expect(resolveStickerIdAfterSave({ isEdit: false, savedId: '' })).toBeNull();

    expect(isStickerTarget('n101', 'n101')).toBe(true);
    expect(isStickerTarget(101, '101')).toBe(true);
    expect(isStickerTarget('n102', 'n101')).toBe(false);
    expect(isStickerTarget('n101', null)).toBe(false);
    expect(isStickerTarget(null, null)).toBe(false);
  });
});

describe('runStickerPop & runToastSlide', () => {
  it('invokes runMotion on add (stickerPop: true) when motion is allowed and calls onStickerPlayed after finish', async () => {
    mockReducedMotion(false);
    const spy = vi.spyOn(runMotionModule, 'runMotion');
    const { el, animate } = createMockElement();
    const onStickerPlayed = vi.fn();

    const handle = runStickerPop(el, {
      stickerPop: true,
      expenseId: 'e-new',
      onStickerPlayed,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      el,
      buildStickerPopKeyframes(),
      expect.objectContaining({
        duration: DURATION_MS.normal,
        easing: EASING.springy,
      }),
    );
    expect(animate).toHaveBeenCalledTimes(1);
    expect(el.style.pointerEvents).toBeUndefined();

    await handle.finished;
    expect(onStickerPlayed).toHaveBeenCalledWith('e-new');
  });

  it('skips runMotion on edit (stickerPop: false) and no-ops animate under reduced motion', async () => {
    mockReducedMotion(false);
    const spy = vi.spyOn(runMotionModule, 'runMotion');
    const { el, animate } = createMockElement();

    const editResult = runStickerPop(el, { stickerPop: false, expenseId: 'e-edit' });
    expect(editResult).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();

    mockReducedMotion(true);
    const reduceHandle = runStickerPop(el, { stickerPop: true, expenseId: 'e-reduce' });
    expect(reduceHandle).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
    expect(el.style.pointerEvents).toBeUndefined();
    await expect(reduceHandle.finished).resolves.toBeUndefined();
  });

  it('slides toast once per toast.id when motion is allowed and no-ops when reduced', async () => {
    mockReducedMotion(false);
    const { el, animate } = createMockElement();
    const lastIdRef = { current: null };

    const toastA = { id: 't-1', message: '已記錄 HK$88 · 10月22日' };
    runToastSlide(el, { toast: toastA, lastIdRef });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      buildToastSlideKeyframes(),
      expect.objectContaining({
        duration: TOAST_SLIDE_OPTIONS.duration,
        easing: TOAST_SLIDE_OPTIONS.easing,
      }),
    );

    // Same toast.id on hover/focus re-render does not replay
    runToastSlide(el, { toast: toastA, lastIdRef });
    expect(animate).toHaveBeenCalledTimes(1);

    // Replacement toast with new id slides again
    const toastB = { id: 't-2', message: '已刪除 HK$88 · 10月22日' };
    runToastSlide(el, { toast: toastB, lastIdRef });
    expect(animate).toHaveBeenCalledTimes(2);

    // Reduced motion no-ops el.animate
    mockReducedMotion(true);
    const toastC = { id: 't-3', message: '已更新 HK$120 · 10月22日' };
    const handle = runToastSlide(el, { toast: toastC, lastIdRef });
    expect(animate).toHaveBeenCalledTimes(2);
    await expect(handle.finished).resolves.toBeUndefined();
  });
});
