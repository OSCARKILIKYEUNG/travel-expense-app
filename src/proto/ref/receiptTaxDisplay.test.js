// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExpenseFormPricingSection from '../../components/expense/ExpenseFormPricingSection';
import i18n from '../../i18n';
import { buildExpenseFromAI } from '../../services/AIService';
import AddForm from './AddForm';
import ExpenseCard from './ExpenseCard';
import Ledger from './Ledger';

const EQUATION_ZH = '實付金額 = 商品小計 + 退稅優惠 + 折扣';
const EQUATION_EN = 'Amount paid = Item subtotal + Tax refund + Discount';

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

function renderCard(expense) {
  return render(createElement(
    I18nextProvider,
    { i18n },
    createElement(ExpenseCard, { expense, onEdit: () => {}, onDelete: () => {} }),
  ));
}

function openAdvanced() {
  fireEvent.click(screen.getByRole('button', { name: /進階|Advanced/ }));
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
});

describe('receipt tax display', () => {
  it('labels the default notebook subtotal as tax-included and keeps added tax distinct', () => {
    renderForm();
    expect(screen.queryByTestId('paid-formula-scan')).toBeNull();
    expect(screen.queryByTestId('paid-formula-edit')).toBeNull();
    expect(screen.getByText('已含消費稅（不另加）')).toBeTruthy();
    expect(screen.getByText('商品小計（含稅）')).toBeTruthy();
    expect(screen.queryByText('商品小計（未稅）')).toBeNull();
    expect(screen.getByLabelText('另加消費稅')).toBeTruthy();
    const advanced = screen.getByTestId('paid-formula-advanced');
    expect(within(advanced).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_ZH);
    expect(within(advanced).getByTestId('paid-formula-included-note').textContent).toContain('不加進實付');
    expect(within(advanced).getByTestId('paid-formula-equation').textContent).not.toContain('已含');
  });

  it('labels an exclusive subtotal as before tax on the scan preview and in Advanced', () => {
    const draft = {
      id: 'exclusive-scan',
      receiptType: 'tax_exclusive',
      store: '外稅店',
      currency: 'JPY',
      originalAmount: 2948,
      subtotal: 2680,
      tax: 268,
      taxRefund: 0,
      discount: 0,
      category: '飲食',
      date: '2026-10-22',
    };
    renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'exclusive-scan', draft },
    });
    const scan = screen.getByTestId('paid-formula-scan');
    expect(within(scan).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_ZH);
    expect(within(scan).getByTestId('paid-formula-equation').textContent).not.toContain('含稅');
    expect(within(scan).getByTestId('paid-formula-values').textContent).toContain('2948');
    expect(within(scan).getByTestId('paid-formula-values').textContent).toContain('2680');
    expect(within(scan).getByTestId('paid-formula-values').textContent).not.toContain('另加');
    expect(screen.queryByTestId('paid-formula-edit')).toBeNull();

    expect(screen.getByText('商品小計（未稅）')).toBeTruthy();
    expect(screen.queryByText('商品小計（含稅）')).toBeNull();
    expect(screen.getByLabelText('另加消費稅').value).toBe('268');
    expect(within(screen.getByTestId('paid-formula-scan')).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_ZH);
  });

  it('shows the paid formula on a saved edit, with included tax outside the sum', () => {
    const saved = {
      ...lawson(),
      id: 'saved-edit',
      hkdAmount: 51,
      category: '飲食',
      assignedTo: '共同',
    };
    renderForm({ initial: saved });
    expect(screen.queryByTestId('paid-formula-scan')).toBeNull();
    const edit = screen.getByTestId('paid-formula-edit');
    expect(within(edit).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_ZH);
    const values = within(edit).getByTestId('paid-formula-values');
    expect(values.textContent).toContain('1015');
    expect(values.textContent).not.toContain('82');
    expect(values.textContent).not.toContain('1097');
    expect(values.textContent).not.toContain('933');
    expect(within(edit).getByTestId('paid-formula-included-note').textContent).toContain('已含消費稅 82');
    expect(within(edit).getByTestId('paid-formula-included-note').textContent).toContain('不加進實付');
    expect(screen.getByTestId('form-amount').value).toBe('1015');

    expect(screen.getByLabelText('商品小計（含稅）').value).toBe('1015');
    expect(screen.queryByText('商品小計（未稅）')).toBeNull();
  });

  it('keeps the LAWSON paid total at 1015 when the formula is showing and fields are edited', () => {
    const draft = { ...lawson(), id: 'lawson-scan' };
    const { onSave } = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'lawson-scan', draft },
    });
    const scan = screen.getByTestId('paid-formula-scan');
    expect(within(scan).getByTestId('paid-formula-values').textContent).toContain('1015');
    expect(within(scan).getByTestId('paid-formula-values').textContent).not.toContain('82');
    expect(within(scan).getByTestId('paid-formula-included-note').textContent).toContain('82');
    expect(screen.getByTestId('form-amount').value).toBe('1015');

    fireEvent.change(screen.getByLabelText('商品小計（含稅）'), { target: { value: '933' } });
    fireEvent.change(screen.getByLabelText('退稅優惠'), { target: { value: '-30' } });
    fireEvent.change(screen.getByLabelText('折扣'), { target: { value: '-10' } });
    const values = within(screen.getByTestId('paid-formula-scan')).getByTestId('paid-formula-values').textContent;
    expect(values).toContain('933');
    expect(values).toContain('-30');
    expect(values).toContain('-10');
    expect(values).toContain('1015');
    expect(values).not.toContain('82');
    expect(screen.getByTestId('form-amount').value).toBe('1015');

    fireEvent.click(screen.getByTestId('form-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.originalAmount).toBe(1015);
    expect(payload.amount).toBe('1015');
    expect(payload.subtotal).toBe('933');
    expect(payload.taxRefund).toBe('-30');
    expect(payload.discount).toBe('-10');
    expect(payload.includedTaxAmount).toBe(82);
    expect(payload.includedTaxBreakdown).toEqual([
      { ratePercent: 10, targetAmount: 440, basis: 'gross', includedTaxAmount: 40 },
      { ratePercent: 8, targetAmount: 575, basis: 'gross', includedTaxAmount: 42 },
    ]);
    expect(payload.tax).not.toBe(82);
    expect(payload.tax).not.toBe('82');
    expect(payload.originalAmount).not.toBe(1097);
    expect(payload.hkdAmount).toBe(Math.round(1015 * 0.0526));
    expect(draft.originalAmount).toBe(1015);
    expect(draft.includedTaxAmount).toBe(82);
  });

  it('shows included tax and refund lines on a saved card when subtotal equals paid', () => {
    const plain = {
      ...lawson(),
      id: 'lawson-card',
      hkdAmount: 51,
      category: '飲食',
      assignedTo: '共同',
      payer: 'Oscar',
    };
    const plainView = renderCard(plain);
    const article = plainView.container.querySelector('article.jr-ticket');
    const inside = article.querySelector('.jr-ticket-inside');
    expect(article.className).not.toContain('jr-torn');
    expect(article.querySelector('.jr-ticket-head').textContent).toBe('飲食 · 共同');
    const summary = screen.getByTestId('included-tax-summary');
    expect(inside.contains(summary)).toBe(true);
    expect(summary.textContent).toContain('82');
    expect(summary.textContent).toContain('40');
    expect(summary.textContent).toContain('42');
    expect(summary.textContent).toContain('440');
    expect(summary.textContent).toContain('575');
    expect(summary.textContent).toContain('已含消費稅（不另加）');
    expect(plainView.container.textContent).toContain('1,015');
    expect(plainView.container.textContent).not.toContain('1,097');
    expect(plainView.container.textContent).not.toContain('933');
    expect(screen.queryByTestId('saved-adjustments')).toBeNull();
    plainView.unmount();

    renderCard({ ...plain, id: 'lawson-adjust', taxRefund: -15, discount: -5 });
    expect(screen.getByTestId('included-tax-summary').textContent).toContain('82');
    const adjust = screen.getByTestId('expense-lawson-adjust');
    const adjustInside = adjust.querySelector('.jr-ticket-inside');
    expect(adjustInside.contains(screen.getByTestId('included-tax-summary'))).toBe(true);
    expect(adjustInside.contains(screen.getByTestId('saved-adjustments'))).toBe(true);
    expect(screen.getByTestId('saved-tax-refund').textContent).toContain('退稅');
    expect(screen.getByTestId('saved-tax-refund').textContent).toContain('-15');
    expect(screen.getByTestId('saved-discount').textContent).toContain('折扣');
    expect(screen.getByTestId('saved-discount').textContent).toContain('-5');
    expect(screen.getByTestId(`expense-lawson-adjust`).textContent).toContain('1,015');
    expect(screen.getByTestId('expense-lawson-adjust').textContent).not.toContain('1,097');
  });

  it('keeps omitted, printed zero, cleared, and additive tax honest', () => {
    const baseCard = {
      id: 'legacy-card',
      store: '舊店',
      originalAmount: 2359,
      subtotal: 2359,
      currency: 'JPY',
      tax: 210,
      hkdAmount: 120,
      category: '飲食',
      assignedTo: '共同',
      date: '2026-10-22',
    };
    const omitted = renderCard(baseCard);
    expect(screen.queryByTestId('included-tax-summary')).toBeNull();
    expect(omitted.container.textContent).not.toContain('1097');
    omitted.unmount();

    renderCard({ ...baseCard, id: 'zero-card', includedTaxAmount: 0, includedTaxBreakdown: [] });
    expect(screen.getByTestId('included-tax-summary').textContent).toContain('已含消費稅');
    expect(screen.getByTestId('included-tax-summary').textContent).toContain('0');
    cleanup();

    renderCard({ ...baseCard, id: 'cleared-card', includedTaxAmount: null, includedTaxBreakdown: [] });
    expect(screen.queryByTestId('included-tax-summary')).toBeNull();
    cleanup();

    const { onSave } = renderForm({
      initial: {
        id: 'additive-edit',
        store: '外稅店',
        originalAmount: 2948,
        subtotal: 2680,
        tax: 268,
        currency: 'JPY',
        receiptType: 'tax_exclusive',
        category: '飲食',
        date: '2026-10-22',
      },
    });
    expect(screen.getByText('商品小計（未稅）')).toBeTruthy();
    expect(screen.getByLabelText('另加消費稅').value).toBe('268');
    expect(within(screen.getByTestId('paid-formula-edit')).getByTestId('paid-formula-values').textContent).not.toContain('另加');
    fireEvent.click(screen.getByTestId('form-save'));
    const additive = onSave.mock.calls[0][0];
    expect(additive.originalAmount).toBe(2948);
    expect(additive.tax).toBe('268');
    expect(additive.includedTaxAmount).toBeUndefined();
    expect(additive.includedTaxBreakdown).toBeUndefined();
    expect(additive.originalAmount).not.toBe(2948 + 268);

    cleanup();
    const cleared = renderForm({
      initial: {
        id: 'cleared-edit',
        store: '清除店',
        originalAmount: 1015,
        subtotal: 1015,
        currency: 'JPY',
        category: '飲食',
        date: '2026-10-22',
        receiptType: 'tax_inclusive',
        includedTaxAmount: null,
        includedTaxBreakdown: [],
      },
    });
    const note = within(screen.getByTestId('paid-formula-edit')).getByTestId('paid-formula-included-note').textContent;
    expect(note).toBe('已含消費稅只作說明，不加進實付。');
    expect(note).not.toContain('82');
    fireEvent.click(screen.getByTestId('form-save'));
    expect(cleared.onSave.mock.calls[0][0].originalAmount).toBe(1015);
    expect(cleared.onSave.mock.calls[0][0].includedTaxAmount).toBeNull();
    expect(cleared.onSave.mock.calls[0][0].includedTaxBreakdown).toEqual([]);

    cleanup();
    const zero = renderForm({
      initial: {
        id: 'zero-edit',
        store: '零稅店',
        originalAmount: 10,
        subtotal: 10,
        currency: 'JPY',
        category: '飲食',
        date: '2026-10-22',
        includedTaxAmount: 0,
        includedTaxBreakdown: [],
      },
    });
    expect(within(screen.getByTestId('paid-formula-edit')).getByTestId('paid-formula-included-note').textContent)
      .toContain('已含消費稅 0');
    fireEvent.click(screen.getByTestId('form-save'));
    expect(zero.onSave.mock.calls[0][0].originalAmount).toBe(10);
    expect(zero.onSave.mock.calls[0][0].includedTaxAmount).toBe(0);
    expect(zero.onSave.mock.calls[0][0].includedTaxBreakdown).toEqual([]);
  });

  it('shows the same included tax on a ledger row', () => {
    const expense = {
      ...lawson(),
      id: 'ledger-lawson',
      date: '2026-10-22',
      hkdAmount: 51,
      category: '飲食',
      assignedTo: '共同',
      payer: 'Oscar',
      payment: 'cash',
      taxRefund: -15,
      discount: -5,
    };
    render(createElement(Ledger, {
      trip: {
        name: '稅顯示',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        settings: { people: ['共同', 'Oscar'], budget: null },
        expenses: [expense],
      },
      onScan: () => {},
      onAdd: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onOpenDay: () => {},
    }));
    const row = screen.getByTestId('expense-ledger-lawson');
    expect(within(row).getByTestId('included-tax-summary').textContent).toContain('82');
    expect(within(row).getByTestId('included-tax-summary').textContent).toContain('40');
    expect(within(row).getByTestId('included-tax-summary').textContent).toContain('42');
    expect(within(row).getByTestId('saved-tax-refund').textContent).toContain('-15');
    expect(within(row).getByTestId('saved-discount').textContent).toContain('-5');
    expect(row.textContent).toContain('1,015');
    expect(row.textContent).not.toContain('1,097');
    expect(row.textContent).not.toContain('933');
  });

  it('uses the English labels and formula, including the exclusive subtotal', async () => {
    await i18n.changeLanguage('en');
    const draft = { ...lawson(), id: 'en-scan' };
    const view = renderForm({
      scanDraft: draft,
      scanState: { status: 'ready', token: 'en-scan', draft },
    });
    const scan = screen.getByTestId('paid-formula-scan');
    expect(within(scan).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_EN);
    expect(within(scan).getByTestId('paid-formula-values').textContent).not.toContain('82');
    expect(within(scan).getByTestId('paid-formula-included-note').textContent).toContain('Included tax 82');
    expect(within(scan).getByTestId('paid-formula-included-note').textContent).toContain('not added');
    expect(screen.getByText('Item subtotal (tax included)')).toBeTruthy();
    expect(screen.getByLabelText('Added tax')).toBeTruthy();
    expect(screen.getByText('Included tax (not added)')).toBeTruthy();
    view.unmount();

    renderForm({
      initial: {
        id: 'en-exclusive',
        store: 'Exclusive shop',
        originalAmount: 42,
        subtotal: 35,
        tax: 7,
        currency: 'EUR',
        receiptType: 'tax_exclusive',
        category: '飲食',
        date: '2026-10-22',
      },
    });
    expect(screen.getByText('Item subtotal (before tax)')).toBeTruthy();
    expect(screen.queryByText('Item subtotal (tax included)')).toBeNull();
    expect(within(screen.getByTestId('paid-formula-edit')).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_EN);
  });

  it('uses the exclusive subtotal label on the legacy pricing form and the included label otherwise', () => {
    const props = {
      patch: () => {},
      people: ['共同'],
      defaultAssignee: '共同',
      idPrefix: 'edit',
    };
    const inclusive = render(createElement(
      I18nextProvider,
      { i18n },
      createElement(ExpenseFormPricingSection, {
        ...props,
        form: {
          currency: 'JPY',
          originalAmount: 1015,
          subtotal: 1015,
          tax: 0,
          taxRefund: 0,
          discount: 0,
          items: [],
          assignedTo: '共同',
          receiptType: 'tax_inclusive',
        },
      }),
    ));
    expect(screen.getByText('商品小計（含稅）')).toBeTruthy();
    expect(screen.getByLabelText('另加消費稅')).toBeTruthy();
    expect(screen.queryByText('商品小計（未稅）')).toBeNull();
    expect(within(screen.getByTestId('paid-formula-legacy')).getByTestId('paid-formula-equation').textContent).toBe(EQUATION_ZH);
    inclusive.unmount();

    render(createElement(
      I18nextProvider,
      { i18n },
      createElement(ExpenseFormPricingSection, {
        ...props,
        form: {
          currency: 'JPY',
          originalAmount: 2948,
          subtotal: 2680,
          tax: 268,
          taxRefund: 0,
          discount: 0,
          items: [],
          assignedTo: '共同',
          receiptType: 'tax_exclusive',
        },
      }),
    ));
    expect(screen.getByText('商品小計（未稅）')).toBeTruthy();
    expect(screen.queryByText('商品小計（含稅）')).toBeNull();
    expect(screen.getByLabelText('另加消費稅').value).toBe('268');
  });
});
