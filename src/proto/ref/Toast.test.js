// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { Toast } from './parts';
import { ERROR_TOAST_DURATION_MS, TOAST_DURATION_MS, UNDO_TOAST_DURATION_MS, toastDurationMs } from './refRules';

// jsdom has no PointerEvent, so fireEvent would drop pointerType; polyfill it for this file.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEventPolyfill extends window.MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerType = init.pointerType || '';
    }
  }
  window.PointerEvent = PointerEventPolyfill;
}

afterEach(() => {
  cleanup();
});

describe('Toast undo dismiss and pointer hover', () => {
  it('renders the dismiss control beside undo and ignores non-mouse pointers', () => {
    const onHoverChange = vi.fn();
    const undoToast = { id: 'undo-1', message: '已刪除', undo: { kind: 'delete' }, tone: 'default' };

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Toast, {
          toast: undoToast,
          onUndo: () => {},
          onDismiss: () => {},
          onHoverChange,
        }),
      ),
    );

    expect(screen.getByTestId('toast-undo')).toBeTruthy();
    expect(screen.getByTestId('toast-dismiss')).toBeTruthy();

    const toast = screen.getByTestId('toast');
    // React fires onPointerEnter from pointerover, and onPointerLeave from pointerout.
    fireEvent.pointerOver(toast, { pointerType: 'touch' });
    fireEvent.pointerOut(toast, { pointerType: 'touch' });
    expect(onHoverChange).not.toHaveBeenCalled();

    fireEvent.pointerOver(toast, { pointerType: 'mouse' });
    expect(onHoverChange).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledWith(true);

    fireEvent.pointerOut(toast, { pointerType: 'mouse' });
    expect(onHoverChange).toHaveBeenCalledTimes(2);
    expect(onHoverChange).toHaveBeenLastCalledWith(false);
  });

  it('uses 5000ms for undo, 8000ms for error, and 6000ms otherwise', () => {
    expect(UNDO_TOAST_DURATION_MS).toBe(5000);
    expect(toastDurationMs({ undo: { kind: 'add' } })).toBe(5000);
    expect(toastDurationMs({ undo: true })).toBe(UNDO_TOAST_DURATION_MS);
    expect(toastDurationMs({ tone: 'error' })).toBe(ERROR_TOAST_DURATION_MS);
    expect(toastDurationMs({ tone: 'error' })).toBe(8000);
    expect(toastDurationMs({ tone: 'default' })).toBe(TOAST_DURATION_MS);
    expect(toastDurationMs({ tone: 'default' })).toBe(6000);
  });

  it('calls onDismiss on a 120px touch swipe and snaps back without dismissing on a 20px swipe', () => {
    const onDismiss = vi.fn();
    const undoToast = { id: 'undo-swipe', message: '已記錄 HK$103 · 10月22日', undo: { kind: 'add' }, tone: 'default' };

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Toast, {
          toast: undoToast,
          onUndo: () => {},
          onDismiss,
        }),
      ),
    );

    const toast = screen.getByTestId('toast');
    const undoBtn = screen.getByTestId('toast-undo');

    // Swipes starting on a button are ignored
    fireEvent.pointerDown(undoBtn, { pointerType: 'touch', clientX: 50 });
    fireEvent.pointerMove(toast, { pointerType: 'touch', clientX: 200 });
    fireEvent.pointerUp(toast, { pointerType: 'touch', clientX: 200 });
    expect(onDismiss).not.toHaveBeenCalled();

    // 20px swipe (< 80px threshold) snaps back without calling onDismiss
    fireEvent.pointerDown(toast, { pointerType: 'touch', clientX: 100 });
    fireEvent.pointerMove(toast, { pointerType: 'touch', clientX: 120 });
    expect(toast.style.transform).toBe('translateX(20px)');
    fireEvent.pointerUp(toast, { pointerType: 'touch', clientX: 120 });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(toast.style.transform).toBe('');

    // 120px swipe (> 80px threshold) calls onDismiss
    fireEvent.pointerDown(toast, { pointerType: 'touch', clientX: 100 });
    fireEvent.pointerMove(toast, { pointerType: 'touch', clientX: 220 });
    expect(toast.style.transform).toBe('translateX(120px)');
    fireEvent.pointerUp(toast, { pointerType: 'touch', clientX: 220 });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
