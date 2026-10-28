import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runMotion } from './runMotion.js';
import { DURATION_MS, EASING, KEYFRAME_NAMES, REDUCED_MOTION_QUERY, STICKER } from './tokens.js';

const originalMatchMedia = globalThis.matchMedia;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
  if (originalMatchMedia === undefined) {
    delete globalThis.matchMedia;
  } else {
    globalThis.matchMedia = originalMatchMedia;
  }
});

describe('motion tokens & CSS keyframes', () => {
  it('keeps all token durations within [200, 400] ms and defines sticker & easing tokens', () => {
    const durations = Object.values(DURATION_MS);
    expect(durations.length).toBeGreaterThanOrEqual(3);
    for (const ms of durations) {
      expect(typeof ms).toBe('number');
      expect(ms).toBeGreaterThanOrEqual(200);
      expect(ms).toBeLessThanOrEqual(400);
    }

    expect(EASING.out).toMatch(/^cubic-bezier\(/);
    expect(EASING.inOut).toMatch(/^cubic-bezier\(/);
    expect(EASING.springy).toMatch(/^cubic-bezier\(/);

    expect(STICKER.tiltDegMin).toBeLessThan(0);
    expect(STICKER.tiltDegMax).toBeGreaterThan(0);
    expect(STICKER.scalePeak).toBeGreaterThan(1);
    expect(STICKER.scalePeak).toBeLessThanOrEqual(1.1);
  });

  it('declares named @keyframes in src/index.css and preserves prefers-reduced-motion rule', () => {
    const css = fs.readFileSync(path.join(repoRoot, 'src/index.css'), 'utf8');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    for (const name of Object.values(KEYFRAME_NAMES)) {
      expect(css).toContain(`@keyframes ${name}`);
    }
  });
});

describe('runMotion', () => {
  const sampleKeyframes = [
    { opacity: 0, transform: 'scale(0.95)' },
    { opacity: 1, transform: 'scale(1)' },
  ];

  it('short-circuits without calling el.animate when prefers-reduced-motion is on', async () => {
    mockReducedMotion(true);
    const { el, animate } = createMockElement();

    const handle = runMotion(el, sampleKeyframes);

    expect(animate).not.toHaveBeenCalled();
    expect(handle).toBeTruthy();
    await expect(handle.finished).resolves.toBeUndefined();
    expect(() => handle.cancel()).not.toThrow();
    expect(el.style.pointerEvents).toBeUndefined();
  });

  it('calls el.animate once with token defaults in [200, 400] ms when prefers-reduced-motion is off', async () => {
    mockReducedMotion(false);
    const { el, animate, cancel } = createMockElement();

    const handle = runMotion(el, sampleKeyframes);

    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframesArg, optionsArg] = animate.mock.calls[0];
    expect(keyframesArg).toBe(sampleKeyframes);
    expect(optionsArg.duration).toBe(DURATION_MS.normal);
    expect(optionsArg.duration).toBeGreaterThanOrEqual(200);
    expect(optionsArg.duration).toBeLessThanOrEqual(400);
    expect(optionsArg.easing).toBe(EASING.out);
    expect(optionsArg.fill).toBe('both');
    expect(el.style.pointerEvents).toBeUndefined();

    await expect(handle.finished).resolves.toBeUndefined();
    handle.cancel();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('merges caller options and no-ops safely when el or el.animate is missing', async () => {
    mockReducedMotion(false);
    const { el, animate } = createMockElement();

    runMotion(el, sampleKeyframes, {
      duration: DURATION_MS.fast,
      easing: EASING.springy,
      fill: 'forwards',
    });

    expect(animate).toHaveBeenCalledWith(sampleKeyframes, {
      duration: DURATION_MS.fast,
      easing: EASING.springy,
      fill: 'forwards',
    });

    const nullHandle = runMotion(null, sampleKeyframes);
    await expect(nullHandle.finished).resolves.toBeUndefined();
    expect(() => nullHandle.cancel()).not.toThrow();

    const noAnimateHandle = runMotion({}, sampleKeyframes);
    await expect(noAnimateHandle.finished).resolves.toBeUndefined();
    expect(() => noAnimateHandle.cancel()).not.toThrow();
  });
});
