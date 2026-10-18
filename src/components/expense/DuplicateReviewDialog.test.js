import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
  });
  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(createElement(DuplicateReviewDialog, { open: false, conflicts: [], existing: [] }));
    expect(html).toBe('');
  });
});
