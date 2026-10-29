import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { Toast } from '../proto/ref/parts';
import NotebookApp, {
  ERROR_TOAST_DURATION_MS,
  TOAST_DURATION_MS,
  UNDO_TOAST_DURATION_MS,
  buildToastState,
  toastDurationMs,
} from './NotebookApp';

describe('notebook sync Toast — error tone, action button, and i18n labels', () => {
  it('stores tone (default "default") and action via buildToastState and keeps 6000ms vs 8000ms durations', () => {
    const defaultToast = buildToastState('已記錄 HK$103 · 10月22日', { kind: 'add' });
    expect(defaultToast).toMatchObject({
      message: '已記錄 HK$103 · 10月22日',
      undo: { kind: 'add' },
      tone: 'default',
      action: null,
    });
    expect(toastDurationMs(defaultToast)).toBe(UNDO_TOAST_DURATION_MS);
    expect(toastDurationMs(defaultToast)).toBe(5000);
    expect(TOAST_DURATION_MS).toBe(6000);

    const infoToast = buildToastState('已同步到雲端', null, { tone: 'info' });
    expect(infoToast).toMatchObject({
      message: '已同步到雲端',
      undo: null,
      tone: 'info',
      action: null,
    });
    expect(toastDurationMs(infoToast)).toBe(6000);

    const retryFn = vi.fn();
    const errorToast = buildToastState('未能同步到雲端，變更已保存在此裝置。', null, {
      tone: 'error',
      action: {
        label: '重試',
        testId: 'toast-sync-retry',
        onClick: retryFn,
      },
    });
    expect(errorToast).toMatchObject({
      message: '未能同步到雲端，變更已保存在此裝置。',
      undo: null,
      tone: 'error',
      action: {
        label: '重試',
        testId: 'toast-sync-retry',
        onClick: retryFn,
      },
    });
    expect(toastDurationMs(errorToast)).toBe(ERROR_TOAST_DURATION_MS);
    expect(toastDurationMs(errorToast)).toBe(8000);
  });

  it('renders an error toast with role="alert", coral border, alert icon, retry action button, and dismiss button in zh-TW and en', async () => {
    await i18n.changeLanguage('zh-TW');
    const tZh = i18n.getFixedT('zh-TW');
    const onRetry = vi.fn();
    const onDismiss = vi.fn();

    const errorToast = buildToastState(tZh('notebook.sync.saveFailed'), null, {
      tone: 'error',
      action: {
        label: tZh('notebook.sync.retry'),
        testId: 'toast-sync-retry',
        onClick: onRetry,
      },
    });

    const zhHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Toast, {
          toast: errorToast,
          onDismiss,
        }),
      ),
    );

    expect(zhHtml).toContain('data-testid="toast"');
    expect(zhHtml).toContain('role="alert"');
    expect(zhHtml).toContain('aria-live="assertive"');
    expect(zhHtml).toContain('border-coral-ink');
    expect(zhHtml).toContain('text-coral-ink');
    expect(zhHtml).toContain('未能同步到雲端，變更已保存在此裝置。');
    expect(zhHtml).toContain('data-testid="toast-sync-retry"');
    expect(zhHtml).toContain('重試');
    expect(zhHtml).toContain('aria-label="關閉提示"');
    expect(zhHtml).not.toContain('data-testid="toast-undo"');

    await i18n.changeLanguage('en');
    const tEn = i18n.getFixedT('en');
    const enErrorToast = buildToastState(tEn('notebook.sync.loadFailed'), null, {
      tone: 'error',
      action: {
        label: tEn('notebook.sync.retry'),
        testId: 'toast-sync-retry',
        onClick: onRetry,
      },
    });

    const enHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement( NotebookApp, {
          today: '2026-10-28',
          uiLanguage: 'en',
          initialToast: enErrorToast,
        }),
      ),
    );

    expect(enHtml).toContain('role="alert"');
    expect(enHtml).toContain('aria-live="assertive"');
    expect(enHtml).toContain('data-testid="toast-sync-retry"');
    expect(enHtml).toContain('Retry');
    expect(enHtml).toContain('aria-label="Dismiss"');

    await i18n.changeLanguage('zh-TW');
  });

  it('renders a default toast with undo ("toast-undo") and localized undo label in zh-TW and en', async () => {
    await i18n.changeLanguage('zh-TW');
    const undoToast = buildToastState('已記錄 HK$103 · 10月22日', { kind: 'add', id: 'e1' });

    const zhUndoHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Toast, {
          toast: undoToast,
          onUndo: () => {},
          onDismiss: () => {},
        }),
      ),
    );

    expect(zhUndoHtml).toContain('role="status"');
    expect(zhUndoHtml).toContain('aria-live="polite"');
    expect(zhUndoHtml).toContain('border-teal-strong');
    expect(zhUndoHtml).toContain('data-testid="toast-undo"');
    expect(zhUndoHtml).toContain('data-testid="toast-dismiss"');
    expect(zhUndoHtml).toContain('撤銷');
    expect(zhUndoHtml).toContain('aria-label="關閉提示"');

    await i18n.changeLanguage('en');
    const enUndoHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Toast, {
          toast: undoToast,
          onUndo: () => {},
          onDismiss: () => {},
        }),
      ),
    );
    expect(enUndoHtml).toContain('data-testid="toast-undo"');
    expect(enUndoHtml).toContain('data-testid="toast-dismiss"');
    expect(enUndoHtml).toContain('Undo');
    expect(enUndoHtml).toContain('aria-label="Dismiss"');

    await i18n.changeLanguage('zh-TW');
  });
});
