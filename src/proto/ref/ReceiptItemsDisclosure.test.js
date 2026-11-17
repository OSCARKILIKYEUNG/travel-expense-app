// @vitest-environment jsdom
/**
 * Read-only receipt line disclosure.
 * jsdom does not paint, measure wrapping, or run a button's native
 * Enter/Space activation. Assertions cover structure, styles, and events.
 */
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import AddForm from './AddForm';
import ExpenseCard from './ExpenseCard';
import ReceiptItemsDisclosure from './ReceiptItemsDisclosure';

const WIDTHS = [320, 390, 430];

function renderForm(props = {}) {
  const onSave = props.onSave || vi.fn();
  const view = render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(AddForm, {
        defaultDate: '2026-10-22',
        people: ['共同', 'Oscar'],
        onCancel: () => {},
        ...props,
        onSave,
      }),
    ),
  );
  return { ...view, onSave };
}

function renderCard(expense, handlers = {}) {
  const onEdit = handlers.onEdit || vi.fn();
  const onDelete = handlers.onDelete || vi.fn();
  const view = render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ExpenseCard, {
        expense,
        onEdit,
        onDelete,
      }),
    ),
  );
  return { ...view, onEdit, onDelete };
}

function cardExpense(overrides = {}) {
  return {
    id: 'card-1',
    date: '2026-10-22',
    store: 'Lawson',
    place: 'Kawaguchiko',
    category: '飲食',
    assignedTo: '共同',
    payer: 'Oscar',
    payment: 'cash',
    currency: 'JPY',
    originalAmount: 500,
    hkdAmount: 26,
    scanned: false,
    items: [],
    ...overrides,
  };
}

function rowByName(name) {
  const rows = [
    ...screen.queryAllByTestId('receipt-item-row'),
    ...screen.queryAllByTestId('receipt-item-editor-row'),
  ];
  const row = rows.find((el) => {
    const named = el.querySelector('[data-testid="receipt-item-name"]');
    if (named && named.value === name) return true;
    return el.textContent.includes(name);
  });
  expect(row, name).toBeTruthy();
  return row;
}

function daySwipeWouldStart(target) {
  return !target.closest('input,textarea,select,[data-noswipe],.overflow-x-auto,[role=dialog],[role=menu]');
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
  vi.restoreAllMocks();
});

describe('receipt line disclosure', () => {
  it('shows an active raw scan draft, not the summary mapper, and keeps save math untouched', () => {
    const items = Object.freeze([
      Object.freeze({
        name: '茶',
        name_en: 'Tea',
        original_name: 'お茶',
        price: 220,
        price_actual: 200,
        qty: 2,
      }),
    ]);
    const draft = {
      id: 'scan-1',
      store: 'Lawson',
      originalAmount: 500,
      currency: 'EUR',
      category: '飲食',
      date: '2026-10-22',
      tax: 12,
      discount: 3,
      taxRefund: 1,
      subtotal: 490,
      items,
    };
    const { onSave } = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 11, draft },
    });

    const toggle = screen.getByTestId('receipt-items-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('receipt-item-row')).toBeNull();
    expect(screen.getByTestId('form-amount').value).toBe('500');

    const controls = toggle.getAttribute('aria-controls');
    const panel = document.getElementById(controls);
    expect(panel).toBeTruthy();
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(toggle.style.minHeight).toBe('44px');
    expect(toggle.style.minWidth).toBe('44px');
    expect(toggle.className).toContain('min-h-11');
    expect(toggle.className).toContain('min-w-11');
    expect(toggle.closest('[data-noswipe]')).toBeTruthy();
    expect(daySwipeWouldStart(toggle)).toBe(false);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    toggle.dispatchEvent(enter);
    toggle.dispatchEvent(space);
    expect(enter.defaultPrevented).toBe(false);
    expect(space.defaultPrevented).toBe(false);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(onSave).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(controls);
    expect(document.getElementById(controls)).toBe(panel);
    expect(panel.hasAttribute('hidden')).toBe(false);

    const row = rowByName('茶');
    expect(within(row).getByTestId('receipt-item-name').value).toBe('茶');
    expect(within(row).getByTestId('receipt-item-name').value).not.toBe('Tea');
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    expect(within(row).getByTestId('receipt-item-price-input').value).toBe('220');
    expect(within(row).getByLabelText(/第1列列印金額（EUR）/)).toBe(within(row).getByTestId('receipt-item-price-input'));
    expect(within(row).getByTestId('receipt-item-actual-input').value).toBe('200');
    expect(within(row).getByLabelText(/另外記錄的實付金額（EUR）/)).toBeTruthy();
    expect(within(row).getByTestId('receipt-item-qty-input').value).toBe('2');
    expect(row.textContent).not.toContain('440');
    expect(row.textContent).not.toContain('400');
    expect(screen.getByTestId('receipt-items-disclaimer').textContent).toContain('明細不一定等於收據總額');
    expect(screen.getByTestId('form-amount').value).toBe('500');
    expect(items[0].price).toBe(220);
    expect(items[0].price_actual).toBe(200);

    fireEvent.change(document.getElementById('ref-currency'), { target: { value: 'HKD' } });
    expect(document.getElementById('ref-currency').value).toBe('HKD');
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    expect(within(row).getByTestId('receipt-item-price-input').value).toBe('220');
    expect(row.textContent).not.toContain('HKD');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.change(screen.getByTestId('form-amount'), { target: { value: '500' } });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByDisplayValue('茶')).toBeTruthy();

    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.items).toBeUndefined();
    expect(payload.originalAmount).toBe(500);
    expect(payload.amount).toBe('500');
    expect(payload.tax).toBe('12');
    expect(payload.discount).toBe('3');
    expect(payload.taxRefund).toBe('1');
    expect(payload.subtotal).toBe('490');
    expect(payload.currency).toBe('HKD');
    expect(items[0].price).toBe(220);
  });

  it('keeps an existing edit record ahead of a stale draft and does not alter its save payload', () => {
    const items = [{ name: '本體', name_en: 'Body', price: 10, quantity: 1 }];
    const initial = {
      id: 'keep-1',
      store: 'Shop',
      originalAmount: 100,
      currency: 'JPY',
      originalCurrency: 'EUR',
      category: '購物',
      scanned: true,
      tax: 4,
      discount: 2,
      taxRefund: 1,
      subtotal: 9,
      items,
      hkdAmount: 5,
    };
    const plain = renderForm({ initial });
    fireEvent.click(screen.getByTestId('form-save'));
    const untouched = plain.onSave.mock.calls[0][0];
    plain.unmount();

    const opened = renderForm({
      initial,
      scanDraft: {
        id: 'stale',
        store: 'Stale',
        originalAmount: 1,
        currency: 'USD',
        items: [{ name: '過期', price: 999 }],
      },
      scanState: { status: 'ready', token: 99, draft: { items: [{ name: '過期', price: 999 }] } },
    });
    expect(document.body.textContent).not.toContain('過期');
    const toggle = screen.getByTestId('receipt-items-toggle');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    fireEvent.click(screen.getByTestId('form-save'));
    expect(opened.onSave.mock.calls[0][0]).toEqual(untouched);
    expect(opened.onSave.mock.calls[0][0].items).toBe(items);
    expect(opened.onSave.mock.calls[0][0].tax).toBe('4');
    expect(opened.onSave.mock.calls[0][0].discount).toBe('2');
    expect(opened.onSave.mock.calls[0][0].taxRefund).toBe('1');
    expect(opened.onSave.mock.calls[0][0].subtotal).toBe('9');
    expect(opened.onSave.mock.calls[0][0].originalAmount).toBe(100);
    opened.unmount();

    const again = renderForm({ initial });
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    const row = rowByName('本體');
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    expect(within(row).getByTestId('receipt-item-price-input').value).toBe('10');
    expect(row.textContent).not.toContain('USD');
    fireEvent.change(document.getElementById('ref-currency'), { target: { value: 'HKD' } });
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    expect(within(row).getByTestId('receipt-item-price-input').value).toBe('10');
    expect(row.textContent).not.toContain('HKD');
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('true');
    again.unmount();
  });

  it('arrives with an async draft collapsed, and a new receipt does not inherit the open state', () => {
    const firstItems = [{ name: '第一樣', price: 15 }];
    const { rerender } = renderForm();
    expect(screen.queryByTestId('receipt-items-toggle')).toBeNull();

    const first = {
      id: 'scan-a',
      store: 'Shop A',
      originalAmount: 15,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      items: firstItems,
    };
    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar'],
          onCancel: () => {},
          onSave: () => {},
          scanDraft: first,
          scanState: { status: 'ready', token: 1, draft: first },
        }),
      ),
    );
    const toggle = screen.getByTestId('receipt-items-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(screen.getByDisplayValue('第一樣')).toBeTruthy();

    const second = {
      id: 'scan-b',
      store: 'Shop B',
      originalAmount: 40,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-23',
      items: [{ name: '第二樣', price: 40 }],
    };
    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-23',
          people: ['共同', 'Oscar'],
          onCancel: () => {},
          onSave: () => {},
          scanDraft: second,
          scanState: { status: 'ready', token: 2, draft: second },
        }),
      ),
    );
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByDisplayValue('第一樣')).toBeNull();
    expect(screen.queryByDisplayValue('第二樣')).toBeNull();
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByDisplayValue('第二樣')).toBeTruthy();
    expect(screen.queryByDisplayValue('第一樣')).toBeNull();
  });

  it('uses English aliases and English copy, and shows recorded zero, negative, missing, and explicit quantities only', async () => {
    const draft = {
      id: 'scan-mix',
      store: 'Mix',
      originalAmount: 80,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      items: [
        { name: '茶', name_en: 'Tea', price: 220 },
        { name: '零', price: 0 },
        { name: '負', price: -30 },
        { name: '壞', price: 'nope' },
        { name: '缺' },
        { name: '字串', price: '1,280' },
        { name: '實', name_en: 'Actual Tea', price: 100, price_actual: 90, qty: 2 },
        { name: 'Shorts set x12', price: 5940 },
        { name: '布林', price: true },
        { name: '免費字', price: '0' },
      ],
    };
    const view = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 4, draft },
    });
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(within(rowByName('茶')).getByTestId('receipt-item-name').value).toBe('茶');
    expect(within(rowByName('零')).getByTestId('receipt-item-price-input').value).toBe('0');
    expect(within(rowByName('零')).getByTestId('receipt-item-currency').textContent).toBe('JPY');
    expect(within(rowByName('零')).queryByTestId('receipt-item-price-missing')).toBeNull();
    expect(within(rowByName('負')).getByTestId('receipt-item-price-input').value).toBe('-30');
    expect(within(rowByName('壞')).getByTestId('receipt-item-price-input').value).toBe('nope');
    expect(within(rowByName('壞')).queryByTestId('receipt-item-price')).toBeNull();
    expect(within(rowByName('缺')).getByTestId('receipt-item-price-input').value).toBe('');
    expect(within(rowByName('字串')).getByTestId('receipt-item-price-input').value).toBe('1,280');
    const actual = rowByName('實');
    expect(within(actual).getByTestId('receipt-item-price-input').value).toBe('100');
    expect(within(actual).getByTestId('receipt-item-actual-input').value).toBe('90');
    expect(within(actual).getByTestId('receipt-item-qty-input').value).toBe('2');
    expect(actual.textContent).not.toContain('200');
    expect(actual.textContent).not.toContain('180');
    const setRow = rowByName('Shorts set x12');
    expect(within(setRow).queryByTestId('receipt-item-qty-input')).toBeNull();
    expect(within(setRow).getByTestId('receipt-item-price-input').value).toBe('5940');
    expect(setRow.textContent).not.toContain('71,280');
    expect(setRow.textContent).not.toContain('71280');
    expect(within(rowByName('布林')).getByTestId('receipt-item-price-input').value).toBe('');
    expect(within(rowByName('免費字')).getByTestId('receipt-item-price-input').value).toBe('0');
    view.unmount();

    await i18n.changeLanguage('en');
    const englishForm = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 4, draft },
    });
    const toggle = screen.getByTestId('receipt-items-toggle');
    expect(toggle.getAttribute('aria-label')).toBe('Show receipt details');
    expect(toggle.textContent).toContain('Receipt details');
    expect(toggle.textContent).not.toMatch(/[\u3400-\u9fff]/);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-label')).toBe('Hide receipt details');
    const englishTea = rowByName('茶');
    expect(within(englishTea).getByTestId('receipt-item-name').value).toBe('茶');
    expect(within(englishTea).getByLabelText('Line 1 name')).toBeTruthy();
    expect(within(englishTea).getByLabelText('Line 1 printed amount (JPY)')).toBeTruthy();
    expect(englishTea.textContent).not.toMatch(/[\u3400-\u9fff]/);
    const englishActual = rowByName('實');
    expect(within(englishActual).getByLabelText('Line 7 separately recorded paid amount (JPY)')).toBeTruthy();
    expect(within(englishActual).getByLabelText('Line 7 quantity (not multiplied)')).toBeTruthy();
    expect(englishActual.textContent).not.toMatch(/[\u3400-\u9fff]/);
    expect(screen.getByTestId('receipt-items-disclaimer').textContent).toBe(
      'Line items may not add up to the receipt total.',
    );
    expect(screen.getByTestId('receipt-items-disclaimer').textContent).not.toMatch(/[\u3400-\u9fff]/);
    englishForm.unmount();

    renderCard(cardExpense({
      id: 'en-card',
      scanned: true,
      currency: 'JPY',
      items: [{ name: '茶', name_en: 'Tea', price: 220, price_actual: 90, qty: 2 }],
    }));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(rowByName('Tea').textContent).toContain('Tea');
    expect(rowByName('Tea').textContent).not.toContain('茶');
    expect(rowByName('Tea').textContent).toContain('List price');
    expect(rowByName('Tea').textContent).toContain('Actual price');
    expect(within(rowByName('Tea')).getByTestId('receipt-item-qty').textContent).toContain('Qty 2');
  });

  it('keeps a blank manual add hidden, can add lines on a saved edit, and does not invent amounts for unusable scan rows', () => {
    renderForm();
    expect(screen.queryByTestId('receipt-items-toggle')).toBeNull();

    const manual = renderForm({
      initial: {
        id: 'manual-1',
        store: 'Notebook',
        originalAmount: 20,
        currency: 'JPY',
        category: '其他',
        scanned: false,
        items: [],
      },
    });
    const manualToggle = screen.getByTestId('receipt-items-toggle');
    expect(manualToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('receipt-items-empty')).toBeNull();
    fireEvent.click(manualToggle);
    expect(screen.getByTestId('receipt-item-add').getAttribute('type')).toBe('button');
    expect(screen.queryByTestId('receipt-item-editor-row')).toBeNull();
    expect(screen.queryByTestId('receipt-items-empty')).toBeNull();
    manual.unmount();

    const blankScan = {
      id: 'blank-scan',
      store: 'Blank',
      originalAmount: 80,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      scanned: true,
      items: [],
    };
    const blank = renderForm({
      scanDraft: blankScan,
      scanState: { status: 'ready', token: 6, draft: blankScan },
    });
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByTestId('receipt-items-empty').textContent).toBe('未辨識到明細');
    expect(screen.queryByTestId('receipt-item-row')).toBeNull();
    expect(screen.queryByTestId('receipt-item-editor-row')).toBeNull();
    expect(screen.getByTestId('receipt-items').textContent).not.toContain('JPY 0');
    blank.unmount();

    const emptyDraft = {
      id: 'empty-scan',
      store: 'Blank',
      originalAmount: 80,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      scanned: true,
      items: [null, {}, { price: 'abc' }, { quantity: 0 }, { qty: -2 }, 'x'],
    };
    renderForm({
      scanDraft: emptyDraft,
      scanState: { status: 'ready', token: 5, draft: emptyDraft },
    });
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.queryByTestId('receipt-item-row')).toBeNull();
    expect(screen.getByTestId('receipt-items').textContent).not.toContain('JPY 0');
    const prices = screen.getAllByTestId('receipt-item-price-input').map((input) => input.value);
    expect(prices).toContain('abc');
    expect(prices).not.toContain('0');
  });

  it('wraps long saved lines inside the ticket and keeps the menu working', () => {
    const longName = `N${'A'.repeat(80)}`;
    const expense = cardExpense({
      id: 'long-1',
      scanned: true,
      currency: 'JPY',
      originalCurrency: 'JPY',
      items: [{ name: longName, price: 999999999999, priceActual: -5, quantity: 1.5 }],
    });
    const plain = cardExpense({ id: 'long-1', scanned: true, items: [] });
    const plainView = renderCard(plain);
    const plainToggle = plainView.getByTestId('receipt-items-toggle');
    expect(plainView.container.querySelector('.expense-amt-col').contains(plainToggle)).toBe(true);
    expect(plainToggle.textContent).not.toContain('收據明細');
    expect(plainToggle.className.split(/\s+/)).not.toContain('jr-btn-paper');
    const plainRowText = plainView.container.querySelector('.jr-ticket-row').textContent;
    plainView.unmount();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const { onEdit, onDelete } = renderCard(expense);
    const article = document.querySelector('article.jr-ticket');
    const ticketRow = article.querySelector('.jr-ticket-row');
    expect(ticketRow.textContent).toBe(plainRowText);
    expect(ticketRow.textContent).not.toContain(longName);
    expect(article.className).toContain('jr-ticket');
    expect(article.className).not.toContain('jr-torn');
    expect(article.className).not.toContain('expense-row');

    const toggle = screen.getByTestId('receipt-items-toggle');
    const panel = document.getElementById(toggle.getAttribute('aria-controls'));
    const inside = article.querySelector('.jr-ticket-inside');
    const amt = article.querySelector('.expense-amt-col');
    const more = screen.getByRole('button', { name: /更多動作|More actions/ });
    expect(amt.contains(toggle)).toBe(true);
    expect(more.parentElement.contains(toggle)).toBe(false);
    expect(inside.contains(toggle)).toBe(false);
    expect(inside.contains(panel)).toBe(true);
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();
    expect(toggle.textContent).not.toContain('收據明細');
    expect(toggle.getAttribute('aria-label')).toBe('展開收據明細');
    expect(toggle.className.split(/\s+/)).not.toContain('jr-btn-paper');
    expect(toggle.className.split(/\s+/)).not.toContain('w-full');
    expect(toggle.style.minHeight).toBe('44px');
    expect(toggle.style.minWidth).toBe('44px');
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    const row = screen.getByTestId('receipt-item-row');
    expect(row.textContent).toContain(longName);
    expect(row.textContent).toContain('999,999,999,999');
    expect(row.textContent).toContain('JPY -5');
    expect(row.textContent).toContain('×1.5');
    expect(row.className).not.toContain('whitespace-nowrap');
    expect(row.className).not.toContain('truncate');
    expect(row.className).not.toContain('line-clamp');
    expect(row.style.overflowWrap).toBe('anywhere');
    expect(row.style.whiteSpace).toBe('normal');
    expect(row.style.maxWidth).toBe('100%');
    const root = screen.getByTestId('receipt-items');
    for (const width of WIDTHS) {
      root.parentElement.style.width = `${width}px`;
      expect(root.style.maxWidth).toBe('100%');
      expect(root.style.width).toBe('100%');
      expect(root.style.overflowWrap).toBe('anywhere');
    }
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /更多動作|More actions/ }));
    const menu = screen.getByRole('menu');
    expect(menu.parentElement).toBe(document.body);
    expect(article.contains(menu)).toBe(false);
    fireEvent.click(screen.getByRole('menuitem', { name: /編輯|Edit/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('shows preserved saved lines without a rescan, and a manual card has no empty scan control', () => {
    const manual = renderCard(cardExpense({ scanned: false, items: [] }));
    expect(screen.queryByTestId('receipt-items-toggle')).toBeNull();
    expect(screen.getByRole('button', { name: /更多動作|More actions/ })).toBeTruthy();
    manual.unmount();

    const savedItems = [{ name: '飯糰', nameEn: 'Onigiri', price: -15, quantity: '3' }];
    const { onEdit, rerender } = renderCard(cardExpense({
      id: 'saved-9',
      scanned: true,
      currency: 'HKD',
      items: savedItems,
    }));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByText('飯糰')).toBeTruthy();
    expect(rowByName('飯糰').textContent).toContain('HKD -15');
    expect(rowByName('飯糰').textContent).toContain('×3');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(savedItems[0].price).toBe(-15);

    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ExpenseCard, {
          expense: cardExpense({
            id: 'saved-9',
            scanned: true,
            currency: 'HKD',
            place: 'Changed place',
            items: savedItems.map((item) => ({ ...item })),
          }),
          onEdit,
          onDelete: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('飯糰')).toBeTruthy();

    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ExpenseCard, {
          expense: cardExpense({
            id: 'saved-10',
            scanned: true,
            items: [{ name: '新收據', price: 8 }],
          }),
          onEdit: () => {},
          onDelete: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('飯糰')).toBeNull();

    cleanup();
    renderCard(cardExpense({
      id: 'empty-saved',
      scanned: true,
      items: [],
    }));
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByTestId('receipt-items-empty').textContent).toBe('未辨識到明細');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('closes the action menu on an outside press without editing or deleting', () => {
    const { onEdit, onDelete } = renderCard(cardExpense({
      scanned: true,
      items: [{ name: '茶', price: 10 }],
    }));
    fireEvent.click(screen.getByRole('button', { name: /更多動作|More actions/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(screen.getByTestId('receipt-items-toggle'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the labeled form toggle by default and has no edit-details button', () => {
    render(createElement(
      I18nextProvider,
      { i18n },
      createElement(ReceiptItemsDisclosure, {
        items: [{ name: '茶', price: 10 }],
        currency: 'JPY',
        scanned: true,
        identity: 'direct-form',
      }),
    ));
    const toggle = screen.getByTestId('receipt-items-toggle');
    expect(toggle.className).toContain('jr-btn-paper');
    expect(toggle.className.split(/\s+/)).toContain('w-full');
    expect(toggle.textContent).toContain('收據明細');
    expect(toggle.getAttribute('aria-label')).toBe('展開收據明細');
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();
    expect(screen.queryByText('編輯明細')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('receipt-item-row').textContent).toContain('茶');
    expect(screen.getByTestId('receipt-items-disclaimer')).toBeTruthy();
  });
});
