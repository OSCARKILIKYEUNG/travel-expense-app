import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import DuplicateReviewDialog from './DuplicateReviewDialog';

// Static (SSR) render: the repo has no DOM test env, so this checks initial UI state only.
const old = { id: 1, date: '2026年10月18日', store: '羅森', items: [{}], originalAmount: 1080, currency: 'JPY', editedAt: 1 };
const fresh = { id: 10, date: '2026年10月18日', store: '羅森', items: [{}], originalAmount: 1080, currency: 'JPY' };

describe('DuplicateReviewDialog (initial render)', () => {
  it('shows zh-TW copy, skip pre-selected, replace not selected', async () => {
    await i18n.changeLanguage('zh-TW');
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n },
      createElement(DuplicateReviewDialog, {
        open: true, conflicts: [{ record: fresh, matchId: 1, level: 'strong' }], existing: [old],
        onConfirm() {}, onClose() {},
      })));
    expect(html).toContain('發現可能重複的單據');
    expect(html).toContain('取代舊記錄');
    expect(html).toContain('兩筆都保留');
    expect(html).toMatch(/aria-pressed="true"[^>]*data-choice="skip"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*data-choice="replace"/);
    expect(html).toContain('曾被你編輯');
    // c7395ce painted data-review-step="confirm" and 「0 筆舊記錄會被移除」
    // on first open when existing[0].editedAt was set (choose step absent).
    expect(html).toContain('data-review-step="choose"');
    expect(html).not.toContain('data-review-step="confirm"');
    expect(html).not.toContain('確定取代舊記錄？');
    expect(html).not.toContain('0 筆舊記錄會被移除');
  });
  it('BUG-DUP-2: edited existing record renders the choose step, not confirm', async () => {
    await i18n.changeLanguage('zh-TW');
    const html = renderToString(createElement(I18nextProvider, { i18n },
      createElement(DuplicateReviewDialog, {
        open: true,
        conflicts: [{ record: fresh, matchId: old.id, level: 'strong' }],
        existing: [{ ...old, editedAt: 1, userEditedPricing: true }],
        onConfirm() {},
        onClose() {},
      })));
    expect(html).toContain('data-review-step="choose"');
    expect(html).not.toContain('data-review-step="confirm"');
    expect(html).not.toContain('0 筆舊記錄會被移除');
  });
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(createElement(DuplicateReviewDialog, { open: false, conflicts: [], existing: [] }));
    expect(html).toBe('');
  });
  it('wraps body and closeNote paragraphs and truncates per-conflict summary lines with title in English', async () => {
    const longStore = 'Don Quijote Mega Store Shinjuku Kabukicho Flagship Branch';
    const longOld = { ...old, store: longStore };
    const longFresh = { ...fresh, store: longStore };
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n },
      createElement(DuplicateReviewDialog, {
        open: true,
        conflicts: [{ record: longFresh, matchId: longOld.id, level: 'strong' }],
        existing: [longOld],
        onConfirm() {},
        onClose() {},
      })));
    expect(html).toContain('<h2 class="min-w-0 truncate text-xl font-normal text-ink">Possible duplicate receipts found</h2>');
    expect(html).toContain('<p class="text-xs text-ink-soft">');
    expect(html).toContain('<p class="text-xs text-ink-muted">Closing without choosing');
    expect(html).toContain(`class="min-w-0 truncate" title="Existing ${longStore}`);
    expect(html).toContain(`class="min-w-0 truncate" title="New scan ${longStore}`);
    expect(html).toContain('class="min-w-0 truncate text-mustard-ink" title="Same date, store, amount and item count"');
    await i18n.changeLanguage('zh-TW');
  });
});
