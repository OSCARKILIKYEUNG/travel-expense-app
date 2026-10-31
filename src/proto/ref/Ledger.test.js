// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import ChartsView from './ChartsView';
import DayView from './DayView';
import { CategorySticker, DOODLES, Doodle } from './doodles';
import Ledger from './Ledger';
import { StickerGraphic } from './parts';

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

  it('shows a removable payer chip in zh-TW and en and clears payer on tap', async () => {
    const trip = {
      name: '夾錢',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: null },
      expenses: expensesA,
    };

    await i18n.changeLanguage('zh-TW');
    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Ledger, {
          trip,
          initialFilters: { payer: 'A' },
          onScan: () => {},
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
          onOpenDay: () => {},
        }),
      ),
    );

    const payerChip = screen.getByTestId('ledger-payer-chip');
    expect(payerChip.textContent).toContain('邊個俾錢：A ✕');
    expect(payerChip.getAttribute('aria-label')).toBe('清除邊個俾錢篩選');

    fireEvent.click(payerChip);
    expect(screen.queryByTestId('ledger-payer-chip')).toBeNull();
    expect(screen.getByRole('button', { name: '全部 (5)' }).getAttribute('aria-pressed')).toBe('true');
    expect(amountText()).toBe('HK$750');
    unmount();

    await i18n.changeLanguage('en');
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(Ledger, {
          trip,
          initialFilters: { payer: 'B' },
          onScan: () => {},
          onAdd: () => {},
          onEdit: () => {},
          onDelete: () => {},
          onOpenDay: () => {},
        }),
      ),
    );

    const enChip = screen.getByTestId('ledger-payer-chip');
    expect(enChip.textContent).toContain('Paid by: B ✕');
    expect(enChip.getAttribute('aria-label')).toBe('Clear paid-by filter');
    await i18n.changeLanguage('zh-TW');
  });
});

describe('ChartsView settlement breakdown sheet', () => {
  it('opens settle-sheet on tapping a person row, displays paid/owed/net breakdown, and routes to ledger on 查看帳本', async () => {
    await i18n.changeLanguage('zh-TW');
    const onOpenLedger = vi.fn();
    const trip = {
      name: '夾錢測試',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: null },
      expenses: expensesA,
    };

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger,
        }),
      ),
    );

    expect(screen.queryByTestId('settle-sheet')).toBeNull();
    fireEvent.click(screen.getByTestId('chart-person-A'));
    expect(onOpenLedger).not.toHaveBeenCalled();

    const sheet = screen.getByTestId('settle-sheet');
    expect(sheet.getAttribute('role')).toBe('dialog');
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.textContent).toContain('A 的分帳明細');
    expect(sheet.textContent).toContain('A 已支付');
    expect(sheet.textContent).toContain('HK$450');
    expect(sheet.textContent).toContain('未填付款人 → 計入A');
    expect(sheet.textContent).toContain('應付');
    expect(sheet.textContent).toContain('HK$310');
    expect(sheet.textContent).toContain('自己 HK$100');
    expect(sheet.textContent).toContain('共同 HK$300 ÷ 2');
    expect(sheet.textContent).toContain('淨額');
    expect(sheet.textContent).toContain('+HK$140');

    const ledgerBtn = screen.getByTestId('settle-sheet-ledger');
    expect(ledgerBtn.textContent).toContain('查看帳本');
    fireEvent.click(ledgerBtn);

    expect(screen.queryByTestId('settle-sheet')).toBeNull();
    expect(onOpenLedger).toHaveBeenCalledTimes(1);
    expect(onOpenLedger).toHaveBeenCalledWith({ payer: 'A' });
  });
});

describe('Batch 1 diary-style doodles, category stickers, and empty states', () => {
  it('renders all 14 inline SVG doodles with aria-hidden="true" and focusable="false"', () => {
    const required = [
      'camera',
      'sushi',
      'torii',
      'fuji',
      'pagoda',
      'sakura',
      'plane',
      'suitcase',
      'lantern',
      'ramen',
      'train',
      'shoppingBag',
      'sparkle',
      'sunburst',
    ];
    for (const key of required) {
      expect(typeof DOODLES[key]).toBe('function');
      const { container, unmount } = render(
        createElement(Doodle, { name: key, size: 'md', blob: 'teal' }),
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      unmount();
    }
  });

  it('maps StickerGraphic ids and stored emojis to SVG doodles while preserving unknown custom glyphs', () => {
    const { container: c1, unmount: u1 } = render(createElement(StickerGraphic, { id: 'fuji' }));
    expect(c1.querySelector('svg')).toBeTruthy();
    u1();

    const { container: c2, unmount: u2 } = render(createElement(StickerGraphic, { id: '🗻' }));
    expect(c2.querySelector('svg')).toBeTruthy();
    u2();

    const { container: c3, unmount: u3 } = render(createElement(StickerGraphic, { id: '🐼' }));
    expect(c3.querySelector('svg')).toBeNull();
    expect(c3.textContent).toBe('🐼');
    u3();
  });

  it('renders CategorySticker SVG for the 6 categories and falls back to colour dot for custom categories', () => {
    for (const cat of ['飲食', '交通', '購物', '住宿', '娛樂', '其他']) {
      const { container, unmount } = render(createElement(CategorySticker, { category: cat }));
      expect(container.querySelector('svg')).toBeTruthy();
      unmount();
    }
    const { container: custom } = render(
      createElement(CategorySticker, { category: '手信自訂', dotClassName: 'h-2 w-2 bg-ink-muted' }),
    );
    expect(custom.querySelector('svg')).toBeNull();
    expect(custom.querySelector('span.rounded-full')).toBeTruthy();
  });

  it('renders illustrated empty states in Ledger, DayView, and ChartsView in zh-TW and en', async () => {
    await i18n.changeLanguage('zh-TW');
    const emptyTrip = {
      name: '空白之旅',
      startDate: '2026-10-18',
      endDate: '2026-10-20',
      settings: { people: ['共同', 'Oscar'], budget: null },
      days: {
        '2026-10-18': { title: '第一天', note: '', sticker: null, journal: '', itinerary: [] },
      },
      expenses: [],
    };

    const { unmount: uLedger } = renderLedger(emptyTrip);
    expect(screen.getByTestId('ledger-empty-state').textContent).toContain('手帳還是空白的一頁');
    uLedger();

    const { unmount: uDay } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(DayView, {
          trip: emptyTrip,
          iso: '2026-10-18',
          pane: 'itinerary',
          editing: false,
          onPane: () => {},
          onEditToggle: () => {},
          onBack: () => {},
          onDay: () => {},
          onUpdateDay: () => {},
          onScan: () => {},
          onAdd: () => {},
          onEditExpense: () => {},
          onDeleteExpense: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('day-itinerary-empty').textContent).toContain('這天尚未安排行程');
    expect(screen.getByTestId('day-expenses-empty').textContent).toContain('這天還沒有消費記錄');
    uDay();

    const { unmount: uCharts } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: emptyTrip,
          today: '2026-10-01',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('charts-daily-empty').textContent).toContain('旅程未開始，尚無每日花費趨勢。');
    uCharts();
  });
});


