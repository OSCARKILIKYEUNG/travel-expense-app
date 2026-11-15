// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { buildExpenseFromAI } from '../../services/AIService';
import AddForm from './AddForm';
import ExpenseCard from './ExpenseCard';

function lawson(extra = {}) {
  return buildExpenseFromAI(
    {
      detected_market: 'JP',
      receipt_type: 'tax_inclusive',
      currency: 'JPY',
      store: '羅森',
      date: '2026年10月22日',
      items: [
        { name: '飯糰', price: 199 },
        { name: '茶', price: 195 },
        { name: '零食', price: 181 },
        { name: '便當', price: 440 },
      ],
      subtotal: 1015,
      tax: 0,
      total_amount: 1015,
      included_tax_amount: 82,
      included_tax_breakdown: [
        { rate_percent: 10, target_amount: 440, basis: 'gross', included_tax_amount: 40 },
        { rate_percent: 8, target_amount: 575, basis: 'gross', included_tax_amount: 42 },
      ],
      ...extra,
    },
    0,
    'JPY',
    20,
    'JPY',
  );
}

function tree(props, onSave, onCancel) {
  return createElement(
    I18nextProvider,
    { i18n },
    createElement(AddForm, {
      defaultDate: '2026-10-22',
      people: ['共同', 'Oscar'],
      ...props,
      onCancel,
      onSave,
    }),
  );
}

function renderForm(props = {}) {
  const onSave = props.onSave || vi.fn();
  const onCancel = props.onCancel || vi.fn();
  const view = render(tree(props, onSave, onCancel));
  return { ...view, onSave, onCancel };
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
});

describe('included tax editor', () => {
  it('edits printed metadata without adding it to the paid total, and keeps the same scan edits', () => {
    const draft = { ...lawson(), id: 'scan-a' };
    const props = {
      scanDraft: draft,
      scanState: { status: 'ready', token: 'scan-a', draft },
    };
    const view = renderForm(props);
    const amount = screen.getByTestId('included-tax-amount');
    expect(amount.value).toBe('82');
    expect(amount.style.fontSize).toBe('16px');
    expect(screen.getByTestId('included-tax-clear-amount').style.minHeight).toBe('44px');
    expect(screen.getByLabelText('已含消費稅合計')).toBe(amount);
    expect(screen.getAllByTestId('included-tax-row-tax')[0].value).toBe('40');
    expect(screen.getAllByTestId('included-tax-row-tax')[1].value).toBe('42');

    fireEvent.change(amount, { target: { value: '8.' } });
    expect(amount.value).toBe('8.');
    view.rerender(tree(props, view.onSave, view.onCancel));
    expect(screen.getByTestId('included-tax-amount').value).toBe('8.');

    fireEvent.change(screen.getAllByTestId('included-tax-row-tax')[0], { target: { value: '41' } });
    expect(screen.getByTestId('included-tax-mismatch').textContent).toContain('不會自動改正');
    fireEvent.click(screen.getByTestId('form-save'));

    expect(view.onSave).toHaveBeenCalledTimes(1);
    const payload = view.onSave.mock.calls[0][0];
    expect(payload.originalAmount).toBe(1015);
    expect(payload.amount).toBe('1015');
    expect(payload.includedTaxAmount).toBe(8);
    expect(payload.includedTaxBreakdown[0].includedTaxAmount).toBe(41);
    expect(payload.includedTaxBreakdown[0].targetAmount).toBe(440);
    expect(payload.includedTaxBreakdown[1]).toMatchObject({ ratePercent: 8, targetAmount: 575, includedTaxAmount: 42 });
    expect(payload.tax).not.toBe(82);
    expect(draft.includedTaxAmount).toBe(82);
  });

  it('does not submit from a row Enter or during composition, and Cancel leaves the draft untouched', () => {
    const draft = { ...lawson(), id: 'scan-cancel' };
    const { onSave, onCancel } = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'scan-cancel', draft },
    });
    const rate = screen.getAllByTestId('included-tax-rate')[0];
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    rate.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(onSave).not.toHaveBeenCalled();

    const amount = screen.getByTestId('included-tax-amount');
    fireEvent.compositionStart(amount);
    fireEvent.change(amount, { target: { value: '８' } });
    expect(amount.value).toBe('８');
    const composing = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(composing, 'isComposing', { value: true });
    amount.dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false);
    fireEvent.submit(screen.getByTestId('expense-form'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('included-tax-amount').value).toBe('８');

    fireEvent.click(screen.getByTestId('form-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    expect(draft.includedTaxAmount).toBe(82);
    expect(draft.includedTaxBreakdown[0].includedTaxAmount).toBe(40);
  });

  it('opens a collapsed invalid amount and keeps a cleared edit from restoring printed rows', () => {
    const draft = { ...lawson(), id: 'scan-clear' };
    const { onSave } = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'scan-clear', draft },
    });
    fireEvent.change(screen.getByTestId('included-tax-amount'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('included-tax-toggle'));
    expect(screen.queryByTestId('included-tax-amount')).toBeNull();
    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('included-tax-panel')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('數字');

    fireEvent.click(screen.getByTestId('included-tax-clear-amount'));
    fireEvent.click(screen.getByTestId('included-tax-clear-rows'));
    fireEvent.click(screen.getByTestId('form-save'));
    const payload = onSave.mock.calls[0][0];
    expect(payload.includedTaxAmount).toBeNull();
    expect(payload.includedTaxBreakdown).toEqual([]);
    expect(payload.originalAmount).toBe(1015);
  });

  it('uses the inclusive subtotal label only for explicit tax_inclusive evidence', () => {
    const draft = { ...lawson(), id: 'scan-label' };
    const inclusive = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'scan-label', draft },
    });
    fireEvent.click(screen.getByRole('button', { name: '進階' }));
    expect(screen.getByText('小計（含稅）')).toBeTruthy();
    inclusive.unmount();

    renderForm({
      initial: {
        id: 'legacy-jp',
        store: '舊店',
        originalAmount: 2359,
        currency: 'JPY',
        tax: 210,
        date: '2026年10月22日',
        category: '飲食',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '進階' }));
    expect(screen.getByText('標價小計')).toBeTruthy();
    expect(screen.queryByText('小計（含稅）')).toBeNull();
    expect(screen.getByLabelText('消費稅').value).toBe('210');
  });

  it('lets a receipt with unknown metadata be filled in, and a new scan drops the previous metadata', () => {
    const blank = renderForm({
      initial: {
        id: 'manual-1',
        store: '手寫',
        originalAmount: 10,
        currency: 'JPY',
        date: '2026年10月22日',
        category: '飲食',
      },
    });
    fireEvent.click(screen.getByTestId('included-tax-toggle'));
    expect(screen.getByTestId('included-tax-amount').dataset.mode).toBe('unknown');
    fireEvent.change(screen.getByTestId('included-tax-amount'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('form-save'));
    expect(blank.onSave.mock.calls[0][0].includedTaxAmount).toBe(0);
    expect(blank.onSave.mock.calls[0][0].originalAmount).toBe(10);
    blank.unmount();

    const first = { ...lawson(), id: 'old-scan' };
    const next = {
      ...lawson({ included_tax_amount: undefined, included_tax_breakdown: undefined }),
      id: 'new-scan',
    };
    delete next.includedTaxAmount;
    delete next.includedTaxBreakdown;
    const view = renderForm({
      scanDraft: first,
      scanState: { status: 'ready', token: 'old-scan', draft: first },
    });
    expect(screen.getByTestId('included-tax-amount').value).toBe('82');
    view.rerender(tree({
      scanDraft: next,
      scanState: { status: 'ready', token: 'new-scan', draft: next },
    }, view.onSave, view.onCancel));
    fireEvent.click(screen.getByTestId('included-tax-toggle'));
    expect(screen.getByTestId('included-tax-amount').value).toBe('');
    expect(screen.getByTestId('included-tax-amount').dataset.mode).toBe('unknown');
    fireEvent.click(screen.getByTestId('form-save'));
    const payload = view.onSave.mock.calls.at(-1)[0];
    expect(payload.includedTaxAmount).toBeUndefined();
    expect(payload.includedTaxBreakdown).toBeUndefined();
    expect(payload.originalAmount).toBe(1015);
  });

  it('shows stored summary text in zh-TW and en without treating it as an added charge', async () => {
    const expense = {
      ...lawson(),
      id: 'saved-1',
      hkdAmount: 50.75,
      store: '羅森',
    };
    render(createElement(I18nextProvider, { i18n }, createElement(ExpenseCard, {
      expense,
      onEdit: () => {},
      onDelete: () => {},
    })));
    const summary = screen.getByTestId('included-tax-summary');
    expect(summary.textContent).toContain('82');
    expect(summary.textContent).toContain('10%');
    expect(summary.textContent).toContain('440');
    expect(summary.textContent).toContain('40');
    expect(summary.textContent).toContain('8%');
    expect(summary.textContent).toContain('575');
    expect(summary.textContent).toContain('42');
    expect(summary.textContent).not.toContain('1097');
    expect(summary.textContent).not.toContain('933');

    cleanup();
    await i18n.changeLanguage('en');
    render(createElement(I18nextProvider, { i18n }, createElement(ExpenseCard, {
      expense,
      onEdit: () => {},
      onDelete: () => {},
    })));
    expect(screen.getByTestId('included-tax-summary').textContent).toContain('Included tax');
    expect(screen.getByTestId('included-tax-summary').textContent).toContain('82');
  });
});
