// @vitest-environment jsdom
/**
 * Ledger expense action menu.
 * The containment test below failed on the pre-ticket card: the open menu was
 * inside article.jr-torn, whose mask clips paint outside the card.
 * Expense cards are now article.jr-ticket (overflow clip, no torn mask).
 * The menu stays a body portal so the ticket cannot clip it. .jr-torn remains
 * a journal utility and is not applied to these cards.
 * Rectangles are mocked. jsdom does not paint, run native Tab traversal,
 * or reproduce iOS visualViewport behavior.
 * A fixed body portal shares layout-viewport space with the raw trigger
 * rect. The visible window is visualViewport width/height at offsetLeft
 * and offsetTop. Those offsets are not added onto the raw rect.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ExpenseCard from './ExpenseCard';
import {
  EXPENSE_MENU_FALLBACK_HEIGHT,
  EXPENSE_MENU_FALLBACK_WIDTH,
  placeExpenseActionMenu,
} from './expenseMenuGeometry';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

const zara = {
  id: 'zara-odaiba',
  date: '2026-12-21',
  category: '購物',
  assignedTo: '共同',
  payer: 'Oscar',
  payment: 'card',
  scanned: false,
  store: 'ZARA 台場店',
  place: '東京台場',
  currency: 'JPY',
  originalAmount: 18732,
  hkdAmount: 937,
};

function expenseAt(id, store) {
  return { ...zara, id, store };
}

let restoreVisual = () => {};

afterEach(() => {
  cleanup();
  restoreVisual();
  restoreVisual = () => {};
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

function renderClipped(expenses, handlers = {}) {
  const list = Array.isArray(expenses) ? expenses : [expenses];
  return render(
    createElement(
      'div',
      {
        'data-testid': 'ledger-clip',
        className: 'overflow-x-hidden',
        style: { overflowX: 'hidden', overflowY: 'auto' },
      },
      createElement(
        'div',
        {
          'data-testid': 'swipe-clip',
          style: { overflow: 'hidden', transform: 'translateX(0px)' },
        },
        ...list.map((expense) => createElement(ExpenseCard, {
          key: expense.id,
          expense,
          onEdit: handlers.onEdit || (() => {}),
          onDelete: handlers.onDelete || (() => {}),
        })),
      ),
    ),
  );
}

function moreButtons() {
  return screen.getAllByRole('button', { name: /更多動作|More actions/ });
}

function setRect(button, rect) {
  button.getBoundingClientRect = () => ({ ...rect });
}

function rectAt(top, viewportWidth, height = 44) {
  const width = 44;
  const right = viewportWidth - 12;
  return {
    top,
    left: right - width,
    right,
    bottom: top + height,
    width,
    height,
  };
}

function assertMenuOutsideClip(menu) {
  const articles = document.querySelectorAll('article.jr-ticket');
  expect(articles.length).toBeGreaterThan(0);
  for (const article of articles) {
    expect(article.contains(menu)).toBe(false);
  }
  expect(screen.getByTestId('ledger-clip').contains(menu)).toBe(false);
  expect(screen.getByTestId('swipe-clip').contains(menu)).toBe(false);
  expect(menu.parentElement).toBe(document.body);
}

function dispatchKey(target, init) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function expectWiredPlacement(menu, rect, viewport) {
  const expected = placeExpenseActionMenu({
    trigger: rect,
    menu: { width: EXPENSE_MENU_FALLBACK_WIDTH, height: EXPENSE_MENU_FALLBACK_HEIGHT },
    viewport: {
      width: viewport.width,
      height: viewport.height,
      offsetLeft: viewport.offsetLeft || 0,
      offsetTop: viewport.offsetTop || 0,
    },
  });
  expect(menu.getAttribute('data-measured')).toBe('true');
  expect(menu.getAttribute('data-placement')).toBe(expected.placement);
  expect(menu.style.top).toBe(`${expected.top}px`);
  expect(menu.style.left).toBe(`${expected.left}px`);
  expect(menu.style.width).toBe(`${expected.width}px`);
  expect(menu.style.maxHeight).toBe(`${expected.maxHeight}px`);
  expect(menu.className).toContain('fixed');
  expect(menu.className).not.toContain('absolute');
}

function installVisualViewport(initial) {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const listeners = { resize: new Set(), scroll: new Set() };
  const visual = {
    width: initial.width,
    height: initial.height,
    offsetLeft: initial.offsetLeft || 0,
    offsetTop: initial.offsetTop || 0,
    addEventListener(type, fn) {
      listeners[type]?.add(fn);
    },
    removeEventListener(type, fn) {
      listeners[type]?.delete(fn);
    },
    dispatch(type) {
      for (const fn of listeners[type] || []) fn();
    },
    counts() {
      return { resize: listeners.resize.size, scroll: listeners.scroll.size };
    },
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: visual });
  restoreVisual = () => {
    if (previous) Object.defineProperty(window, 'visualViewport', previous);
    else delete window.visualViewport;
  };
  return visual;
}

describe('expense action menu clipping regression', () => {
  it('keeps Edit and Delete outside the masked card and overflow/transform ancestors', () => {
    renderClipped(zara);
    fireEvent.click(moreButtons()[0]);

    const menu = screen.getByRole('menu');
    const edit = screen.getByRole('menuitem', { name: /編輯|Edit/ });
    const remove = screen.getByRole('menuitem', { name: /刪除|Delete/ });
    expect(menu.contains(edit)).toBe(true);
    expect(menu.contains(remove)).toBe(true);
    expect(edit.className).toContain('min-h-11');
    expect(remove.className).toContain('min-h-11');
    expect(moreButtons()[0].className).toContain('min-h-11');
    expect(moreButtons()[0].className).toContain('min-w-11');
    expect(edit.textContent).toContain(i18n.t('expenseCard.edit'));
    expect(remove.textContent).toContain(i18n.t('expenseCard.delete'));

    const article = document.querySelector('article.jr-ticket');
    expect(article).toBeTruthy();
    expect(article.className).toContain('jr-ticket');
    expect(article.className).not.toContain('jr-torn');
    expect(article.contains(menu)).toBe(false);
    expect(screen.getByTestId('ledger-clip').contains(menu)).toBe(false);
    expect(screen.getByTestId('swipe-clip').contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
  });
});

describe('expense action menu placement', () => {
  it('anchors first, middle, last, and only rows at phone and desktop widths', () => {
    const widths = [
      { width: 320, height: 700 },
      { width: 390, height: 844 },
      { width: 430, height: 844 },
      { width: 1280, height: 900 },
    ];
    const rows = [
      expenseAt('first', 'First'),
      expenseAt('middle', 'Middle'),
      expenseAt('last', 'Last'),
    ];
    for (const viewport of widths) {
      window.innerWidth = viewport.width;
      window.innerHeight = viewport.height;
      cleanup();
      renderClipped(rows);
      const tops = [24, 360, viewport.height - 70];
      const buttons = moreButtons();
      buttons.forEach((button, index) => setRect(button, rectAt(tops[index], viewport.width)));

      buttons.forEach((button, index) => {
        fireEvent.click(button);
        const menu = screen.getByRole('menu');
        assertMenuOutsideClip(menu);
        expect(screen.getAllByRole('menuitem')).toHaveLength(2);
        expectWiredPlacement(menu, rectAt(tops[index], viewport.width), viewport);
        fireEvent.keyDown(document.activeElement, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
      });
    }

    cleanup();
    window.innerWidth = 390;
    window.innerHeight = 844;
    renderClipped(zara);
    const only = moreButtons()[0];
    const onlyRect = rectAt(760, 390);
    setRect(only, onlyRect);
    fireEvent.click(only);
    const onlyMenu = screen.getByRole('menu');
    assertMenuOutsideClip(onlyMenu);
    expectWiredPlacement(onlyMenu, onlyRect, { width: 390, height: 844 });
    expect(onlyMenu.getAttribute('data-placement')).toBe('above');
  });

  it('places a fixed menu inside the offset visual viewport without translating the raw rect', () => {
    const visual = installVisualViewport({
      width: 390,
      height: 320,
      offsetLeft: 15,
      offsetTop: 180,
    });
    window.innerWidth = 390;
    window.innerHeight = 900;
    renderClipped(zara);
    const button = moreButtons()[0];
    const rect = { top: 260, left: 316, right: 360, bottom: 304, width: 44, height: 44 };
    const viewport = { width: 390, height: 320, offsetLeft: 15, offsetTop: 180 };
    setRect(button, rect);
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    expect(rect.top).toBe(260);
    expectWiredPlacement(menu, rect, viewport);
    expect(menu.getAttribute('data-placement')).toBe('below');
    expect(menu.style.top).toBe('308px');
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(viewport.offsetTop);
    expect(visual.counts().scroll).toBe(1);
    expect(visual.counts().resize).toBe(1);
  });

  it('keeps a raw layout-space trigger that intersects the offset visual viewport', () => {
    // Visible window x15..405, y180..500. Raw trigger x316..360, y400..444
    // intersects it. Origin 0 treats y400 as below a 320px window and closes.
    installVisualViewport({
      width: 390,
      height: 320,
      offsetLeft: 15,
      offsetTop: 180,
    });
    window.innerWidth = 390;
    window.innerHeight = 900;
    const rect = { top: 400, left: 316, right: 360, bottom: 444, width: 44, height: 44 };
    const viewport = { width: 390, height: 320, offsetLeft: 15, offsetTop: 180 };
    expect(placeExpenseActionMenu({
      trigger: rect,
      menu: { width: EXPENSE_MENU_FALLBACK_WIDTH, height: EXPENSE_MENU_FALLBACK_HEIGHT },
      viewport,
    }).triggerVisible).toBe(true);

    renderClipped(zara);
    const button = moreButtons()[0];
    setRect(button, rect);
    fireEvent.click(button);
    const menu = screen.queryByRole('menu');
    expect(menu).toBeTruthy();
    assertMenuOutsideClip(menu);
    expectWiredPlacement(menu, rect, viewport);
    expect(menu.getAttribute('data-placement')).toBe('above');
    expect(menu.style.top).toBe('308px');
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(viewport.offsetTop);
    expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(viewport.offsetLeft);
  });

  it('follows scroll and resize, and closes when the trigger leaves the viewport', () => {
    window.innerWidth = 390;
    window.innerHeight = 800;
    renderClipped(zara);
    const button = moreButtons()[0];
    const focusSpy = vi.spyOn(button, 'focus');
    let rect = rectAt(120, 390);
    button.getBoundingClientRect = () => ({ ...rect });
    try {
      fireEvent.click(button);
      const menu = screen.getByRole('menu');
      expectWiredPlacement(menu, rect, { width: 390, height: 800 });

      rect = rectAt(200, 390);
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expectWiredPlacement(menu, rect, { width: 390, height: 800 });

      rect = rectAt(740, 390);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });
      expect(menu.getAttribute('data-placement')).toBe('above');
      expectWiredPlacement(menu, rect, { width: 390, height: 800 });

      rect = rectAt(180, 390);
      act(() => {
        screen.getByTestId('ledger-clip').dispatchEvent(new Event('scroll', { bubbles: false }));
      });
      expectWiredPlacement(menu, rect, { width: 390, height: 800 });
      expect(menu.getAttribute('data-placement')).toBe('below');

      rect = rectAt(-220, 390);
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(button);
      expect(focusSpy.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);
    } finally {
      focusSpy.mockRestore();
    }
  });

  it('repositions on visual viewport scroll and drops listeners on close and unmount', () => {
    const visual = installVisualViewport({ width: 390, height: 500, offsetTop: 0, offsetLeft: 0 });
    window.innerWidth = 800;
    window.innerHeight = 800;
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const view = renderClipped(zara);
    const button = moreButtons()[0];
    let rect = rectAt(80, 390);
    button.getBoundingClientRect = () => ({ ...rect });
    fireEvent.click(button);
    expect(visual.counts()).toEqual({ resize: 1, scroll: 1 });
    expect(add.mock.calls.some((call) => call[0] === 'scroll' && call[2] === true)).toBe(true);

    rect = rectAt(300, 390);
    act(() => {
      visual.dispatch('scroll');
    });
    expectWiredPlacement(screen.getByRole('menu'), rect, { width: 390, height: 500 });

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(visual.counts()).toEqual({ resize: 0, scroll: 0 });
    expect(remove.mock.calls.some((call) => call[0] === 'scroll' && call[2] === true)).toBe(true);
    expect(remove.mock.calls.some((call) => call[0] === 'resize' && call[1])).toBe(true);

    fireEvent.click(button);
    expect(visual.counts().scroll).toBe(1);
    view.unmount();
    expect(visual.counts()).toEqual({ resize: 0, scroll: 0 });
    expect(() => visual.dispatch('resize')).not.toThrow();
    add.mockRestore();
    remove.mockRestore();
  });

  it('caps a short viewport without removing either action', () => {
    window.innerWidth = 320;
    window.innerHeight = 160;
    renderClipped(zara);
    const button = moreButtons()[0];
    const rect = rectAt(70, 320);
    setRect(button, rect);
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    expectWiredPlacement(menu, rect, { width: 320, height: 160 });
    expect(Number.parseFloat(menu.style.maxHeight)).toBeLessThan(EXPENSE_MENU_FALLBACK_HEIGHT);
    expect(menu.className).toContain('overflow-y-auto');
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    assertMenuOutsideClip(menu);
  });
});

describe('expense action menu behavior', () => {
  it('keeps the menu open for an inside pointer and runs edit once', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderClipped(zara, { onEdit, onDelete });
    fireEvent.click(moreButtons()[0]);
    const menu = screen.getByRole('menu');
    const edit = screen.getByRole('menuitem', { name: /編輯|Edit/ });
    fireEvent.pointerDown(menu);
    fireEvent.pointerDown(edit);
    expect(screen.getByRole('menu')).toBe(menu);
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(zara);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('runs delete confirmation once and cancel zero times', () => {
    const onDelete = vi.fn();
    renderClipped(zara, { onDelete });
    fireEvent.click(moreButtons()[0]);
    const remove = screen.getByRole('menuitem', { name: /刪除|Delete/ });
    fireEvent.pointerDown(remove);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(remove);
    expect(onDelete).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain(zara.store);
    expect(dialog.textContent).toContain(i18n.t('notebook.expenseCard.confirmDeleteTitle'));

    const cancel = screen.getByRole('button', { name: i18n.t('deleteDialog.cancel') });
    fireEvent.pointerDown(cancel);
    fireEvent.click(cancel);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(moreButtons()[0]);
    fireEvent.pointerDown(screen.getByRole('menuitem', { name: /刪除|Delete/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /刪除|Delete/ }));
    const confirm = screen.getByTestId('confirm-delete');
    fireEvent.pointerDown(confirm);
    fireEvent.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(zara);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves with arrows, and Tab or Escape restores the trigger without a DOM scan', () => {
    // CSS-hidden controls stay in the DOM. jsdom does not apply Tailwind and
    // does not perform native Tab, so this checks the handler contract only:
    // close, focus the trigger with preventScroll, and leave the key default.
    const hiddenBefore = document.createElement('button');
    hiddenBefore.type = 'button';
    hiddenBefore.className = 'lg:hidden';
    hiddenBefore.style.display = 'none';
    hiddenBefore.textContent = 'hidden-before';
    const hiddenAfter = document.createElement('button');
    hiddenAfter.type = 'button';
    hiddenAfter.className = 'lg:hidden';
    hiddenAfter.style.display = 'none';
    hiddenAfter.textContent = 'hidden-after';
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    renderClipped(zara);
    document.body.prepend(hiddenBefore);
    document.body.appendChild(hiddenAfter);
    try {
      const trigger = moreButtons()[0];
      fireEvent.click(trigger);
      const edit = screen.getByRole('menuitem', { name: /編輯|Edit/ });
      const remove = screen.getByRole('menuitem', { name: /刪除|Delete/ });
      expect(document.activeElement).toBe(edit);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusSpy.mock.instances.at(-1)).toBe(edit);

      fireEvent.keyDown(edit, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(remove);
      fireEvent.keyDown(remove, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(edit);
      fireEvent.keyDown(edit, { key: 'End' });
      expect(document.activeElement).toBe(remove);
      fireEvent.keyDown(remove, { key: 'Home' });
      expect(document.activeElement).toBe(edit);

      focusSpy.mockClear();
      const tab = dispatchKey(edit, { key: 'Tab' });
      expect(tab.defaultPrevented).toBe(false);
      expect(tab.shiftKey).toBe(false);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusSpy.mock.instances.at(-1)).toBe(trigger);
      expect(document.activeElement).toBe(trigger);
      expect(document.activeElement).not.toBe(hiddenAfter);

      focusSpy.mockClear();
      fireEvent.click(trigger);
      const editAgain = screen.getByRole('menuitem', { name: /編輯|Edit/ });
      const shiftTab = dispatchKey(editAgain, { key: 'Tab', shiftKey: true });
      expect(shiftTab.defaultPrevented).toBe(false);
      expect(shiftTab.shiftKey).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusSpy.mock.instances.at(-1)).toBe(trigger);
      expect(document.activeElement).toBe(trigger);
      expect(document.activeElement).not.toBe(hiddenBefore);

      fireEvent.click(trigger);
      focusSpy.mockClear();
      const escape = dispatchKey(document.activeElement, { key: 'Escape' });
      expect(escape.defaultPrevented).toBe(true);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(focusSpy).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      expect(focusSpy.mock.instances[0]).toBe(trigger);
    } finally {
      hiddenBefore.remove();
      hiddenAfter.remove();
      focusSpy.mockRestore();
    }
  });

  it('activates delete from the focused item and cancels the dialog with Escape', () => {
    const onDelete = vi.fn();
    renderClipped(zara, { onDelete });
    fireEvent.click(moreButtons()[0]);
    const edit = screen.getByRole('menuitem', { name: /編輯|Edit/ });
    fireEvent.keyDown(edit, { key: 'ArrowDown' });
    act(() => {
      document.activeElement.click();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('closes on an outside pointer and returns focus from the menu', () => {
    renderClipped(zara);
    const trigger = moreButtons()[0];
    const focusSpy = vi.spyOn(trigger, 'focus');
    try {
      fireEvent.click(trigger);
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /編輯|Edit/ }));
      fireEvent.pointerDown(document.querySelector('article.jr-ticket'));
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(focusSpy.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);
    } finally {
      focusSpy.mockRestore();
    }
  });
});

describe('clipping ancestors that the portal must escape', () => {
  it('still masks the torn card and keeps the horizontal and swipe safeguards', () => {
    const journal = readFileSync(join(srcRoot, 'theme/journal.css'), 'utf8');
    const tornStart = journal.indexOf('.jr-torn {');
    const torn = journal.slice(tornStart, journal.indexOf('}', tornStart));
    expect(torn).toMatch(/mask-image:/);
    expect(torn).toMatch(/-webkit-mask-image:/);

    const ledger = readFileSync(join(srcRoot, 'proto/ref/Ledger.jsx'), 'utf8');
    expect(ledger).toMatch(/data-testid="ledger"[\s\S]{0,240}overflow-x-hidden[\s\S]{0,120}lg:overflow-visible/);

    const dayView = readFileSync(join(srcRoot, 'proto/ref/DayView.jsx'), 'utf8');
    expect(dayView).toContain('overflow-hidden');
    expect(dayView).toContain('translateX');

    const indexCss = readFileSync(join(srcRoot, 'index.css'), 'utf8');
    expect(indexCss).toMatch(/overflow-x:\s*clip/);
    expect(indexCss).toMatch(/overflow-y:\s*visible/);
    expect(indexCss).not.toMatch(/touch-action:\s*none/);
  });
});
