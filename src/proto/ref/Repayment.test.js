// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import NotebookApp from '../../notebook/NotebookApp';
import SettingsView from '../../notebook/SettingsView';
import ChartsView from './ChartsView';
import Ledger from './Ledger';

afterEach(async () => {
  cleanup();
  window.location.hash = '';
  await i18n.changeLanguage('zh-TW');
});

function createTwoPersonTrip(overrides = {}) {
  return {
    id: 'trip-repay-test',
    name: '東京夾錢測試',
    startDate: '2026-10-20',
    endDate: '2026-10-25',
    tripCurrency: 'JPY',
    accountingCurrency: 'HKD',
    settings: {
      people: ['共同', 'A', 'B'],
      rate: 0.05,
      budget: 5000,
    },
    expenses: [
      {
        id: 'e1',
        date: '2026-10-21',
        store: '壽司晚餐',
        place: '銀座',
        category: '飲食',
        assignedTo: '共同',
        payer: 'B',
        payment: 'card',
        currency: 'HKD',
        originalAmount: 600,
        hkdAmount: 600,
        items: [],
      },
    ],
    ...overrides,
  };
}

describe('PR-repay-2: Settlement repayment UI', () => {
  it('Charts: tapping 標記已還 calls settlementActions.add and in NotebookApp marks both settle rows 已結清, with undo restoring the transfer', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = createTwoPersonTrip();
    const addSpy = vi.fn();

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-22',
          settlementActions: { add: addSpy, update: vi.fn(), remove: vi.fn() },
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );

    const markBtn = screen.getByTestId('settle-mark-repaid');
    expect(markBtn.textContent).toBe('標記已還');
    fireEvent.click(markBtn);

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith({
      from: 'A',
      to: 'B',
      amount: 300,
      currency: 'HKD',
      hkdAmount: 300,
      rate: 1,
      date: '2026-10-22',
      note: '',
    });
    unmount();

    // Full NotebookApp flow with toast + undo
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          today: '2026-10-22',
          initialHash: '#charts',
        }),
      ),
    );

    expect(screen.getByText(/A 要還 B HK\$300/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('settle-mark-repaid'));

    expect(screen.getByTestId('chart-person-A').textContent).toContain('已結清');
    expect(screen.getByTestId('chart-person-B').textContent).toContain('已結清');
    expect(screen.queryByTestId('settle-mark-repaid')).toBeNull();

    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('已記錄 A 還 B HK$300');

    // Undo restores the transfer row
    fireEvent.click(screen.getByTestId('toast-undo'));
    expect(screen.getByTestId('settle-mark-repaid')).toBeTruthy();
    expect(screen.getByText(/A 要還 B HK\$300/)).toBeTruthy();
  });

  it('Partial form in settle-sheet: changing amount to half and saving updates remaining to 尚欠 $half, and warns on overpay', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = createTwoPersonTrip();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          today: '2026-10-22',
          initialHash: '#charts',
        }),
      ),
    );

    fireEvent.click(screen.getByTestId('chart-person-A'));
    const sheet = screen.getByTestId('settle-sheet');
    const repaySection = within(sheet).getByTestId('settle-sheet-repayments');
    expect(repaySection.textContent).toContain('尚欠 HK$300');

    const amountInput = within(sheet).getByTestId('repayment-amount');
    expect(amountInput.value).toBe('300');

    // Test overpay inline warning first
    fireEvent.change(amountInput, { target: { value: '450' } });
    const warning = within(sheet).getByTestId('repayment-overpay-warning');
    expect(warning.textContent).toContain('超出尚欠 HK$300，方向將會反轉');

    // Change amount to half (150) and save
    fireEvent.change(amountInput, { target: { value: '150' } });
    expect(within(sheet).queryByTestId('repayment-overpay-warning')).toBeNull();
    fireEvent.click(within(sheet).getByTestId('repayment-save'));

    expect(within(sheet).getByTestId('settle-sheet-status').textContent).toBe('尚欠 HK$150');
    expect(within(sheet).getByTestId('settle-sheet-repayments').textContent).toContain('A 還 B');
  });

  it('Ledger: renders ledger-repayment-row with ⇄ and 「A 還 B」, keeps LedgerTotalCard and day sums unchanged, and supports delete + undo with same id', async () => {
    await i18n.changeLanguage('zh-TW');
    const baseTrip = createTwoPersonTrip();
    const tripWithSettlement = createTwoPersonTrip({
      settlements: [
        {
          id: 'stl-fixed-1',
          tripId: 'trip-repay-test',
          from: 'A',
          to: 'B',
          amount: 200,
          currency: 'HKD',
          hkdAmount: 200,
          rate: 1,
          date: '2026-10-21',
          note: '午餐夾錢',
        },
      ],
    });

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Ledger, {
          trip: baseTrip,
          today: '2026-10-22',
          onScan: () => {},
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
          onOpenDay: () => {},
        }),
      ),
    );
    const totalWithout = screen.getByTestId('ledger-total-amount').textContent.replace(/\s/g, '');
    unmount();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip: tripWithSettlement,
          today: '2026-10-22',
          initialHash: '#ledger',
        }),
      ),
    );

    const totalWith = screen.getByTestId('ledger-total-amount').textContent.replace(/\s/g, '');
    expect(totalWith).toBe(totalWithout);
    expect(totalWith).toBe('HK$600');

    // Day group sum also remains HKD $600
    const dayGroup = screen.getByTestId('ledger-group-2026-10-21');
    expect(dayGroup.textContent).toContain('HKD $600');

    const repayRow = screen.getByTestId('ledger-repayment-row');
    expect(repayRow.textContent).toContain('⇄');
    expect(repayRow.textContent).toContain('A 還 B');
    expect(repayRow.textContent).toContain('HK$200');

    // Tap row -> edit sheet -> delete -> undo restores with same id
    fireEvent.click(repayRow);
    const editSheet = screen.getByTestId('ledger-repayment-sheet');
    fireEvent.click(within(editSheet).getByTestId('repayment-delete'));

    expect(screen.queryByTestId('ledger-repayment-row')).toBeNull();
    expect(screen.getByTestId('toast').textContent).toContain('已刪除還款記錄');

    fireEvent.click(screen.getByTestId('toast-undo'));
    const restoredRow = screen.getByTestId('ledger-repayment-row');
    expect(restoredRow.textContent).toContain('A 還 B');
  });

  it('One-person trip: hides 標記已還, repayment form, and ledger-add-repayment button', async () => {
    await i18n.changeLanguage('zh-TW');
    const soloTrip = createTwoPersonTrip({
      settings: { people: ['共同', 'A'], rate: 0.05, budget: null },
    });

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: soloTrip,
          today: '2026-10-22',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );

    expect(screen.queryByTestId('settle-mark-repaid')).toBeNull();
    fireEvent.click(screen.getByTestId('chart-person-A'));
    const sheet = screen.getByTestId('settle-sheet');
    expect(within(sheet).queryByTestId('repayment-form')).toBeNull();
    unmount();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Ledger, {
          trip: soloTrip,
          today: '2026-10-22',
          onScan: () => {},
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
          onOpenDay: () => {},
        }),
      ),
    );
    expect(screen.queryByTestId('ledger-add-repayment')).toBeNull();
  });

  it('Flags unknown members in sheet and ledger and appends droppedSettlements count in Settings toast', async () => {
    await i18n.changeLanguage('zh-TW');
    const tripWithUnknown = createTwoPersonTrip({
      settlements: [
        {
          id: 'stl-unknown',
          tripId: 'trip-repay-test',
          from: '舊成員',
          to: 'B',
          amount: 100,
          currency: 'HKD',
          hkdAmount: 100,
          rate: 1,
          date: '2026-10-21',
          note: '',
        },
      ],
    });

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Ledger, {
          trip: tripWithUnknown,
          today: '2026-10-22',
          onScan: () => {},
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
          onOpenDay: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('ledger-unknown-member').textContent).toBe('未知成員');
    unmount();

    const onToast = vi.fn();
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip: createTwoPersonTrip(),
          trips: [createTwoPersonTrip()],
          today: '2026-10-22',
          onRemovePerson: () => ({ droppedSettlements: 2 }),
          onToast,
        }),
      ),
    );

    fireEvent.click(screen.getByTestId('person-remove-A'));
    expect(onToast).toHaveBeenCalledWith('已移除「A」，其消費已歸入共同（已移除 2 筆還款記錄）');
  });
});
