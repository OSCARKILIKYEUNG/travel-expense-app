// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n.js';
import AddForm from './AddForm.jsx';
import LedgerTotalCard from './LedgerTotalCard.jsx';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

function classTokens(el) {
  return new Set((el.className || '').split(/\s+/).filter(Boolean));
}

describe('stuck-slip total and edit cards', () => {
  it('keeps grid paper on the ledger total and lifts it as a stuck slip, without ruled lines', () => {
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(LedgerTotalCard, {
          summary: { hkd: 5397, count: 1, filtered: false, jpy: 103110, budget: null },
          tripCurrency: 'JPY',
          accountingCurrency: 'HKD',
        }),
      ),
    );

    const card = screen.getByTestId('ledger-total-card');
    const tokens = classTokens(card);
    expect(tokens.has('jr-taped-card')).toBe(true);
    expect(tokens.has('jr-stuck-slip')).toBe(true);
    expect(tokens.has('jr-grid')).toBe(true);
    expect(tokens.has('jr-ruled')).toBe(false);
    expect(screen.getByText('旅費總計')).toBeTruthy();
  });

  it('uses opaque unlined paper slips on the edit-record amount and basic-info cards', () => {
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          initial: {
            id: 'e1',
            date: '2026-10-22',
            store: '一蘭',
            category: '飲食',
            assignedTo: '共同',
            payer: 'Oscar',
            currency: 'JPY',
            originalAmount: 1000,
          },
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar'],
          onCancel: () => {},
          onSave: () => {},
        }),
      ),
    );

    expect(screen.getByText('編輯記錄')).toBeTruthy();

    const amountCard = screen.getByTestId('form-amount').closest('.jr-taped-card');
    const basicCard = document.getElementById('ref-store').closest('.jr-taped-card');
    const saveBar = screen.getByTestId('form-save-bar');

    expect(amountCard).toBeTruthy();
    expect(basicCard).toBeTruthy();
    expect(amountCard).not.toBe(basicCard);
    expect(amountCard).not.toBe(saveBar);
    expect(basicCard).not.toBe(saveBar);

    for (const card of [amountCard, basicCard]) {
      const tokens = classTokens(card);
      expect(tokens.has('jr-taped-card')).toBe(true);
      expect(tokens.has('jr-stuck-slip')).toBe(true);
      expect(tokens.has('bg-paper')).toBe(true);
      expect(tokens.has('jr-ruled')).toBe(false);
      expect(tokens.has('jr-grid')).toBe(false);
    }

    const saveTokens = classTokens(saveBar);
    expect(saveTokens.has('jr-taped-card')).toBe(true);
    expect(saveTokens.has('bg-paper')).toBe(true);
    expect(saveTokens.has('jr-ruled')).toBe(false);
    expect(saveTokens.has('jr-stuck-slip')).toBe(false);
  });
});
