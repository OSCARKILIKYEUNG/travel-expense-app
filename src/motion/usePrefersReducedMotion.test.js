import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REDUCED_MOTION_QUERY } from './tokens.js';
import {
  getPrefersReducedMotion,
  subscribePrefersReducedMotion,
  usePrefersReducedMotion,
} from './usePrefersReducedMotion.js';

const originalMatchMedia = globalThis.matchMedia;

function createMockMatchMedia(initialMatches = false) {
  const listeners = new Set();
  const mql = {
    matches: initialMatches,
    media: REDUCED_MOTION_QUERY,
    addEventListener: vi.fn((event, handler) => {
      if (event === 'change') listeners.add(handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (event === 'change') listeners.delete(handler);
    }),
    dispatchChange(nextMatches) {
      mql.matches = nextMatches;
      for (const listener of [...listeners]) {
        listener({ matches: nextMatches, media: REDUCED_MOTION_QUERY });
      }
    },
  };
  const matchMedia = vi.fn(() => mql);
  return { matchMedia, mql, listeners };
}

afterEach(() => {
  if (originalMatchMedia === undefined) {
    delete globalThis.matchMedia;
  } else {
    globalThis.matchMedia = originalMatchMedia;
  }
});

describe('getPrefersReducedMotion', () => {
  it('returns false safely when matchMedia is missing', () => {
    delete globalThis.matchMedia;
    expect(getPrefersReducedMotion()).toBe(false);
    expect(getPrefersReducedMotion({})).toBe(false);
  });

  it('returns true when prefers-reduced-motion matches and false when it does not', () => {
    const onMock = createMockMatchMedia(true);
    globalThis.matchMedia = onMock.matchMedia;
    expect(getPrefersReducedMotion()).toBe(true);
    expect(onMock.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);

    const offMock = createMockMatchMedia(false);
    globalThis.matchMedia = offMock.matchMedia;
    expect(getPrefersReducedMotion()).toBe(false);
    expect(offMock.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
  });
});

describe('subscribePrefersReducedMotion & usePrefersReducedMotion', () => {
  it('subscribes to change events and cleans up listener on unsubscribe', () => {
    const { matchMedia, mql, listeners } = createMockMatchMedia(false);
    globalThis.matchMedia = matchMedia;

    const seen = [];
    const unsubscribe = subscribePrefersReducedMotion((matches) => {
      seen.push(matches);
    });

    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);

    mql.dispatchChange(true);
    mql.dispatchChange(false);
    expect(seen).toEqual([true, false]);

    unsubscribe();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);

    mql.dispatchChange(true);
    expect(seen).toEqual([true, false]);
  });

  it('supports legacy addListener / removeListener fallback and missing matchMedia', () => {
    delete globalThis.matchMedia;
    const noopCleanup = subscribePrefersReducedMotion(() => {});
    expect(() => noopCleanup()).not.toThrow();

    let savedHandler = null;
    const legacyMql = {
      matches: false,
      addListener: vi.fn((fn) => {
        savedHandler = fn;
      }),
      removeListener: vi.fn(),
    };
    const target = { matchMedia: vi.fn(() => legacyMql) };
    const onChange = vi.fn();

    const cleanup = subscribePrefersReducedMotion(onChange, target);
    expect(legacyMql.addListener).toHaveBeenCalledTimes(1);

    legacyMql.matches = true;
    savedHandler({});
    expect(onChange).toHaveBeenCalledWith(true);

    cleanup();
    expect(legacyMql.removeListener).toHaveBeenCalledWith(savedHandler);
  });

  it('reads current reduced-motion state in usePrefersReducedMotion hook', () => {
    function Probe() {
      const reduced = usePrefersReducedMotion();
      return createElement('span', { 'data-reduced': String(reduced) });
    }

    globalThis.matchMedia = createMockMatchMedia(false).matchMedia;
    expect(renderToStaticMarkup(createElement(Probe))).toContain('data-reduced="false"');

    globalThis.matchMedia = createMockMatchMedia(true).matchMedia;
    expect(renderToStaticMarkup(createElement(Probe))).toContain('data-reduced="true"');
  });
});
