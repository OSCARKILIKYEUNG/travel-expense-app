// @vitest-environment jsdom
// CSS assertions read source text. jsdom does not apply media queries or
// compute 100dvh, so they are not visual or device verification.
// postcss-value-parser only walks declaration values. It is not a browser
// CSS engine. @csstools/css-calc and jsdom both keep intrinsic keywords
// inside max(), so neither is used as a validator.
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import valueParser from 'postcss-value-parser';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import MagazineCoverView from './MagazineCoverView';
import {
  FOLD_SPRING_MS,
  foldEndPoint,
  isManualFullEnd,
  manualReachForPointer,
  restFoldPoint,
} from './foldGeometry';

// jsdom has no PointerEvent. MouseEvent carries clientX/clientY; the subclass
// adds the pointer fields the cover drag reads. Same stand-in as Auth.test.js.
if (typeof globalThis.PointerEvent === 'undefined') {
  class FakePointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = FakePointerEvent;
}

const css = readFileSync(resolve(process.cwd(), 'src/theme/journal.css'), 'utf8');
const viewSrc = readFileSync(
  resolve(process.cwd(), 'src/components/auth/MagazineCoverView.jsx'),
  'utf8',
);

const MARK = 'mobile-login-usable-viewport';
const STAGE_PAD_PX = 12;

function markedBlock(source, name) {
  const start = source.indexOf(`/* ${name}`);
  const end = source.indexOf(`/* /${name} */`);
  if (start < 0 || end <= start) throw new Error(`missing ${name} block`);
  return source.slice(start, end);
}

function sliceAtRule(source, start) {
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unclosed rule');
}

function ruleBody(block, selector) {
  const at = block.indexOf(selector);
  if (at < 0) throw new Error(`missing ${selector}`);
  const rule = sliceAtRule(block, at);
  return rule.slice(rule.indexOf('{') + 1, rule.lastIndexOf('}'));
}

const MATH_FNS = new Set(['calc', 'min', 'max', 'clamp']);
const INTRINSIC = new Set(['min-content', 'max-content', 'fit-content']);

function intrinsicMathHits(value) {
  const hits = [];
  const visit = (nodes, inMath) => {
    for (const node of nodes) {
      if (inMath && node.type === 'word' && INTRINSIC.has(node.value)) hits.push(node.value);
      const childInMath = inMath || (node.type === 'function' && MATH_FNS.has(node.value));
      if (node.nodes) visit(node.nodes, childInMath);
    }
  };
  visit(valueParser(value).nodes, false);
  return hits;
}

function declarations(block) {
  const stripped = block.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...stripped.matchAll(/(?:^|[{;])\s*([a-zA-Z-]+)\s*:\s*([^;{}]+)/g)].map((match) => ({
    name: match[1],
    value: match[2].trim(),
  }));
}

function domRect({ left, top, width, height }) {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return { left, top, width, height };
    },
  };
}

const boxes = {
  sheet: { left: 10, top: 12, width: 370, height: 820 },
  overlay: { left: 10, top: 560, width: 370, height: 220 },
};

let latestObserver = null;
const originalRect = Element.prototype.getBoundingClientRect;
const originalRO = globalThis.ResizeObserver;
const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function installGeometryDoubles() {
  latestObserver = null;
  globalThis.ResizeObserver = class ResizeObserverMock {
    constructor(callback) {
      this.callback = callback;
      latestObserver = this;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.getBoundingClientRect = function mockRect() {
    const id = this?.getAttribute?.('data-testid');
    if (id === 'auth-magazine-sheet') return domRect(boxes.sheet);
    if (id === 'auth-login-overlay') return domRect(boxes.overlay);
    return originalRect.call(this);
  };
}

function renderCover() {
  const onPageCurlSubmit = vi.fn();
  render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(MagazineCoverView, {
        onPageCurlSubmit,
        onEmailChange: vi.fn(),
        onPasswordChange: vi.fn(),
      }),
    ),
  );
  return onPageCurlSubmit;
}

function readMeasured() {
  const sheet = screen.getByTestId('auth-magazine-sheet');
  return {
    sheet,
    width: Number(sheet.getAttribute('data-measured-width')),
    height: Number(sheet.getAttribute('data-measured-height')),
    overlay: Number(sheet.getAttribute('data-measured-overlay-height')),
  };
}

function flushResize() {
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

function flushObserver() {
  act(() => {
    latestObserver.callback();
  });
}

describe('mobile login cover viewport', () => {
  beforeEach(() => {
    installGeometryDoubles();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Element.prototype.getBoundingClientRect = originalRect;
    if (originalRO === undefined) delete globalThis.ResizeObserver;
    else globalThis.ResizeObserver = originalRO;
    window.innerWidth = originalWidth;
    window.innerHeight = originalHeight;
  });

  it('sizes narrow portrait from 100dvh with a 100vh fallback and a content minimum, and leaves the desktop sheet at 656px', () => {
    const block = markedBlock(css, MARK);
    expect(block).toContain('@media (max-width: 639px)');
    for (const width of [320, 390, 430]) {
      expect(width).toBeLessThanOrEqual(639);
    }

    const stage = ruleBody(block, '.mc-auth-stage.min-h-screen {');
    const vhAt = stage.indexOf('min-height: 100vh');
    const dvhAt = stage.indexOf('min-height: 100dvh');
    expect(vhAt).toBeGreaterThanOrEqual(0);
    expect(dvhAt).toBeGreaterThan(vhAt);
    expect(stage).toContain('height: auto');
    expect(stage).toContain('padding-top: max(0.75rem, env(safe-area-inset-top, 0px))');
    expect(stage).toContain('padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))');
    expect(stage.split('\n').some((line) => /^\s*height:\s*100d?vh/.test(line))).toBe(false);
    expect(block).not.toMatch(/position:\s*fixed/);
    const mobileDecls = declarations(block);
    expect(mobileDecls.some((decl) => decl.name === 'overflow' || decl.name.startsWith('overflow-'))).toBe(
      false,
    );
    expect(block).not.toContain('656px');
    expect(block).not.toContain('calc-size');
    expect(block).not.toContain('.mc-editorial-input');
    expect(block).not.toContain('.mc-cover-image');
    expect(block).not.toContain('url(');

    const sheet = ruleBody(block, '.mc-auth-stage .mc-cover-sheet');
    const vhFloor = 'min-height: calc(100vh - 1.5rem)';
    const dvhFloor =
      'min-height: calc(100dvh - max(0.75rem, env(safe-area-inset-top, 0px)) - max(0.75rem, env(safe-area-inset-bottom, 0px)))';
    expect(sheet.indexOf(vhFloor)).toBeGreaterThanOrEqual(0);
    expect(sheet.indexOf(dvhFloor)).toBeGreaterThan(sheet.indexOf(vhFloor));
    expect(sheet).not.toMatch(/min-content|max-content|fit-content/);
    expect(sheet).toContain('height: auto');
    expect(sheet).toContain('max-height: none');
    expect(sheet).toContain('flex: 1 0 auto');
    expect(sheet.split('\n').some((line) => /^\s*height:\s*100d?vh/.test(line))).toBe(false);

    expect(block).toContain('.mc-auth-stage .mc-cover-leaf,');
    expect(block).toContain('.mc-auth-stage .mc-leaf-front {');
    expect(block).toContain('.mc-auth-stage .mc-upper-scenic-stage');
    const floor = ruleBody(block, '.mc-auth-stage .mc-cover-leaf,');
    expect(floor).toContain('position: relative');
    expect(floor).toContain('flex: 1 0 auto');
    expect(floor).toContain('height: auto');
    expect(floor).toContain('min-height: min-content');
    const frontBase = ruleBody(css, '.mc-leaf-front {');
    expect(frontBase).toContain('position: relative');
    expect(frontBase).toContain('overflow: hidden');
    expect(frontBase).toContain('min-height: 0');
    const scenic = ruleBody(block, '.mc-auth-stage .mc-upper-scenic-stage');
    expect(scenic).toContain('flex: 1 0 auto');
    expect(scenic).toContain('height: auto');
    expect(scenic).toContain('min-height: min-content');

    const overlay = ruleBody(block, '.mc-auth-stage .mc-login-overlay');
    expect(overlay).toContain('margin-top: auto');
    expect(overlay).toContain('flex: 0 0 auto');
    expect(overlay).toContain('height: auto');
    expect(overlay).toContain('min-height: min-content');

    const base = ruleBody(css, '.mc-cover-sheet {');
    expect(base).toContain('min-height: 656px');
    expect(base).not.toContain('100dvh');
    expect(css.match(/min-height:\s*656px/g)).toEqual(['min-height: 656px']);

    const deskStart = css.lastIndexOf(
      '@media (min-width: 1024px)',
      css.indexOf('--fs-hero-lg: 2.375rem'),
    );
    const desk = sliceAtRule(css, deskStart);
    expect(desk).toContain('--fs-hero-lg: 2.375rem');
    expect(desk).not.toContain('min-height');
    expect(desk).not.toContain('100dvh');
    expect(desk).not.toContain('100vh');

    expect(css).toContain('.jr-notebook-shell {\n  min-height: 100vh;\n  min-height: 100dvh;\n}');
    const input = ruleBody(css, '.mc-editorial-input {');
    expect(input).toContain('min-height: 44px');
    const image = ruleBody(css, '.mc-cover-image {');
    expect(image).toContain('height: auto');
    expect(image).toContain('top: 0');
    expect(image).toContain('width: 100%');

    expect(viewSrc).toContain('mc-auth-stage');
    expect(viewSrc).toContain('new window.ResizeObserver');
    expect(viewSrc).toContain("addEventListener('resize'");
    expect(viewSrc).toContain('getBoundingClientRect');
    expect(viewSrc).toContain('observer.observe(sheetRef.current)');
    expect(viewSrc).toContain('observer.observe(overlayRef.current)');
  });

  it('rejects intrinsic keywords inside calc, min, max, and clamp (source text, not a browser)', () => {
    expect(intrinsicMathHits('max(calc(100vh - 1.5rem), min-content)')).toContain('min-content');
    expect(
      intrinsicMathHits(
        'max(calc(100dvh - max(0.75rem, env(safe-area-inset-top, 0px)) - max(0.75rem, env(safe-area-inset-bottom, 0px))), min-content)',
      ),
    ).toContain('min-content');
    expect(intrinsicMathHits('clamp(1rem, max-content, 100dvh)')).toContain('max-content');
    expect(intrinsicMathHits('calc(100vh - fit-content)')).toContain('fit-content');
    expect(intrinsicMathHits('min-content')).toEqual([]);
    expect(intrinsicMathHits('max(0.75rem, env(safe-area-inset-bottom, 0px))')).toEqual([]);
    expect(
      intrinsicMathHits(
        'calc(100dvh - max(0.75rem, env(safe-area-inset-top, 0px)) - max(0.75rem, env(safe-area-inset-bottom, 0px)))',
      ),
    ).toEqual([]);

    const values = declarations(markedBlock(css, MARK)).map((decl) => decl.value);
    expect(values.length).toBeGreaterThan(10);
    for (const value of values) expect(intrinsicMathHits(value), value).toEqual([]);
  });

  it('keeps the desktop stage hooks on the cover and adopts rendered sheet and overlay sizes', () => {
    const filled = [
      { vw: 320, vh: 700, width: 300, height: 700 - STAGE_PAD_PX * 2, overlay: 210 },
      { vw: 390, vh: 844, width: 370, height: 844 - STAGE_PAD_PX * 2, overlay: 220 },
      { vw: 430, vh: 932, width: 410, height: 932 - STAGE_PAD_PX * 2, overlay: 240 },
    ];
    for (const spec of filled) {
      cleanup();
      boxes.sheet = { left: 10, top: STAGE_PAD_PX, width: spec.width, height: spec.height };
      boxes.overlay = { left: 10, top: 400, width: spec.width, height: spec.overlay };
      window.innerWidth = spec.vw;
      window.innerHeight = spec.vh;
      renderCover();
      const stage = screen.getByTestId('auth-magazine-backdrop');
      expect(stage.className).toContain('mc-auth-stage');
      expect(stage.className).toContain('min-h-screen');
      expect(stage.className).toContain('sm:justify-center');
      expect(stage.className).toContain('sm:py-8');
      expect(stage.className).toContain('justify-start');
      const frame = stage.querySelector('.mc-cover-perspective');
      expect(frame.className).toContain('max-w-[440px]');
      expect(frame.className).toContain('sm:max-w-[480px]');
      const measured = readMeasured();
      expect(measured.width).toBe(spec.width);
      expect(measured.height).toBe(spec.height);
      expect(measured.overlay).toBe(spec.overlay);
      expect(stage.querySelector('.mc-cover-spine')).toBeTruthy();
      expect(screen.getByTestId('auth-primary-surface')).toBeTruthy();
    }

    cleanup();
    boxes.sheet = { left: 10, top: STAGE_PAD_PX, width: 370, height: 800 };
    boxes.overlay = { left: 10, top: 560, width: 370, height: 220 };
    window.innerWidth = 390;
    window.innerHeight = 844;
    renderCover();
    expect(readMeasured()).toMatchObject({ width: 370, height: 800, overlay: 220 });

    boxes.sheet = { left: 10, top: STAGE_PAD_PX, width: 370, height: 908 };
    boxes.overlay = { left: 10, top: 640, width: 370, height: 248 };
    flushResize();
    expect(readMeasured()).toMatchObject({ width: 370, height: 908, overlay: 248 });

    boxes.overlay = { left: 10, top: 612, width: 370, height: 276 };
    flushObserver();
    expect(readMeasured()).toMatchObject({ width: 370, height: 908, overlay: 276 });

    vi.useFakeTimers();
    const onPageCurlSubmit = vi.fn();
    cleanup();
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, { onPageCurlSubmit }),
      ),
    );
    const curl = screen.getByTestId('auth-primary-surface');
    const startX = 360;
    const startY = 820;
    fireEvent.pointerDown(curl, {
      pointerId: 7,
      pointerType: 'touch',
      button: 0,
      clientX: startX,
      clientY: startY,
    });
    fireEvent.pointerMove(curl, {
      pointerId: 7,
      pointerType: 'touch',
      clientX: startX - 20,
      clientY: startY,
    });
    const { sheet, width, height } = readMeasured();
    expect(width).toBe(370);
    expect(height).toBe(908);
    expect(screen.getByTestId('auth-curl-geometry-svg').getAttribute('viewBox')).toBe(
      `0 0 ${width} ${height}`,
    );
    const y = Number(sheet.getAttribute('data-fold-y'));
    const rest = restFoldPoint(width, height);
    const previous = restFoldPoint(width, 800);
    expect(Math.abs(y - rest.y)).toBeLessThan(40);
    expect(Math.abs(y - previous.y)).toBeGreaterThan(60);
    expect(onPageCurlSubmit).not.toHaveBeenCalled();
    fireEvent.pointerUp(curl, {
      pointerId: 7,
      pointerType: 'touch',
      clientX: startX - 20,
      clientY: startY,
    });
    expect(onPageCurlSubmit).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    act(() => {
      vi.advanceTimersByTime(FOLD_SPRING_MS);
    });
    expect(onPageCurlSubmit).not.toHaveBeenCalled();
  });

  it('reaches on-screen completion from the measured sheet, and credentials alone do not submit', async () => {
    boxes.sheet = { left: 10, top: STAGE_PAD_PX, width: 410, height: 908 };
    boxes.overlay = { left: 10, top: 680, width: 410, height: 240 };
    window.innerWidth = 430;
    window.innerHeight = 932;
    const onPageCurlSubmit = renderCover();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });
    fireEvent.submit(screen.getByTestId('auth-credentials-form'));
    expect(onPageCurlSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-magazine-backdrop').getAttribute('data-submit-count')).toBe('0');

    const { width, height } = readMeasured();
    expect(width).toBe(410);
    expect(height).toBe(908);
    const end = foldEndPoint(width, height);
    expect(end.x).toBeCloseTo(-1.1 * width, 5);
    expect(end.y).toBe(height);
    expect(end.x).toBeLessThan(0);

    const startX = 400;
    const startY = 900;
    const reach = manualReachForPointer({
      startX,
      startY,
      viewportWidth: 430,
      viewportHeight: 932,
    });
    expect(reach.targetX).toBeGreaterThanOrEqual(0);
    expect(reach.targetX).toBeLessThan(430);
    expect(reach.targetY).toBeGreaterThanOrEqual(0);
    expect(reach.targetY).toBeLessThan(932);
    expect(startX).toBeLessThan(430);
    expect(startY).toBeLessThan(932);
    vi.useFakeTimers();

    const curl = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const partialX = startX + (reach.targetX - startX) * 0.4;
    fireEvent.pointerDown(curl, {
      pointerId: 11,
      pointerType: 'touch',
      button: 0,
      clientX: startX,
      clientY: startY,
    });
    fireEvent.pointerMove(curl, {
      pointerId: 11,
      pointerType: 'touch',
      clientX: partialX,
      clientY: startY,
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(sheet.getAttribute('data-manual-end')).toBe('false');
    expect(isManualFullEnd(
      { x: Number(sheet.getAttribute('data-fold-x')), y: Number(sheet.getAttribute('data-fold-y')) },
      width,
      height,
    )).toBe(false);
    fireEvent.pointerUp(curl, {
      pointerId: 11,
      pointerType: 'touch',
      clientX: partialX,
      clientY: startY,
    });
    expect(onPageCurlSubmit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(FOLD_SPRING_MS);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');

    fireEvent.pointerDown(curl, {
      pointerId: 12,
      pointerType: 'touch',
      button: 0,
      clientX: startX,
      clientY: startY,
    });
    fireEvent.pointerMove(curl, {
      pointerId: 12,
      pointerType: 'touch',
      clientX: reach.targetX,
      clientY: startY,
    });
    expect(sheet.getAttribute('data-manual-end')).toBe('true');
    expect(Number(sheet.getAttribute('data-fold-x'))).toBeCloseTo(end.x, 2);
    expect(Number(sheet.getAttribute('data-fold-y'))).toBeCloseTo(end.y, 2);
    expect(screen.getByTestId('auth-curl-geometry-svg').getAttribute('viewBox')).toBe(
      `0 0 ${width} ${height}`,
    );
    expect(onPageCurlSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-magazine-backdrop').getAttribute('data-turning-page')).toBe(
      'false',
    );

    await act(async () => {
      fireEvent.pointerUp(curl, {
        pointerId: 12,
        pointerType: 'touch',
        clientX: reach.targetX,
        clientY: startY,
      });
    });
    expect(onPageCurlSubmit).toHaveBeenCalledTimes(1);
    expect(onPageCurlSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ gestureCommit: true, pointerType: 'touch', progress: 1 }),
    );
    expect(screen.getByTestId('auth-magazine-backdrop').getAttribute('data-last-submit-source')).toBe(
      'drag',
    );
    expect(screen.getByTestId('auth-magazine-backdrop').getAttribute('data-turning-page')).toBe(
      'false',
    );
  });

  it('keeps a short viewport on the taller intrinsic sheet and completes inside the viewport', async () => {
    const vw = 390;
    const vh = 420;
    boxes.sheet = { left: 10, top: STAGE_PAD_PX, width: 370, height: 680 };
    boxes.overlay = { left: 10, top: 400, width: 370, height: 260 };
    window.innerWidth = vw;
    window.innerHeight = vh;
    const onPageCurlSubmit = renderCover();
    const measured = readMeasured();
    expect(measured.height).toBe(680);
    expect(measured.height).toBeGreaterThan(vh);
    expect(measured.overlay).toBe(260);

    const startX = 350;
    const startY = 390;
    const reach = manualReachForPointer({
      startX,
      startY,
      viewportWidth: vw,
      viewportHeight: vh,
    });
    expect(reach.targetX).toBeGreaterThanOrEqual(0);
    expect(reach.targetX).toBeLessThan(vw);
    expect(reach.targetY).toBeGreaterThanOrEqual(0);
    expect(reach.targetY).toBeLessThan(vh);
    expect(startY).toBeLessThan(vh);

    const curl = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    fireEvent.pointerDown(curl, {
      pointerId: 21,
      pointerType: 'touch',
      button: 0,
      clientX: startX,
      clientY: startY,
    });
    fireEvent.pointerMove(curl, {
      pointerId: 21,
      pointerType: 'touch',
      clientX: reach.targetX,
      clientY: startY,
    });
    expect(reach.targetX).toBeGreaterThanOrEqual(0);
    expect(startY).toBeLessThan(vh);
    expect(sheet.getAttribute('data-manual-end')).toBe('true');
    expect(Number(sheet.getAttribute('data-fold-y'))).toBeCloseTo(680, 2);
    expect(Number(sheet.getAttribute('data-fold-x'))).toBeCloseTo(foldEndPoint(370, 680).x, 2);
    expect(onPageCurlSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.pointerUp(curl, {
        pointerId: 21,
        pointerType: 'touch',
        clientX: reach.targetX,
        clientY: startY,
      });
    });
    expect(onPageCurlSubmit).toHaveBeenCalledTimes(1);
    expect(readMeasured().height).toBe(680);
  });
});
