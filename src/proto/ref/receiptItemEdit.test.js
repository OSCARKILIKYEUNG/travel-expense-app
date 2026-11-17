// @vitest-environment jsdom
/**
 * Editable receipt lines inside AddForm.
 * jsdom does not run a native IME candidate window, paint layout, or move a
 * real caret through platform candidate UI. Keydown and form submit checks
 * are event policy only; they do not prove native IME confirmation.
 */
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import AddForm from './AddForm';
import ExpenseCard from './ExpenseCard';

function renderForm(props = {}) {
  const onSave = props.onSave || vi.fn();
  const onCancel = props.onCancel || vi.fn();
  const view = render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(AddForm, {
        defaultDate: '2026-10-22',
        people: ['共同', 'Oscar'],
        ...props,
        onCancel,
        onSave,
      }),
    ),
  );
  return { ...view, onSave, onCancel };
}

function renderCard(expense) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(ExpenseCard, { expense, onEdit, onDelete }),
    ),
  );
  return { onEdit, onDelete };
}

function scanForm(items, extra = {}) {
  const draft = {
    id: 'scan-edit',
    store: 'Lawson',
    originalAmount: 500,
    currency: 'EUR',
    originalCurrency: 'EUR',
    category: '飲食',
    date: '2026-10-22',
    tax: 12,
    discount: 3,
    taxRefund: 1,
    subtotal: 490,
    items,
    ...extra.draft,
  };
  return renderForm({
    scanDraft: draft,
    scanState: { status: 'ready', token: extra.token ?? 7, draft },
    ...extra.props,
  });
}

function openItems() {
  const toggle = screen.getByTestId('receipt-items-toggle');
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
  return toggle;
}

function editorRows() {
  return screen.queryAllByTestId('receipt-item-editor-row');
}

function rowNamed(name) {
  const row = editorRows().find((el) => within(el).getByTestId('receipt-item-name').value === name);
  expect(row, name).toBeTruthy();
  return row;
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
  vi.restoreAllMocks();
});

describe('editable receipt lines', () => {
  it('edits a scan preview without touching the source, total, or receipt currency', () => {
    const tea = {
      name: '茶',
      name_en: 'Tea',
      nameEn: 'TeaEn',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: 220,
      price_actual: 200,
      qty: 2,
      currency: 'EUR',
      assignedTo: 'Oscar',
      sku: 'T-1',
    };
    const sibling = { name: '留', price: 'nope', mystery: { n: 1 } };
    const items = [tea, sibling];
    const { onSave, rerender } = scanForm(items);
    const toggle = openItems();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const row = rowNamed('茶');
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    fireEvent.change(document.getElementById('ref-currency'), { target: { value: 'HKD' } });
    expect(within(row).getByTestId('receipt-item-currency').textContent).toBe('EUR');
    expect(within(row).getByLabelText(/列印金額（EUR）/)).toBeTruthy();

    fireEvent.change(within(row).getByTestId('receipt-item-name'), { target: { value: '焙茶' } });
    fireEvent.click(toggle);
    expect(screen.queryByDisplayValue('焙茶')).toBeNull();
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByDisplayValue('焙茶')).toBeTruthy();

    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Mei'],
          onCancel: () => {},
          onSave,
          scanDraft: { id: 'scan-edit', store: 'Lawson', originalAmount: 500, currency: 'EUR', items },
          scanState: { status: 'ready', token: 7, draft: { id: 'scan-edit', items } },
        }),
      ),
    );
    expect(screen.getByDisplayValue('焙茶')).toBeTruthy();

    fireEvent.change(within(rowNamed('焙茶')).getByTestId('receipt-item-price-input'), { target: { value: '-5' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.originalAmount).toBe(500);
    expect(payload.tax).toBe('12');
    expect(payload.discount).toBe('3');
    expect(payload.taxRefund).toBe('1');
    expect(payload.subtotal).toBe('490');
    expect(payload.currency).toBe('HKD');
    expect(payload.items[0]).toMatchObject({
      name: '焙茶',
      original_name: 'お茶',
      originalName: 'お茶名',
      price: -5,
      price_actual: 200,
      qty: 2,
      currency: 'EUR',
      assignedTo: 'Oscar',
      sku: 'T-1',
    });
    expect(payload.items[0].name_en).toBeUndefined();
    expect(payload.items[0].nameEn).toBeUndefined();
    expect(payload.items[1]).toBe(sibling);
    expect(tea.name).toBe('茶');
    expect(tea.price).toBe(220);
    expect(tea.name_en).toBe('Tea');
    expect(sibling.price).toBe('nope');
  });

  it('resets drafts for a new scan and lets an existing edit beat a stale draft', () => {
    const first = {
      id: 'scan-a',
      store: 'A',
      originalAmount: 15,
      currency: 'JPY',
      category: '飲食',
      date: '2026-10-22',
      items: [{ name: '第一樣', price: 15 }],
    };
    const { rerender, onSave } = renderForm({
      scanDraft: first,
      scanState: { status: 'ready', token: 1, draft: first },
    });
    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: '改過' } });
    const second = {
      id: 'scan-b',
      store: 'B',
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
          onSave,
          scanDraft: second,
          scanState: { status: 'ready', token: 2, draft: second },
        }),
      ),
    );
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
    openItems();
    expect(screen.getByDisplayValue('第二樣')).toBeTruthy();
    expect(screen.queryByDisplayValue('改過')).toBeNull();

    cleanup();
    const saved = {
      id: 'keep-9',
      store: 'Shop',
      originalAmount: 100,
      currency: 'JPY',
      originalCurrency: 'EUR',
      category: '購物',
      scanned: true,
      items: [{ name: '本體', price: 10, name_en: 'Body' }],
    };
    renderForm({
      initial: saved,
      scanDraft: { id: 'stale', store: 'Stale', originalAmount: 1, currency: 'USD', items: [{ name: '過期', price: 999 }] },
      scanState: { status: 'ready', token: 99, draft: { items: [{ name: '過期', price: 999 }] } },
    });
    openItems();
    expect(screen.getByDisplayValue('本體')).toBeTruthy();
    expect(screen.queryByDisplayValue('過期')).toBeNull();
    expect(screen.getByTestId('receipt-item-currency').textContent).toBe('EUR');
  });

  it('discards edits on cancel and blocks save while a printed amount is temporarily invalid', () => {
    const item = Object.freeze({ name: '茶', price: 8, priceActual: 7, price_actual: 6 });
    const { onSave, onCancel } = scanForm([item]);
    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '-' } });
    fireEvent.click(screen.getByTestId('form-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(item.price).toBe(8);

    cleanup();
    const again = scanForm([item]);
    openItems();
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '-.' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(again.onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('列印金額要是數字');
    expect(item.price).toBe(8);
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(again.onSave).toHaveBeenCalledTimes(1);
    expect(again.onSave.mock.calls[0][0].items[0].price).toBe(0);
    expect(again.onSave.mock.calls[0][0].items[0].priceActual).toBe(7);
    expect(again.onSave.mock.calls[0][0].items[0].price_actual).toBe(6);
  });

  it('adds and removes rows, keeps focus, and does not save or add on Enter', () => {
    const item = { name: '茶', price: 8 };
    const { onSave } = scanForm([item]);
    openItems();
    const before = screen.getByTestId('receipt-item-name');
    const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    before.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(editorRows()).toHaveLength(1);

    fireEvent.click(screen.getByTestId('receipt-item-add'));
    expect(editorRows()).toHaveLength(2);
    const added = editorRows()[1].querySelector('[data-testid="receipt-item-name"]');
    expect(document.activeElement).toBe(added);
    fireEvent.change(added, { target: { value: '新列' } });
    fireEvent.change(within(editorRows()[1]).getByTestId('receipt-item-price-input'), { target: { value: '-2' } });
    fireEvent.change(within(editorRows()[1]).getByTestId('receipt-item-qty-input'), { target: { value: '1.5' } });
    fireEvent.click(within(editorRows()[0]).getByTestId('receipt-item-remove'));
    expect(editorRows()).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByTestId('receipt-item-name'));
    fireEvent.click(screen.getByTestId('receipt-item-remove'));
    expect(editorRows()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByTestId('receipt-item-add'));
    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave.mock.calls[0][0].items).toEqual([]);
    expect(item.price).toBe(8);
  });

  it('does not save a form submit during composition, then saves the finished candidate', () => {
    const { onSave } = scanForm([{ name: '茶', price: 8 }]);
    openItems();
    const input = screen.getByTestId('receipt-item-name');
    const form = screen.getByTestId('expense-form');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄔㄚ' } });
    expect(input.value).toBe('ㄔㄚ');
    expect(screen.getByTestId('receipt-item-name')).toBe(input);

    const composing = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(composing, 'isComposing', { value: true });
    input.dispatchEvent(composing);
    const code229 = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(code229, 'keyCode', { get: () => 229 });
    Object.defineProperty(code229, 'which', { get: () => 229 });
    input.dispatchEvent(code229);
    expect(composing.defaultPrevented).toBe(false);
    expect(code229.defaultPrevented).toBe(false);

    fireEvent.submit(form);
    expect(onSave).not.toHaveBeenCalled();
    expect(editorRows()).toHaveLength(1);
    expect(input.value).toBe('ㄔㄚ');

    fireEvent.change(input, { target: { value: '茶葉' } });
    fireEvent.compositionEnd(input, { data: '葉' });
    expect(input.value).toBe('茶葉');
    expect(screen.getByTestId('receipt-item-name')).toBe(input);
    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].items[0].name).toBe('茶葉');
    expect(onSave.mock.calls[0][0].items[0].price).toBe(8);
    expect(JSON.stringify(onSave.mock.calls[0][0].items)).not.toContain('ㄔㄚ');
  });

  it('shows a blank or minus amount after Save while the editor is collapsed', () => {
    const blankItem = Object.freeze({ name: '茶', price: 8, sku: 'keep' });
    const blank = scanForm([blankItem]);
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
    const blankToggle = openItems();
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '' } });
    fireEvent.click(blankToggle);
    expect(blankToggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('receipt-item-price-input')).toBeNull();

    fireEvent.click(screen.getByTestId('form-save'));
    expect(blank.onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('receipt-items-panel').hasAttribute('hidden')).toBe(false);
    const blankAlert = screen.getByRole('alert');
    const blankPrice = screen.getByTestId('receipt-item-price-input');
    expect(blankAlert.textContent).toContain('請填寫此列列印金額');
    expect(blankAlert.closest('[hidden]')).toBeNull();
    expect(document.activeElement).toBe(blankPrice);
    expect(blankPrice.value).toBe('');
    expect(blankPrice.getAttribute('aria-invalid')).toBe('true');
    expect(blankPrice.getAttribute('aria-describedby')).toBe(blankAlert.id);
    expect(blankItem.price).toBe(8);

    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByTestId('form-save'));
    expect(blank.onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByTestId('receipt-item-price-input'));
    expect(screen.getByRole('alert').textContent).toContain('請填寫此列列印金額');
    expect(screen.getByTestId('receipt-item-price-input').value).toBe('');

    cleanup();
    const first = Object.freeze({ name: '茶', price: 8 });
    const second = Object.freeze({ name: '餅', price: 3 });
    const minus = scanForm([first, second]);
    openItems();
    const secondPrice = screen.getAllByTestId('receipt-item-price-input')[1];
    fireEvent.change(secondPrice, { target: { value: '-' } });
    fireEvent.click(screen.getByTestId('receipt-items-toggle'));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByTestId('form-save'));
    expect(minus.onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('receipt-items-toggle').getAttribute('aria-expanded')).toBe('true');
    const prices = screen.getAllByTestId('receipt-item-price-input');
    expect(prices[0].value).toBe('8');
    expect(prices[1].value).toBe('-');
    expect(document.activeElement).toBe(prices[1]);
    expect(screen.getByRole('alert').textContent).toContain('列印金額要是數字');
    expect(prices[1].getAttribute('aria-invalid')).toBe('true');
    expect(first.price).toBe(8);
    expect(second.price).toBe(3);

    const card = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ExpenseCard, {
          expense: {
            id: 'card-stay-shut',
            date: '2026-10-22',
            store: 'Lawson',
            category: '飲食',
            assignedTo: '共同',
            payer: 'Oscar',
            payment: 'cash',
            currency: 'JPY',
            originalAmount: 10,
            hkdAmount: 1,
            scanned: true,
            items: [{ name: '茶', price: 10 }],
          },
          onEdit: () => {},
          onDelete: () => {},
        }),
      ),
    );
    const cardToggle = within(card.container).getByTestId('receipt-items-toggle');
    expect(cardToggle.getAttribute('aria-expanded')).toBe('false');
    expect(within(card.container).queryByRole('alert')).toBeNull();
    expect(within(card.container).queryByTestId('receipt-item-name')).toBeNull();
  });

  it('shows localized errors for a new incomplete row in both languages and then saves zero', async () => {
    const { onSave } = scanForm([]);
    openItems();
    fireEvent.click(screen.getByTestId('receipt-item-add'));
    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('請填寫此列名稱')).toBeTruthy();
    expect(screen.getByText('請填寫此列列印金額')).toBeTruthy();

    cleanup();
    await i18n.changeLanguage('en');
    const english = scanForm([]);
    openItems();
    fireEvent.click(screen.getByTestId('receipt-item-add'));
    fireEvent.change(screen.getByTestId('receipt-item-qty-input'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(english.onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a name for this line').textContent).not.toMatch(/[\u3400-\u9fff]/);
    expect(screen.getByText('Quantity must be a positive number, or blank to clear').textContent).not.toMatch(/[\u3400-\u9fff]/);
    fireEvent.change(screen.getByTestId('receipt-item-name'), { target: { value: 'Zero' } });
    fireEvent.change(screen.getByTestId('receipt-item-price-input'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('receipt-item-qty-input'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(english.onSave.mock.calls[0][0].items).toEqual([{ name: 'Zero', price: 0 }]);
  });

  it('uses the saved-card edit route without writing lines or opening the chevron', () => {
    const expense = {
      id: 'card-edit',
      date: '2026-10-22',
      store: 'Lawson',
      category: '飲食',
      assignedTo: '共同',
      payer: 'Oscar',
      payment: 'cash',
      currency: 'JPY',
      originalAmount: 10,
      hkdAmount: 1,
      scanned: true,
      items: [{ name: '茶', price: 10 }],
    };
    const { onEdit, onDelete } = renderCard(expense);
    const toggle = screen.getByTestId('receipt-items-toggle');
    const more = screen.getByRole('button', { name: /更多動作/ });
    const slip = screen.getByTestId('receipt-items-tab');
    expect(screen.queryByTestId('receipt-items-edit')).toBeNull();
    expect(screen.queryByText('編輯明細')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.closest('.expense-amt-col')).toBeTruthy();
    expect(slip.closest('.expense-amt-col')).toBe(toggle.closest('.expense-amt-col'));
    expect(more.parentElement.contains(toggle)).toBe(false);
    expect(more.parentElement.contains(slip)).toBe(false);
    expect(toggle.contains(slip)).toBe(true);
    expect(slip.nextElementSibling).toBe(toggle.querySelector('svg'));
    expect(slip.textContent).toBe('明細');
    expect(slip.getAttribute('aria-hidden')).toBe('true');
    expect(slip.className).toContain('font-hand');
    expect(slip.className).toContain('jr-receipt-slip');
    expect(slip.className.split(/\s+/)).not.toContain('jr-btn-paper');
    expect(slip.className.split(/\s+/)).not.toContain('w-full');
    expect(slip.className).not.toMatch(/jr-washi|jr-torn|jr-tape|airmail/);
    expect(toggle.textContent).not.toContain('收據明細');
    expect(toggle.getAttribute('aria-label')).toBe('展開收據明細');
    expect(toggle.className.split(/\s+/)).not.toContain('jr-btn-paper');
    expect(toggle.className.split(/\s+/)).not.toContain('w-full');
    expect(toggle.className.split(/\s+/)).not.toContain('h-11');
    expect(toggle.className.split(/\s+/)).not.toContain('w-11');
    expect(toggle.className).toContain('min-h-11');
    expect(toggle.className).toContain('min-w-11');
    expect(toggle.style.minHeight).toBe('44px');
    expect(toggle.style.minWidth).toBe('44px');
    expect(toggle.style.width).toBe('');
    expect(toggle.style.height).toBe('');
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: /編輯/ }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toBe(expense);
    expect(onDelete).not.toHaveBeenCalled();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('receipt-item-name')).toBeNull();
    fireEvent.click(toggle);
    const inside = document.querySelector('[data-testid="expense-ticket-inside"]');
    expect(inside.contains(screen.getByTestId('receipt-item-row'))).toBe(true);
    expect(inside.contains(screen.getByTestId('receipt-items-disclaimer'))).toBe(true);
    expect(screen.getByTestId('receipt-item-row').textContent).toContain('茶');
    expect(screen.queryByTestId('receipt-item-name')).toBeNull();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(toggle.querySelector('svg').style.transform).toBe('rotate(90deg)');
  });

  it('keeps narrow editor controls at 16px and 44px inside data-noswipe', () => {
    const longName = `N${'A'.repeat(80)}`;
    scanForm([{ name: longName, price: 999999999999 }]);
    openItems();
    const root = screen.getByTestId('receipt-items');
    const input = screen.getByTestId('receipt-item-name');
    const add = screen.getByTestId('receipt-item-add');
    expect(input.style.fontSize).toBe('16px');
    expect(input.style.minHeight).toBe('44px');
    expect(screen.getByTestId('receipt-item-price-input').style.fontSize).toBe('16px');
    expect(add.getAttribute('type')).toBe('button');
    expect(add.style.minHeight).toBe('44px');
    expect(add.style.minWidth).toBe('44px');
    expect(input.closest('[data-noswipe]')).toBeTruthy();
    const row = screen.getByTestId('receipt-item-editor-row');
    expect(row.style.overflowWrap).toBe('anywhere');
    expect(row.style.whiteSpace).toBe('normal');
    expect(row.className).not.toContain('truncate');
    expect(row.className).not.toContain('whitespace-nowrap');
    root.parentElement.style.width = '320px';
    expect(root.style.maxWidth).toBe('100%');
    expect(root.style.width).toBe('100%');
    expect(input.value).toBe(longName);
  });
});
