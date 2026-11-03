// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import zhTW from '../../locales/zh-TW.json';
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

    expect(screen.getByText(/A 應還 B HK\$300/)).toBeTruthy();
    fireEvent.click(screen.getByTestId('settle-mark-repaid'));

    expect(screen.getByTestId('chart-person-A').textContent).toContain('已結清');
    expect(screen.getByTestId('chart-person-B').textContent).toContain('已結清');
    expect(screen.queryByTestId('settle-mark-repaid')).toBeNull();

    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('已記錄 A 還 B HKD $300');

    // Undo restores the transfer row
    fireEvent.click(screen.getByTestId('toast-undo'));
    expect(screen.getByTestId('settle-mark-repaid')).toBeTruthy();
    expect(screen.getByText(/A 應還 B HK\$300/)).toBeTruthy();
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
    expect(warning.textContent).toContain('超出尚欠 HKD $300，方向將會反轉');

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
    const totalWithout = screen.getByTestId('ledger-total-amount').textContent;
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

    const totalWith = screen.getByTestId('ledger-total-amount').textContent;
    expect(totalWith).toBe(totalWithout);
    expect(totalWith).toBe('HKD $600');

    // Day group sum also remains HKD $600
    const dayGroup = screen.getByTestId('ledger-group-2026-10-21');
    expect(dayGroup.textContent).toContain('HKD $600');

    const repayRow = screen.getByTestId('ledger-repayment-row');
    expect(repayRow.textContent).toContain('⇄');
    expect(repayRow.textContent).toContain('A 還 B');
    expect(repayRow.textContent).toContain('HKD $200');

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

  it('EN render of ChartsView (including settle section, daily bar date label, categories, and Shared person) contains no CJK labels except user data', async () => {
    await i18n.changeLanguage('en');
    const trip = createTwoPersonTrip({
      settings: {
        people: ['共同', 'Oscar', 'Ming'],
        rate: 0.05,
        budget: 5000,
      },
      expenses: [
        {
          id: 'e1',
          date: '2026-10-22',
          store: 'Sushi Dinner',
          place: 'Ginza',
          category: '飲食',
          assignedTo: '共同',
          payer: 'Ming',
          payment: 'card',
          currency: 'HKD',
          originalAmount: 600,
          hkdAmount: 600,
          items: [],
        },
      ],
    });

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-22',
          settlementActions: { add: vi.fn(), update: vi.fn(), remove: vi.fn() },
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );

    const chartsPage = screen.getByTestId('page-charts');
    expect(chartsPage.textContent).toContain('10/22 Thu');
    expect(chartsPage.textContent).toContain('Food & drink');
    expect(chartsPage.textContent).toContain('Shared');
    expect(chartsPage.textContent).toContain('Settle up');
    expect(chartsPage.textContent).toContain('Oscar paid HK$0 · owes HK$300');
    expect(chartsPage.textContent).toContain('Oscar owes Ming HK$300');
    expect(chartsPage.textContent).toContain('Mark repaid');
    expect(chartsPage.textContent).toContain('Shared costs split evenly by Oscar, Ming');
    expect(chartsPage.textContent).not.toMatch(/[\u3400-\u9fff]/);

    // Open settle sheet in EN and verify no CJK characters either
    fireEvent.click(screen.getByTestId('chart-person-Oscar'));
    const sheet = screen.getByTestId('settle-sheet');
    expect(sheet.textContent).toContain("Oscar's split");
    expect(sheet.textContent).toContain('Record repayment');
    expect(sheet.textContent).not.toMatch(/[\u3400-\u9fff]/);
  });

  it('zh-TW notebook.settle.*, notebook.charts.*, notebook.ledger.*, and notebook.addForm.* values contain no Cantonese particles/words', () => {
    const settleValues = Object.entries(zhTW.notebook?.settle || {});
    const chartsValues = Object.entries(zhTW.notebook?.charts || {});
    const ledgerValues = Object.entries(zhTW.notebook?.ledger || {});
    const addFormValues = Object.entries(zhTW.notebook?.addForm || {});
    expect(settleValues.length).toBeGreaterThan(0);
    expect(chartsValues.length).toBeGreaterThan(0);
    expect(ledgerValues.length).toBeGreaterThan(0);
    expect(addFormValues.length).toBeGreaterThan(0);

    const cantoneseTokens = ['嘅', '俾', '咗', '睇', '邊個', '仲', '啲', '冇', '係', '喺', '未有', '影相', '揀相', '要還', '使咗', '可以使', '夾錢', '夾平'];
    for (const [key, val] of [...settleValues, ...chartsValues, ...ledgerValues, ...addFormValues]) {
      for (const token of cantoneseTokens) {
        expect(String(val), `key ${key} contains forbidden Cantonese token "${token}"`).not.toContain(
          token,
        );
      }
    }
  });

  it('settle-mark-repaid and repayment tap targets have min-h-11 and min-w-11 (≥44px)', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = createTwoPersonTrip();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-22',
          settlementActions: { add: vi.fn(), update: vi.fn(), remove: vi.fn() },
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );

    const markBtn = screen.getByTestId('settle-mark-repaid');
    expect(markBtn.className).toContain('min-h-11');
    expect(markBtn.className).toContain('min-w-11');

    fireEvent.click(screen.getByTestId('chart-person-A'));
    const sheet = screen.getByTestId('settle-sheet');
    expect(within(sheet).getByTestId('repayment-save').className).toContain('min-h-11');
    expect(within(sheet).getByTestId('repayment-save').className).toContain('min-w-11');
    expect(within(sheet).getByTestId('repayment-amount').className).toContain('min-h-11');
  });

  it('A7d: uses trip.accountingCurrency (e.g. TWD) in settlement toast, RepaymentForm preview/overpay warning, and Ledger repayment row', async () => {
    await i18n.changeLanguage('zh-TW');
    const twdTrip = createTwoPersonTrip({
      accountingCurrency: 'TWD',
      tripCurrency: 'JPY',
      settings: {
        people: ['共同', 'A', 'B'],
        rate: 0.2,
        budget: 20000,
      },
      expenses: [
        {
          id: 'e-twd',
          date: '2026-10-21',
          store: '拉麵晚餐',
          place: '新宿',
          category: '飲食',
          assignedTo: '共同',
          payer: 'B',
          payment: 'card',
          currency: 'TWD',
          originalAmount: 1000,
          hkdAmount: 1000,
          items: [],
        },
      ],
      settlements: [
        {
          id: 'stl-twd-1',
          tripId: 'trip-repay-test',
          from: 'A',
          to: 'B',
          amount: 200,
          currency: 'TWD',
          hkdAmount: 200,
          rate: 1,
          date: '2026-10-21',
          note: '部分還款',
        },
      ],
    });

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip: twdTrip,
          today: '2026-10-22',
          initialHash: '#ledger',
        }),
      ),
    );

    // 1. Ledger repayment row uses TWD $200
    const repayRow = screen.getByTestId('ledger-repayment-row');
    expect(repayRow.textContent).toContain('TWD $200');
    expect(repayRow.textContent).not.toContain('HK$');

    // 2. Open add repayment sheet -> test foreign currency preview (≈ TWD $...) and overpay warning (TWD $300)
    fireEvent.click(screen.getByTestId('ledger-add-repayment'));
    const sheet = screen.getByTestId('ledger-repayment-sheet');
    fireEvent.change(within(sheet).getByTestId('repayment-from'), { target: { value: 'A' } });
    fireEvent.change(within(sheet).getByTestId('repayment-to'), { target: { value: 'B' } });
    fireEvent.change(within(sheet).getByTestId('repayment-currency'), { target: { value: 'JPY' } });
    fireEvent.change(within(sheet).getByTestId('repayment-amount'), { target: { value: '2000' } });

    expect(sheet.textContent).toContain('≈ TWD $400');
    const warning = within(sheet).getByTestId('repayment-overpay-warning');
    expect(warning.textContent).toContain('超出尚欠 TWD $300，方向將會反轉');

    // 3. Save repayment -> toast uses TWD $400
    fireEvent.click(within(sheet).getByTestId('repayment-save'));
    const toast = screen.getByTestId('toast');
    expect(toast.textContent).toContain('已記錄 A 還 B TWD $400');
  });
});
