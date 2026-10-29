// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Ledger from './Ledger';

afterEach(() => {
  cleanup();
});

const expensesA = [
  { id: 1, hkdAmount: 300, assignedTo: '共同', payer: 'A', store: '1', category: '飲食', currency: 'HKD', date: '2026-10-01' },
  { id: 2, hkdAmount: 100, assignedTo: 'A', payer: 'B', store: '2', category: '飲食', currency: 'HKD', date: '2026-10-01' },
  { id: 3, hkdAmount: 200, assignedTo: 'B', payer: 'B', store: '3', category: '飲食', currency: 'HKD', date: '2026-10-02' },
  { id: 4, hkdAmount: 60, assignedTo: '', payer: '', store: '4', category: '飲食', currency: 'HKD', date: '2026-10-02' },
  {
    id: 5,
    hkdAmount: 90,
    assignedTo: '共同',
    payer: 'A',
    store: '5',
    category: '飲食',
    currency: 'HKD',
    date: '2026-10-03',
    items: [{ price: 30, assignedTo: 'B' }, { price: 60 }],
  },
];

function renderLedger(trip, initialFilters) {
  return render(
    createElement(Ledger, {
      trip,
      initialFilters,
      onScan: () => {},
      onAdd: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onOpenDay: () => {},
    }),
  );
}

function amountText() {
  return screen.getByTestId('ledger-total-amount').textContent.replace(/\s/g, '');
}

describe('Ledger person chips', () => {
  it('counts chips inside the payer filter and clears payer from the 全部 chip', () => {
    const trip = {
      name: '夾錢',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: null },
      expenses: expensesA,
    };
    renderLedger(trip, { payer: 'A' });

    const allChip = screen.getByRole('button', { name: '全部 (3)' });
    expect(allChip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'B (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A (0)' })).toBeTruthy();
    expect(amountText()).toBe('HK$450');

    fireEvent.click(screen.getByRole('button', { name: 'B (1)' }));
    expect(screen.getByRole('button', { name: '全部 (3)' }).getAttribute('aria-pressed')).toBe('false');
    expect(amountText()).toBe('HK$30');

    fireEvent.click(screen.getByRole('button', { name: '全部 (3)' }));
    expect(screen.getByRole('button', { name: '全部 (5)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'B (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A (1)' })).toBeTruthy();
    expect(amountText()).toBe('HK$750');
  });

  it('shows a 共同 chip when people has no 共同 but a blank assignee still has a bucket', () => {
    const trip = {
      name: '無共同',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['人物A', '1'], budget: null },
      expenses: [
        { id: 1, hkdAmount: 500, assignedTo: '', payer: '人物A', store: '1', category: '飲食', currency: 'HKD' },
        { id: 2, hkdAmount: 100, assignedTo: '', payer: '', store: '2', category: '飲食', currency: 'HKD' },
        { id: 3, hkdAmount: 300, assignedTo: '共同', payer: '人物A', store: '3', category: '飲食', currency: 'HKD' },
        {
          id: 4,
          hkdAmount: 80,
          assignedTo: '',
          payer: '1',
          store: '4',
          category: '飲食',
          currency: 'HKD',
          items: [{ price: 80, assignedTo: '1' }],
        },
      ],
    };
    renderLedger(trip, { payer: '人物A' });

    expect(screen.getByRole('button', { name: '全部 (3)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '共同 (3)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 (0)' })).toBeTruthy();
    expect(amountText()).toBe('HK$900');
  });
});
