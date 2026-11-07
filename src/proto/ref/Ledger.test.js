// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import AddForm from './AddForm';
import ChartsView from './ChartsView';
import DayView from './DayView';
import { CategorySticker, DOODLES, Doodle } from './doodles';
import Ledger from './Ledger';
import { StickerGraphic, TAPE_TORN_CLIP, Tape } from './parts';

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
  return screen.getByTestId('ledger-total-amount').textContent;
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
    expect(amountText()).toBe('HKD $450');

    fireEvent.click(screen.getByRole('button', { name: 'B (1)' }));
    expect(screen.getByRole('button', { name: '全部 (3)' }).getAttribute('aria-pressed')).toBe('false');
    expect(amountText()).toBe('HKD $30');

    fireEvent.click(screen.getByRole('button', { name: '全部 (3)' }));
    expect(screen.getByRole('button', { name: '全部 (5)' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'B (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A (1)' })).toBeTruthy();
    expect(amountText()).toBe('HKD $750');
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
    expect(amountText()).toBe('HKD $900');
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
    expect(payerChip.textContent).toContain('付款人：A ✕');
    expect(payerChip.getAttribute('aria-label')).toBe('清除付款人篩選');

    fireEvent.click(payerChip);
    expect(screen.queryByTestId('ledger-payer-chip')).toBeNull();
    expect(screen.getByRole('button', { name: '全部 (5)' }).getAttribute('aria-pressed')).toBe('true');
    expect(amountText()).toBe('HKD $750');
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
    expect(sheet.textContent).toContain('HKD $450');
    expect(sheet.textContent).toContain('未填付款人 → 計入A');
    expect(sheet.textContent).toContain('應付');
    expect(sheet.textContent).toContain('HKD $310');
    expect(sheet.textContent).toContain('自己 HKD $100');
    expect(sheet.textContent).toContain('共同 HKD $300 ÷ 2');
    expect(sheet.textContent).toContain('淨額');
    expect(sheet.textContent).toContain('+HKD $140');

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

    const { unmount: uChartsEmpty } = render(
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
    expect(screen.getByTestId('charts-empty').textContent).toContain('還未有消費記錄');
    uChartsEmpty();

    const preTripWithExpense = {
      ...emptyTrip,
      expenses: [
        {
          id: 'pre-1',
          date: '2026-10-01',
          store: '早鳥機票',
          category: '交通',
          assignedTo: '共同',
          payer: 'Oscar',
          payment: 'card',
          currency: 'HKD',
          originalAmount: 2400,
          hkdAmount: 2400,
        },
      ],
    };
    const { unmount: uCharts } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: preTripWithExpense,
          today: '2026-10-01',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('charts-daily-empty').textContent).toContain('旅程未開始，尚無每日花費趨勢。');
    uCharts();
  });

  it('Batch 2: renders torn-edge Tape (including dots tone), notched date tabs, and full zh-TW 書面語 / EN i18n in AddForm and Ledger', async () => {
    const { container: tapeContainer, unmount: uTape } = render(
      createElement(Tape, { tone: 'dots', className: 'h-4 w-20' }),
    );
    const tapeSpan = tapeContainer.querySelector('span[data-tape-tone="dots"]');
    expect(tapeSpan).toBeTruthy();
    expect(tapeSpan.style.clipPath).toBe(TAPE_TORN_CLIP);
    uTape();

    await i18n.changeLanguage('zh-TW');
    const onSave = vi.fn();
    const { unmount: uFormZh } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar', '阿明'],
          onCancel: () => {},
          onSave,
        }),
      ),
    );
    const formZh = screen.getByTestId('expense-form');
    expect(formZh.textContent).toContain('付款人');
    expect(formZh.textContent).toContain('拍照或選擇照片，金額與店舖會自動填入');
    expect(formZh.textContent).toContain('設為無日期');
    expect(formZh.textContent).not.toContain('邊個俾錢');
    expect(formZh.textContent).not.toContain('影相或揀相');
    expect(formZh.textContent).not.toContain('未有日期');

    // Category sticker pills in AddForm are the sole category picker (radiogroup + radio + aria-checked + roving tabindex)
    expect(document.getElementById('ref-cat')).toBeNull();
    const catGroup = screen.getByTestId('form-category-pills');
    expect(catGroup.getAttribute('role')).toBe('radiogroup');
    expect(catGroup.getAttribute('aria-labelledby')).toBe('ref-cat-label');
    const foodPill = screen.getByTestId('form-cat-飲食');
    const shoppingPill = screen.getByTestId('form-cat-購物');
    expect(foodPill.getAttribute('role')).toBe('radio');
    expect(foodPill.getAttribute('aria-checked')).toBe('true');
    expect(foodPill.getAttribute('tabindex')).toBe('0');
    expect(shoppingPill.querySelector('svg')).toBeTruthy();
    expect(shoppingPill.getAttribute('role')).toBe('radio');
    expect(shoppingPill.getAttribute('aria-checked')).toBe('false');
    expect(shoppingPill.getAttribute('tabindex')).toBe('-1');
    fireEvent.click(shoppingPill);
    expect(shoppingPill.getAttribute('aria-checked')).toBe('true');
    expect(shoppingPill.getAttribute('tabindex')).toBe('0');
    expect(foodPill.getAttribute('aria-checked')).toBe('false');
    expect(foodPill.getAttribute('tabindex')).toBe('-1');
    uFormZh();

    // EN AddForm has zero CJK chrome and wrapping scan status
    await i18n.changeLanguage('en');
    const { unmount: uFormEn } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar', 'Ming'],
          onCancel: () => {},
          onSave: () => {},
        }),
      ),
    );
    const formEn = screen.getByTestId('expense-form');
    const scanStatus = screen.getByTestId('form-scan-status');
    expect(scanStatus.className).not.toContain('whitespace-nowrap');
    expect(scanStatus.className).toContain('break-words');
    expect(formEn.textContent).toContain('Paid by');
    expect(formEn.textContent).toContain('Take or choose a photo — amount and shop fill in automatically');
    expect(formEn.textContent).toContain('Set as no date');
    expect(formEn.textContent).toContain('Oct 22 Thu');
    expect(formEn.textContent).toContain('Food & drink');
    expect(formEn.textContent).toContain('Shared');
    expect(formEn.textContent).not.toMatch(/[\u3400-\u9fff]/);
    uFormEn();

    // Ledger notched date tabs in zh-TW and EN
    await i18n.changeLanguage('zh-TW');
    const ledgerTrip = {
      name: 'Trip',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: null },
      expenses: [
        ...expensesA,
        { id: 99, hkdAmount: 120, assignedTo: '共同', payer: 'A', store: 'Undated shop', category: '購物', currency: 'HKD', date: '' },
      ],
    };
    const { container: ledgerContainer, unmount: uLedger2 } = renderLedger(ledgerTrip);
    expect(ledgerContainer.querySelectorAll('[data-notched-tab="date"]').length).toBeGreaterThan(0);
    expect(ledgerContainer.querySelector('[data-notched-tab="undated"]').textContent).toBe('無日期');
    expect(screen.getByTestId('ledger-undated-hint').textContent).toContain('1 筆無日期');
    expect(screen.getByTestId('ledger-undated-hint').textContent).toContain('補日期');
    expect(screen.getByTestId('ledger-undated-hint').className).toContain('form-error-row');
    uLedger2();
  });

  it('AddForm category pill click and keyboard navigation update saved category and prefill from scanDraft/initial', async () => {
    await i18n.changeLanguage('zh-TW');
    const onSave = vi.fn();
    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar'],
          onCancel: () => {},
          onSave,
        }),
      ),
    );

    const transportPill = screen.getByTestId('form-cat-交通');
    const shoppingPill = screen.getByTestId('form-cat-購物');
    fireEvent.click(transportPill);
    expect(transportPill.getAttribute('aria-checked')).toBe('true');

    // Keyboard ArrowRight moves from 交通 (index 1) to 購物 (index 2)
    fireEvent.keyDown(transportPill, { key: 'ArrowRight' });
    expect(shoppingPill.getAttribute('aria-checked')).toBe('true');
    expect(transportPill.getAttribute('aria-checked')).toBe('false');

    fireEvent.change(screen.getByTestId('form-amount'), { target: { value: '2500' } });
    fireEvent.change(document.getElementById('ref-store'), { target: { value: 'Tokyu Hands' } });
    fireEvent.click(screen.getByTestId('form-save'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].category).toBe('購物');
    unmount();

    // Scan prefill selects scanned category pill
    const { unmount: uScan } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar'],
          scanDraft: {
            originalAmount: 4200,
            currency: 'JPY',
            store: 'JR East',
            category: '交通',
            date: '2026-10-22',
          },
          onCancel: () => {},
          onSave: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('form-cat-交通').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('form-cat-飲食').getAttribute('aria-checked')).toBe('false');
    uScan();
  });

  it('DayView renders localized chrome in zh-TW and EN (zero CJK chrome in EN while preserving 全部/共同 filter logic)', async () => {
    const enSeedTrip = {
      name: 'Tokyo Trip',
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      settings: { people: ['共同', 'Oscar', 'Alex'], budget: 15000 },
      days: {
        '2026-10-20': {
          title: 'Ginza Walk',
          note: 'Ginza',
          sticker: 'shopping',
          journal: 'Sunny afternoon.',
          itinerary: [{ id: 's1', time: '11:00', title: 'Itoya Stationery', done: false }],
        },
      },
      expenses: [
        {
          id: 'e1',
          date: '2026-10-20',
          store: 'Itoya',
          place: 'Ginza',
          category: '購物',
          assignedTo: '共同',
          payer: 'Oscar',
          payment: 'card',
          currency: 'JPY',
          originalAmount: 6820,
          hkdAmount: 359,
          scanned: true,
        },
        {
          id: 'e2',
          date: '2026-10-20',
          store: 'Cafe',
          place: 'Ginza',
          category: '飲食',
          assignedTo: 'Oscar',
          payer: 'Oscar',
          payment: 'cash',
          currency: 'JPY',
          originalAmount: 1000,
          hkdAmount: 53,
          scanned: false,
        },
      ],
    };

    await i18n.changeLanguage('en');
    const { unmount: uReadEn } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(DayView, {
          trip: enSeedTrip,
          iso: '2026-10-20',
          pane: 'expenses',
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

    const dayViewEl = screen.getByTestId('day-view');
    expect(dayViewEl.textContent).toContain('← Calendar');
    expect(dayViewEl.textContent).toContain('Oct 20 Tue');
    expect(dayViewEl.textContent).toContain('Day 3');
    expect(dayViewEl.textContent).toContain('Oct 20');
    expect(dayViewEl.textContent).toContain('Itinerary 1');
    expect(dayViewEl.textContent).toContain('Day spending 2');
    expect(dayViewEl.textContent).toContain('Day total');
    expect(dayViewEl.textContent).toContain('2 items');
    expect(dayViewEl.textContent).toContain('Scanned 1 · Manual 1');
    expect(dayViewEl.textContent).toContain('All (2)');
    expect(dayViewEl.textContent).toContain('Shared (1)');
    expect(dayViewEl.textContent).not.toMatch(/[\u3400-\u9fff]/);

    // Clicking Shared (1) filters using internal '共同' key
    fireEvent.click(screen.getByRole('button', { name: 'Shared (1)' }));
    expect(screen.getByTestId('expense-e1')).toBeTruthy();
    expect(screen.queryByTestId('expense-e2')).toBeNull();
    uReadEn();

    // Edit mode in EN also has zero CJK chrome
    const { unmount: uEditEn } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(DayView, {
          trip: enSeedTrip,
          iso: '2026-10-20',
          pane: 'itinerary',
          editing: true,
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
    const editorEl = screen.getByTestId('itinerary-editor');
    expect(editorEl.textContent).toContain('Day title');
    expect(editorEl.textContent).toContain('Done');
    expect(editorEl.textContent).toContain('Sticker');
    expect(editorEl.textContent).toContain('Calendar tag');
    expect(editorEl.textContent).toContain('+ Add');
    expect(editorEl.textContent).not.toMatch(/[\u3400-\u9fff]/);
    uEditEn();

    await i18n.changeLanguage('zh-TW');
  });

  it('D2 desktop two-column layouts at lg: Ledger sticky right rail, Charts 2-column grid, and DayView side-by-side panes', async () => {
    await i18n.changeLanguage('zh-TW');
    const trip = {
      name: '夾錢',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: 5000 },
      days: {
        '2026-10-01': {
          title: 'Day 1',
          note: 'Tokyo',
          sticker: null,
          journal: 'Note',
          itinerary: [{ id: 's1', time: '09:00', title: 'Stop 1', done: false }],
        },
      },
      expenses: expensesA,
    };

    const { unmount: uLedger } = renderLedger(trip);
    const ledgerEl = screen.getByTestId('ledger');
    expect(ledgerEl.className).toContain('lg:max-w-6xl');
    const rail = ledgerEl.querySelector('aside');
    expect(rail).toBeTruthy();
    expect(rail.className).toContain('lg:sticky');
    expect(rail.className).toContain('lg:top-20');
    expect(rail.querySelector('[data-testid="ledger-total-card"]')).toBeTruthy();
    expect(rail.querySelector('[data-testid="ledger-search"]')).toBeTruthy();
    expect(rail.querySelector('[data-testid="ledger-filter-btn"]')).toBeTruthy();
    expect(rail.querySelector('[data-testid="ledger-add-repayment"]')).toBeTruthy();
    uLedger();

    const { unmount: uCharts } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    const chartsEl = screen.getByTestId('page-charts');
    const chartsGrid = chartsEl.querySelector('.lg\\:grid-cols-2');
    expect(chartsGrid).toBeTruthy();
    const todayCard = chartsEl.querySelector('[data-section="today"]');
    expect(todayCard.className).toContain('lg:col-span-2');
    uCharts();

    const { unmount: uDay } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(DayView, {
          trip,
          iso: '2026-10-01',
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
    const dayEl = screen.getByTestId('day-view');
    expect(dayEl.className).toContain('lg:max-w-6xl');
    expect(screen.getByTestId('tab-itinerary')).toBeTruthy();
    expect(screen.getByTestId('tab-expenses')).toBeTruthy();
    const paneItin = screen.getByTestId('pane-itinerary');
    const paneExp = screen.getByTestId('pane-expenses');
    expect(paneItin).toBeTruthy();
    expect(paneExp).toBeTruthy();
    expect(paneItin.parentElement.className).toContain('lg:grid-cols-2');
    uDay();
  });

  it('A6: LedgerTotalCard shows count beside total, remaining = budget - spent, no-budget omits budget block and ADMIT ONE, and zh Ledger has no TOTAL/Ledger/ADMIT', async () => {
    await i18n.changeLanguage('zh-TW');
    const budgetTrip = {
      name: '東京 · 大阪 秋日之旅',
      startDate: '2026-10-18',
      endDate: '2026-10-27',
      settings: { people: ['共同', 'Oscar', '阿明'], budget: 15000 },
      expenses: [
        {
          id: 'e1',
          date: '2026-10-22',
          store: '一蘭拉麵 澀谷店',
          place: '澀谷',
          category: '飲食',
          assignedTo: 'Oscar',
          payer: 'Oscar',
          payment: 'cash',
          scanned: true,
          currency: 'JPY',
          originalAmount: 103110,
          hkdAmount: 5397,
        },
      ],
    };

    const { unmount: uBudget } = renderLedger(budgetTrip);
    const ledgerEl = screen.getByTestId('ledger');
    const totalCard = screen.getByTestId('ledger-total-card');
    const totalAmount = screen.getByTestId('ledger-total-amount');
    const totalSub = screen.getByTestId('ledger-total-sub');

    expect(totalCard.textContent).toContain('旅費總計');
    expect(totalAmount.textContent).toBe('HKD $5,397');
    expect(totalCard.getAttribute('aria-label')).toContain('HKD $5,397');
    // Count only beside total (no JPY summary line)
    expect(totalSub.textContent).toBe('1 筆');
    expect(totalSub.textContent).not.toContain('103,110');
    expect(totalAmount.parentElement).toBe(totalSub.parentElement);

    // Filtered state shows 篩選總計 + 已篩選 stamp
    fireEvent.click(screen.getByRole('button', { name: 'Oscar (1)' }));
    expect(totalCard.textContent).toContain('篩選總計');
    expect(screen.getByTestId('ledger-total-stamp').textContent).toBe('已篩選');

    // Repayment sheet shows title once (h2 only, h4 hidden inside RepaymentForm, preview kept)
    fireEvent.click(screen.getByTestId('ledger-add-repayment'));
    const repaySheet = screen.getByTestId('ledger-repayment-sheet');
    expect(repaySheet.querySelectorAll('h2')).toHaveLength(1);
    expect(repaySheet.querySelector('h4')).toBeNull();
    fireEvent.change(screen.getByTestId('repayment-currency'), { target: { value: 'JPY' } });
    fireEvent.change(screen.getByTestId('repayment-amount'), { target: { value: '1000' } });
    expect(repaySheet.textContent).toContain('≈ HKD $');
    fireEvent.click(screen.getByTestId('repayment-cancel'));
    fireEvent.click(screen.getByRole('button', { name: '全部 (1)' }));

    // Budget progress & remaining = budget - spent (15000 - 5397 = 9603)
    const budgetBlock = screen.getByTestId('ledger-budget');
    expect(budgetBlock.querySelector('svg line[stroke-dasharray="0 6"]')).toBeTruthy();
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 36%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $9,603');
    expect(totalCard.textContent).not.toContain('HK$5,397 / HK$15,000');

    // No English words TOTAL / Ledger / ADMIT on zh Ledger page
    expect(ledgerEl.textContent).not.toContain('TOTAL');
    expect(ledgerEl.textContent).not.toContain('Ledger');
    expect(ledgerEl.textContent).not.toContain('ADMIT');
    uBudget();

    // Over-budget case shows text-stamp and over amount
    const overTrip = {
      ...budgetTrip,
      settings: { ...budgetTrip.settings, budget: 4000 },
    };
    const { unmount: uOver } = renderLedger(overTrip);
    const overPct = screen.getByTestId('ledger-budget-pct');
    expect(overPct.textContent).toBe('已用 135% · 超支 HKD $1,397');
    expect(overPct.className).toContain('text-stamp');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $0');
    uOver();

    // No-budget case shows no budget block and no ADMIT ONE
    const noBudgetTrip = {
      ...budgetTrip,
      settings: { ...budgetTrip.settings, budget: null },
    };
    const { unmount: uNoBudget } = renderLedger(noBudgetTrip);
    expect(screen.queryByTestId('ledger-budget')).toBeNull();
    expect(screen.queryByTestId('ledger-budget-remaining')).toBeNull();
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('ADMIT ONE');
    expect(screen.getByTestId('ledger').textContent).not.toContain('ADMIT');
    uNoBudget();

    // EN strings check
    await i18n.changeLanguage('en');
    const { unmount: uEn } = renderLedger(budgetTrip);
    expect(screen.getByTestId('ledger-total-card').textContent).toContain('Total spent');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('1 items');
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('Used 36%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('HKD $9,603 left');
    fireEvent.click(screen.getByRole('button', { name: 'Oscar (1)' }));
    expect(screen.getByTestId('ledger-total-card').textContent).toContain('Filtered total');
    expect(screen.getByTestId('ledger-total-stamp').textContent).toBe('FILTERED');
    uEn();
    await i18n.changeLanguage('zh-TW');
  });

  it('A6 round 3: renders sticky rail before the expense list in DOM order with lg:col-start-1 on rail and lg:col-start-6 on list', () => {
    const trip = {
      name: '夾錢',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'A', 'B'], budget: 5000 },
      expenses: expensesA,
    };
    const { unmount } = renderLedger(trip);
    const ledgerEl = screen.getByTestId('ledger');
    const rail = ledgerEl.querySelector('aside');
    const firstGroup = screen.getByTestId('ledger-group-2026-10-03');
    const listCol = firstGroup.parentElement;

    expect(rail).toBeTruthy();
    expect(listCol).toBeTruthy();
    expect(rail.className).toContain('lg:col-span-5');
    expect(rail.className).toContain('lg:col-start-1');
    expect(rail.className).toContain('lg:row-start-1');
    expect(rail.className).toContain('lg:sticky');
    expect(rail.className).toContain('lg:top-20');
    expect(listCol.className).toContain('lg:col-span-7');
    expect(listCol.className).toContain('lg:col-start-6');
    expect(listCol.className).toContain('lg:row-start-1');
    expect(
      Boolean(rail.compareDocumentPosition(listCol) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    unmount();
  });

  it('A7d: ExpenseCard allows 2-line title below lg, keeps badge row flex-nowrap with shrink-0, and ChipRow scrolls horizontally on one line', () => {
    const trip = {
      name: '富士之旅',
      startDate: '2026-10-20',
      endDate: '2026-10-25',
      settings: { people: ['共同', 'Oscar', '阿明', 'May', 'Ken'], budget: 5000 },
      expenses: [
        {
          id: 'e-long',
          date: '2026-10-22',
          store: 'ほうとう不動 東恋路店',
          place: '河口湖',
          category: '飲食',
          assignedTo: '共同',
          payer: 'Oscar',
          payment: 'cash',
          scanned: true,
          currency: 'JPY',
          originalAmount: 4860,
          hkdAmount: 256,
        },
      ],
    };

    const { unmount } = renderLedger(trip);
    const card = screen.getByTestId('expense-e-long');
    const titleH3 = card.querySelector('h3');
    expect(titleH3).toBeTruthy();
    expect(titleH3.textContent).toBe('ほうとう不動 東恋路店');
    expect(titleH3.className).toContain('line-clamp-2');
    expect(titleH3.className).toContain('break-words');
    expect(titleH3.className.split(/\s+/)).not.toContain('whitespace-nowrap');

    // Badge row is flex-nowrap overflow-hidden and each badge is shrink-0
    const badgeRow = card.querySelector('.expense-tags') || titleH3.previousElementSibling;
    expect(badgeRow).toBeTruthy();
    expect(badgeRow.className).toContain('flex-nowrap');
    expect(badgeRow.className).toContain('overflow-hidden');
    for (const badge of badgeRow.children) {
      expect(badge.className).toContain('shrink-0');
    }

    // ChipRow is a single horizontal segmented scroll row with shrink-0 chips
    const chipRow = screen.getByRole('group', { name: '篩選人物' });
    expect(chipRow.className).toContain('seg-control');
    expect(chipRow.className).toContain('flex-nowrap');
    expect(chipRow.className).toContain('overflow-x-auto');
    for (const chip of chipRow.querySelectorAll('button')) {
      expect(chip.className).toContain('seg-item');
      expect(chip.className).toContain('shrink-0');
    }
    unmount();
  });

  it('A8: renders honest empty state (charts-empty) with zero expenses and no zeroed charts, and hides charts-empty when expenses exist', async () => {
    await i18n.changeLanguage('zh-TW');
    const zeroExpenseTrip = {
      name: '空白旅途',
      startDate: '2026-10-18',
      endDate: '2026-10-22',
      settings: { people: ['共同', 'Oscar', '阿明'], budget: null },
      expenses: [],
    };

    const { unmount: uZeroZh } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: zeroExpenseTrip,
          today: '2026-10-20',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    const emptyEl = screen.getByTestId('charts-empty');
    expect(emptyEl.textContent).toContain('還未有消費記錄');
    expect(emptyEl.textContent).toContain('記一筆或掃描收據後，這裡會出現圖表');
    expect(screen.queryByTestId('chart-pay-cash')).toBeNull();
    expect(screen.queryByTestId('chart-pay-card')).toBeNull();
    expect(screen.queryByRole('img', { name: '類別花費分佈圓環圖' })).toBeNull();
    expect(screen.getByTestId('page-charts').textContent).not.toContain('已全部結清 ✓');
    uZeroZh();

    await i18n.changeLanguage('en');
    const { unmount: uZeroEn } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: zeroExpenseTrip,
          today: '2026-10-20',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    expect(screen.getByTestId('charts-empty').textContent).toContain('No expenses yet');
    expect(screen.getByTestId('charts-empty').textContent).toContain('Add or scan a receipt to see charts');
    expect(screen.queryByTestId('chart-pay-cash')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Spending by category donut chart' })).toBeNull();
    uZeroEn();

    await i18n.changeLanguage('zh-TW');
    const withExpensesTrip = {
      ...zeroExpenseTrip,
      expenses: expensesA,
    };
    const { unmount: uWithExp } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: withExpensesTrip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    expect(screen.queryByTestId('charts-empty')).toBeNull();
    expect(screen.getByTestId('chart-pay-cash')).toBeTruthy();
    expect(screen.getByRole('img', { name: '類別花費分佈圓環圖' })).toBeTruthy();
    uWithExp();
  });

  it('A8: formats Charts page amounts using trip accountingCurrency (e.g. TWD $) with no HK$ and hides Latin Charts eyebrow in zh-TW', async () => {
    await i18n.changeLanguage('zh-TW');
    const twdTrip = {
      name: '台北小旅行',
      accountingCurrency: 'TWD',
      tripCurrency: 'JPY',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'Oscar', '阿明'], budget: 10000 },
      expenses: [
        {
          id: 't1',
          date: '2026-10-02',
          store: '鼎泰豐',
          category: '飲食',
          assignedTo: '共同',
          payer: 'Oscar',
          payment: 'card',
          currency: 'TWD',
          originalAmount: 1200,
          hkdAmount: 1200,
        },
        {
          id: 't2',
          date: '2026-10-02',
          store: '夜市小吃',
          category: '飲食',
          assignedTo: '阿明',
          payer: '阿明',
          payment: 'cash',
          currency: 'TWD',
          originalAmount: 300,
          hkdAmount: 300,
        },
      ],
    };

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip: twdTrip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );

    const chartsEl = screen.getByTestId('page-charts');
    expect(i18n.t('notebook.charts.titleScript')).toBe('');
    expect(chartsEl.textContent).toContain('統計圖表');
    expect(chartsEl.textContent).toContain('今日概覽');
    expect(chartsEl.textContent).not.toContain('Charts');
    expect(chartsEl.textContent).not.toContain('CHARTS');
    expect(chartsEl.textContent).toContain('TWD $1,500');
    expect(chartsEl.textContent).toContain('TWD $1,200');
    expect(chartsEl.textContent).toContain('TWD $300');
    expect(chartsEl.textContent).toContain('TWD $10,000');
    expect(chartsEl.textContent).not.toContain('HK$');
    expect(chartsEl.textContent).not.toContain('HKD $');
    unmount();
  });

  it('A8 round 3: renders 「今日概覽」/"Today" summary label, singular "1 item" in en for a 1-expense category, and places assignee at bottom of left column on lg', async () => {
    const trip = {
      name: 'Round 3 Trip',
      accountingCurrency: 'HKD',
      tripCurrency: 'JPY',
      startDate: '2026-10-01',
      endDate: '2026-10-03',
      settings: { people: ['共同', 'Oscar', 'Ming'], budget: 5000 },
      expenses: [
        {
          id: 'e-stay-1',
          date: '2026-10-02',
          store: 'Ryokan Inn',
          category: '住宿',
          assignedTo: '共同',
          payer: 'Oscar',
          payment: 'card',
          currency: 'HKD',
          originalAmount: 800,
          hkdAmount: 800,
        },
        {
          id: 'e-food-1',
          date: '2026-10-02',
          store: 'Ramen Shop',
          category: '飲食',
          assignedTo: 'Oscar',
          payer: 'Oscar',
          payment: 'cash',
          currency: 'HKD',
          originalAmount: 100,
          hkdAmount: 100,
        },
        {
          id: 'e-food-2',
          date: '2026-10-02',
          store: 'Matcha Cafe',
          category: '飲食',
          assignedTo: 'Ming',
          payer: 'Ming',
          payment: 'cash',
          currency: 'HKD',
          originalAmount: 80,
          hkdAmount: 80,
        },
      ],
    };

    await i18n.changeLanguage('zh-TW');
    const { unmount: uZh } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    const pageZh = screen.getByTestId('page-charts');
    const todaySecZh = pageZh.querySelector('[data-section="today"]');
    expect(todaySecZh.textContent).toContain('今日概覽');
    expect(todaySecZh.textContent).toContain('今日已花費');
    expect(screen.getByTestId('chart-cat-住宿').textContent).toContain('住宿 · 1 筆');
    expect(screen.getByTestId('chart-cat-飲食').textContent).toContain('飲食 · 2 筆');

    const assigneeSec = pageZh.querySelector('[data-section="assignee"]');
    const paymentSec = pageZh.querySelector('[data-section="payment"]');
    expect(assigneeSec.parentElement.className).toContain('lg:col-start-1');
    expect(assigneeSec.className).toContain('lg:order-4');
    expect(paymentSec.parentElement.className).toContain('lg:col-start-2');
    uZh();

    await i18n.changeLanguage('en');
    const { unmount: uEn } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ChartsView, {
          trip,
          today: '2026-10-02',
          onOpenDay: () => {},
          onOpenLedger: () => {},
        }),
      ),
    );
    const pageEn = screen.getByTestId('page-charts');
    const todaySecEn = pageEn.querySelector('[data-section="today"]');
    expect(todaySecEn.textContent).toContain('Today');
    expect(todaySecEn.textContent).toContain('Spent today');
    expect(screen.getByTestId('chart-cat-住宿').textContent).toContain('Stay · 1 item');
    expect(screen.getByTestId('chart-cat-住宿').textContent).not.toContain('1 items');
    expect(screen.getByTestId('chart-cat-飲食').textContent).toContain('Food & drink · 2 items');
    uEn();

    await i18n.changeLanguage('zh-TW');
  });

  it('AddForm save bar stays in form flow (never fixed over fields) and preserves form-save-bar, form-cancel, and form-save', async () => {
    await i18n.changeLanguage('zh-TW');
    const onCancel = vi.fn();
    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(AddForm, {
          defaultDate: '2026-10-22',
          people: ['共同', 'Oscar'],
          onCancel,
          onSave: () => {},
        }),
      ),
    );

    const form = screen.getByTestId('expense-form');
    const saveBar = screen.getByTestId('form-save-bar');
    const cancelBtn = screen.getByTestId('form-cancel');
    const saveBtn = screen.getByTestId('form-save');

    expect(form.contains(saveBar)).toBe(true);
    expect(saveBar.className).not.toContain('fixed');
    expect(saveBar.className).not.toContain('sticky');
    expect(cancelBtn.className).toContain('jr-btn-paper');
    expect(saveBtn.className).toContain('jr-btn-navy');
    expect(saveBtn.disabled).toBe(true);

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
  });
});


