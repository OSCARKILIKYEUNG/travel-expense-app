import { describe, expect, it } from 'vitest';
import {
  EXPENSE_MENU_FALLBACK_HEIGHT,
  EXPENSE_MENU_FALLBACK_WIDTH,
  placeExpenseActionMenu,
} from './expenseMenuGeometry';

const MENU = { width: EXPENSE_MENU_FALLBACK_WIDTH, height: EXPENSE_MENU_FALLBACK_HEIGHT };

function trigger({ top, right, width = 44, height = 44 }) {
  return {
    top,
    left: right - width,
    right,
    bottom: top + height,
    width,
    height,
  };
}

describe('placeExpenseActionMenu', () => {
  it('opens below a mid-page desktop trigger and right-aligns to it', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 200, right: 900 }),
      menu: MENU,
      viewport: { width: 1280, height: 800 },
    });
    expect(placed).toMatchObject({
      placement: 'below',
      top: 248,
      left: 772,
      width: 128,
      maxHeight: 544,
      triggerVisible: true,
      measurable: true,
    });
  });

  it('keeps the menu inside 320, 390, 430, and desktop widths', () => {
    const cases = [
      { width: 320, left: 180 },
      { width: 390, left: 250 },
      { width: 430, left: 290 },
      { width: 1280, left: 1140 },
    ];
    for (const sample of cases) {
      const placed = placeExpenseActionMenu({
        trigger: trigger({ top: 200, right: sample.width - 12 }),
        menu: MENU,
        viewport: { width: sample.width, height: 800 },
      });
      expect(placed, `width ${sample.width}`).toMatchObject({
        placement: 'below',
        top: 248,
        left: sample.left,
        width: 128,
        maxHeight: 544,
        triggerVisible: true,
      });
      expect(placed.left).toBeGreaterThanOrEqual(8);
      expect(placed.left + placed.width).toBeLessThanOrEqual(sample.width - 8);
    }
  });

  it('opens below the first row and above the last row', () => {
    const first = placeExpenseActionMenu({
      trigger: trigger({ top: 16, right: 370 }),
      menu: MENU,
      viewport: { width: 390, height: 844 },
    });
    expect(first).toMatchObject({ placement: 'below', top: 64, left: 242, maxHeight: 772 });

    const last = placeExpenseActionMenu({
      trigger: trigger({ top: 780, right: 370 }),
      menu: MENU,
      viewport: { width: 390, height: 844 },
    });
    expect(last).toMatchObject({
      placement: 'above',
      top: 688,
      left: 242,
      maxHeight: 768,
      triggerVisible: true,
    });
  });

  it('flips the only row above when the visual bottom cannot fit both actions', () => {
    const widths = [320, 390, 430, 1280];
    const expectedLeft = { 320: 180, 390: 250, 430: 290, 1280: 1140 };
    for (const width of widths) {
      const placed = placeExpenseActionMenu({
        trigger: trigger({ top: 780, right: width - 12 }),
        menu: MENU,
        viewport: { width, height: 844 },
      });
      expect(placed, `width ${width}`).toMatchObject({
        placement: 'above',
        top: 688,
        left: expectedLeft[width],
        maxHeight: 768,
      });
      expect(placed.top).toBeGreaterThanOrEqual(8);
      expect(placed.maxHeight).toBeGreaterThan(0);
    }
  });

  it('caps maxHeight on a short viewport and still prefers the larger side', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 70, right: 300 }),
      menu: MENU,
      viewport: { width: 320, height: 160 },
    });
    expect(placed).toMatchObject({
      placement: 'above',
      top: 8,
      left: 172,
      width: 128,
      maxHeight: 58,
      triggerVisible: true,
    });
    expect(placed.maxHeight).toBeLessThan(MENU.height);
  });

  it('prefers below when the two sides are equal', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 78, right: 300 }),
      menu: MENU,
      viewport: { width: 390, height: 200 },
    });
    expect(placed).toMatchObject({ placement: 'below', top: 126, left: 172, maxHeight: 66 });
  });

  it('clamps a menu that would otherwise start past the left edge', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 200, right: 40 }),
      menu: MENU,
      viewport: { width: 320, height: 700 },
    });
    expect(placed).toMatchObject({
      placement: 'below',
      top: 248,
      left: 8,
      width: 128,
      maxHeight: 444,
      triggerVisible: true,
    });
  });

  it('shrinks the menu width when the viewport is narrower than the menu', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 20, right: 90 }),
      menu: MENU,
      viewport: { width: 100, height: 400 },
    });
    expect(placed).toMatchObject({ placement: 'below', top: 68, left: 8, width: 84, maxHeight: 324 });
  });

  it('keeps a partially visible trigger and reports a fully offscreen trigger', () => {
    const partial = placeExpenseActionMenu({
      trigger: trigger({ top: 780, right: 370 }),
      menu: MENU,
      viewport: { width: 390, height: 800 },
    });
    expect(partial.triggerVisible).toBe(true);
    expect(partial.placement).toBe('above');
    expect(partial.top).toBe(688);

    const above = placeExpenseActionMenu({
      trigger: trigger({ top: -120, right: 200 }),
      menu: MENU,
      viewport: { width: 390, height: 800 },
    });
    expect(above.triggerVisible).toBe(false);

    const below = placeExpenseActionMenu({
      trigger: trigger({ top: 900, right: 200 }),
      menu: MENU,
      viewport: { width: 390, height: 800 },
    });
    expect(below.triggerVisible).toBe(false);

    const sideways = placeExpenseActionMenu({
      trigger: trigger({ top: 40, right: 444 }),
      menu: MENU,
      viewport: { width: 390, height: 800 },
    });
    expect(sideways.triggerVisible).toBe(false);
  });

  it('places inside a visual viewport whose origin is not the layout origin', () => {
    const placed = placeExpenseActionMenu({
      trigger: trigger({ top: 640, right: 370 }),
      menu: MENU,
      viewport: { width: 390, height: 420, offsetLeft: 0, offsetTop: 300 },
    });
    expect(placed).toMatchObject({
      placement: 'above',
      top: 548,
      left: 242,
      maxHeight: 328,
      triggerVisible: true,
    });
    expect(placed.top).toBeGreaterThanOrEqual(300 + 8);
    expect(placed.top).toBeLessThanOrEqual(300 + 420 - 8);
  });

  it('does not treat a zero-size trigger as offscreen', () => {
    const placed = placeExpenseActionMenu({
      trigger: { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 },
      menu: MENU,
      viewport: { width: 390, height: 844 },
    });
    expect(placed).toMatchObject({
      measurable: false,
      triggerVisible: true,
      placement: 'below',
      top: 0,
      left: 0,
    });
  });
});
