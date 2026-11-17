// @vitest-environment jsdom
/**
 * Option B ticket/label expense cards.
 * jsdom does not paint, so colour is locked on classes plus journal.css tokens.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ExpenseCard, { ExpenseSkeletonRow } from './ExpenseCard';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function card(overrides = {}) {
  return {
    id: 'ticket-1',
    date: '2026-12-18',
    store: 'LAWSON 新宿店',
    place: '新宿',
    category: '飲食',
    assignedTo: '共同',
    payer: 'Oscar',
    payment: 'cash',
    currency: 'JPY',
    originalAmount: 1015,
    hkdAmount: 52,
    subtotal: 1015,
    scanned: true,
    items: [{ name: '便當', price: 440 }],
    includedTaxAmount: 82,
    includedTaxBreakdown: [
      { ratePercent: 10, targetAmount: 440, basis: 'gross', includedTaxAmount: 40 },
      { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
    ],
    ...overrides,
  };
}

function renderCard(expense, extra = {}) {
  return render(createElement(
    I18nextProvider,
    { i18n },
    createElement(ExpenseCard, {
      expense,
      onEdit: () => {},
      onDelete: () => {},
      ...extra,
    }),
  ));
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
});

describe('expense ticket sticker', () => {
  it('locks header copy, category tones, and the absence of torn or washi treatment', () => {
    const cases = [
      ['飲食', '共同', '飲食 · 共同', 'is-food'],
      ['住宿', '共同', '住宿 · 共同', 'is-stay'],
      ['交通', '阿明', '交通 · 阿明', 'is-transit'],
      ['購物', 'Oscar', '購物 · Oscar', 'is-shop'],
      ['娛樂', 'May', '娛樂 · May', 'is-fun'],
      ['其他', '共同', '其他 · 共同', 'is-other'],
      ['未分類', '共同', '未分類 · 共同', 'is-other'],
      ['太空', '共同', '太空 · 共同', 'is-other'],
    ];
    for (const [category, assignedTo, label, tone] of cases) {
      cleanup();
      const view = renderCard(card({ id: category, category, assignedTo, items: [], scanned: false }));
      const article = view.container.querySelector('article');
      const head = view.container.querySelector('[data-testid="expense-ticket-head"]');
      expect(article.className).toContain('jr-ticket');
      expect(article.className).not.toContain('jr-torn');
      expect(article.className).not.toMatch(/rotate|jr-washi|jr-tape/);
      expect(view.container.querySelector('.jr-washi')).toBeNull();
      expect(view.container.querySelector('.jr-ticket-perf')).toBeTruthy();
      expect(head.className).toContain('font-hand');
      expect(head.className).toContain(tone);
      expect(head.textContent).toBe(label);
      expect(view.container.querySelector('.expense-amount').className).not.toContain('truncate');
      expect(view.container.querySelector('.expense-amount-sub').className).not.toContain('truncate');
      view.unmount();
    }
  });

  it('keeps LAWSON included tax and refunds inside the ticket when subtotal equals paid', () => {
    const view = renderCard(card({ taxRefund: -1844, discount: -10 }));
    const article = view.container.querySelector('article.jr-ticket');
    const inside = article.querySelector('.jr-ticket-inside');
    const summary = screen.getByTestId('included-tax-summary');
    expect(inside.contains(summary)).toBe(true);
    expect(inside.contains(screen.getByTestId('receipt-items'))).toBe(true);
    expect(inside.contains(screen.getByTestId('saved-adjustments'))).toBe(true);
    expect(summary.textContent).toContain('82');
    expect(summary.textContent).toContain('40');
    expect(summary.textContent).toContain('42');
    expect(view.container.textContent).toContain('1,015');
    expect(view.container.textContent).not.toContain('1,097');
    expect(article.querySelector('.jr-ticket-row').textContent).not.toContain('便當');

    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(inside.contains(screen.getByText('便當'))).toBe(true);
    expect(screen.getByRole('button', { name: /更多動作/ }).className).toContain('min-h-11');
    expect(screen.getByRole('button', { name: /更多動作/ }).className).toContain('min-w-11');
    fireEvent.click(screen.getByRole('button', { name: /更多動作/ }));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(menu.className).toContain('z-40');
    expect(article.contains(menu)).toBe(false);
  });

  it('leaves cards straight at rest and only marks sticker-pop for an add', () => {
    const resting = renderCard(card({ stickerPop: undefined }));
    const root = resting.container.querySelector('[data-expense-id="ticket-1"]');
    expect(root.getAttribute('data-sticker-pop')).toBeNull();
    expect(root.className).not.toMatch(/rotate/);
    expect(resting.container.querySelector('article').className).not.toMatch(/rotate/);
    resting.unmount();

    const added = renderCard(card({ id: 'added' }), { stickerPop: true });
    expect(added.container.querySelector('[data-expense-id="added"]').getAttribute('data-sticker-pop')).toBe('true');
  });

  it('draws the skeleton with ticket geometry and no torn note or round icon', () => {
    const wide = render(createElement(ExpenseSkeletonRow, { wide: true }));
    const ticket = wide.container.querySelector('[data-testid="expense-skeleton-row"]');
    expect(ticket.className).toContain('jr-ticket');
    expect(ticket.className).toContain('skeleton-ticket');
    expect(ticket.className).not.toContain('jr-torn');
    expect(ticket.querySelector('.jr-ticket-head').className).toContain('is-other');
    expect(ticket.querySelector('.jr-ticket-perf')).toBeTruthy();
    const row = ticket.querySelector('.jr-ticket-body .skeleton-row');
    expect(row).toBeTruthy();
    expect(row.querySelector('.skeleton-line').className).toContain('w-80');
    expect(ticket.querySelector('.skeleton-icon')).toBeNull();
    wide.unmount();

    const narrow = render(createElement(ExpenseSkeletonRow, { wide: false }));
    expect(narrow.container.querySelector('.jr-ticket-body .skeleton-line').className).toContain('w-60');
  });

  it('keeps ticket face, perforation, and category colours on palette tokens', () => {
    const css = readFileSync(join(srcRoot, 'theme/journal.css'), 'utf8');
    const source = readFileSync(join(srcRoot, 'proto/ref/ExpenseCard.jsx'), 'utf8');
    expect(source).not.toContain('jr-torn');
    expect(source).not.toContain('jr-washi');
    expect(css).toContain('.jr-torn {');

    const ticketStart = css.indexOf('.jr-ticket {');
    const ticket = css.slice(ticketStart, css.indexOf('}', ticketStart));
    expect(ticket).toContain('rgb(var(--c-cream-soft))');
    expect(ticket).toContain('rgb(var(--c-ink-soft) / 0.28)');
    expect(ticket).toContain('border-radius: 14px');
    expect(ticket).toContain('0 1px 0 rgb(var(--c-ink) / 0.04)');
    expect(ticket).toContain('0 3px 8px rgb(var(--c-ink) / 0.10)');

    const food = css.slice(css.indexOf('.jr-ticket-head.is-food'), css.indexOf('.jr-ticket-head.is-transit'));
    expect(food).toContain('.jr-ticket-head.is-stay');
    expect(food).toContain('rgb(var(--c-mustard-soft))');
    expect(food).toContain('rgb(var(--c-kraft-ink))');

    const transit = css.slice(css.indexOf('.jr-ticket-head.is-transit'), css.indexOf('.jr-ticket-head.is-shop'));
    expect(transit).toContain('rgb(var(--c-route-soft))');
    expect(transit).toContain('rgb(var(--c-route))');

    const shop = css.slice(css.indexOf('.jr-ticket-head.is-shop'), css.indexOf('.jr-ticket-head.is-fun'));
    expect(shop).toContain('rgb(var(--c-coral-soft))');
    expect(shop).toContain('rgb(var(--c-stamp))');

    const fun = css.slice(css.indexOf('.jr-ticket-head.is-fun'), css.indexOf('.jr-ticket-head.is-other'));
    expect(fun).toContain('rgb(var(--c-sage-soft))');
    expect(fun).toContain('rgb(var(--c-sage-ink))');

    const other = css.slice(css.indexOf('.jr-ticket-head.is-other'), css.indexOf('.jr-ticket-perf'));
    expect(other).toContain('rgb(var(--c-paper-shade))');
    expect(other).toContain('rgb(var(--c-ink-soft))');

    const perf = css.slice(css.indexOf('.jr-ticket-perf {'), css.indexOf('.jr-ticket-body'));
    expect(perf).toContain('dashed');
    expect(perf).toContain('rgb(var(--c-paper))');
    expect(perf).toContain('rgb(var(--c-cream-soft))');

    const inside = css.slice(css.indexOf('.jr-ticket-inside {'), css.indexOf('.jr-ticket-inside:not'));
    expect(inside).toContain('dashed');
    expect(inside).toContain('rgb(var(--c-ink-soft) / 0.22)');
    expect(inside).toContain('min-width: 0');
    expect(inside).toContain('max-width: 100%');
    expect(inside).toContain('overflow-wrap: anywhere');

    const amt = css.slice(css.indexOf('.jr-ticket .expense-amt-col'), css.indexOf('.jr-ticket .expense-amount'));
    expect(amt).toContain('flex-direction: column');
    expect(amt).toContain('align-items: flex-end');
    expect(ticket).toContain('min-width: 0');
    expect(ticket).toContain('max-width: 100%');
    expect(ticket).toContain('overflow: hidden');
  });

  it('places a compact chevron under the price and keeps a ZARA refund inside the ticket', () => {
    const expense = card({
      id: 'zara',
      store: '薩拉',
      place: '東京',
      category: '購物',
      assignedTo: '共同',
      currency: 'JPY',
      originalAmount: 18732,
      hkdAmount: 937,
      taxRefund: -1844,
      scanned: true,
      items: [{ name: '外套', price: 18732 }],
      includedTaxAmount: undefined,
      includedTaxBreakdown: undefined,
    });
    const onEdit = vi.fn();
    const view = renderCard(expense, { onEdit });
    const article = view.container.querySelector('article.jr-ticket');
    const inside = view.container.querySelector('[data-testid="expense-ticket-inside"]');
    const amt = article.querySelector('.expense-amt-col');
    const toggle = screen.getByTestId('receipt-items-toggle');
    const more = screen.getByRole('button', { name: /更多動作/ });
    const refund = screen.getByTestId('saved-tax-refund');

    expect(view.container.querySelector('[data-testid="expense-ticket-head"]').textContent).toBe('購物 · 共同');
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();
    expect(article.textContent).not.toContain('編輯明細');
    expect(amt.contains(toggle)).toBe(true);
    expect(more.parentElement.contains(toggle)).toBe(false);
    expect(amt.querySelector('.expense-amount').compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(amt.querySelector('.expense-amount-sub').compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(toggle.textContent).not.toContain('收據明細');
    expect(toggle.getAttribute('aria-label')).toBe('展開收據明細');
    expect(toggle.className.split(/\s+/)).not.toContain('jr-btn-paper');
    expect(toggle.className.split(/\s+/)).not.toContain('w-full');
    expect(toggle.className).toContain('min-h-11');
    expect(toggle.className).toContain('min-w-11');
    expect(toggle.style.minHeight).toBe('44px');
    expect(toggle.style.minWidth).toBe('44px');
    expect(toggle.querySelector('svg').getAttribute('class')).toContain('h-4');
    expect(toggle.querySelector('svg').getAttribute('class')).toContain('w-4');
    expect(toggle.querySelector('svg').style.transform).toBe('none');
    expect(screen.getByTestId('receipt-items-panel').hasAttribute('hidden')).toBe(true);
    expect(inside.contains(refund)).toBe(true);
    expect(article.contains(refund)).toBe(true);
    expect(amt.contains(refund)).toBe(false);
    expect(refund.textContent).toContain('退稅');
    expect(refund.textContent).toContain('-1844');
    expect(refund.style.maxWidth).toBe('100%');
    expect(refund.style.overflowWrap).toBe('anywhere');
    expect(refund.style.whiteSpace).toBe('normal');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('收合收據明細');
    expect(toggle.querySelector('svg').style.transform).toBe('rotate(90deg)');
    expect(inside.contains(screen.getByText('外套'))).toBe(true);
    expect(inside.contains(screen.getByTestId('receipt-items-disclaimer'))).toBe(true);
    expect(inside.contains(screen.getByTestId('receipt-items'))).toBe(true);
    expect(inside.contains(refund)).toBe(true);
    expect(article.contains(refund)).toBe(true);
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();

    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: /編輯/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toBe(expense);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps a refund inside the ticket when there is no receipt chevron', () => {
    const view = renderCard(card({
      id: 'zara-refund',
      store: '薩拉',
      place: '東京',
      category: '購物',
      assignedTo: '共同',
      currency: 'JPY',
      originalAmount: 18732,
      hkdAmount: 937,
      taxRefund: -1844,
      scanned: false,
      items: [],
      includedTaxAmount: undefined,
      includedTaxBreakdown: undefined,
    }));
    const article = view.container.querySelector('article.jr-ticket');
    const inside = view.container.querySelector('[data-testid="expense-ticket-inside"]');
    const refund = screen.getByTestId('saved-tax-refund');
    expect(screen.queryByTestId('receipt-items-toggle')).toBeNull();
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();
    expect(article.textContent).not.toContain('編輯明細');
    expect(article.textContent).not.toContain('收據明細');
    expect(inside.contains(refund)).toBe(true);
    expect(article.contains(refund)).toBe(true);
    expect(refund.textContent).toContain('退稅');
    expect(refund.textContent).toContain('-1844');
    expect(inside.className).toContain('min-w-0');
    expect(inside.className).toContain('max-w-full');
  });

  it('uses the English category and shared labels in the header', async () => {
    await i18n.changeLanguage('en');
    const view = renderCard(card({ category: '購物', assignedTo: '共同', items: [], scanned: false }));
    expect(view.container.querySelector('[data-testid="expense-ticket-head"]').textContent).toBe('Shopping · Shared');
  });
});
