// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n.js';
import Ledger from './Ledger.jsx';
import { REF_TODAY } from './mockRefTrip.js';
import { ledgerTotalSummary } from './refLedgerTotal.js';
import { fmtHKD, fmtJPY } from './refLogic.js';

const MOBILE_QUERY = '(max-width: 1023px)';
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else delete window.matchMedia;
});

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

function installMobileTools() {
  window.matchMedia = (query) => ({
    matches: query === MOBILE_QUERY,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
}

function expense(partial) {
  return {
    id: partial.id,
    date: partial.date || '2026-10-22',
    store: partial.store || '店',
    category: partial.category || '飲食',
    assignedTo: partial.assignedTo || '共同',
    payer: partial.payer || 'Oscar',
    currency: partial.currency,
    originalCurrency: partial.originalCurrency || partial.currency,
    originalAmount: partial.originalAmount,
    hkdAmount: partial.hkdAmount,
    items: partial.items || [],
  };
}

function tripWith(expenses, extra = {}) {
  return {
    id: 'trip-original-total',
    name: '東京秋日之旅',
    startDate: '2026-10-18',
    endDate: '2026-10-27',
    tripCurrency: 'JPY',
    accountingCurrency: 'HKD',
    settings: { people: ['共同', 'Oscar', '阿明'], budget: 15000 },
    days: {},
    expenses,
    ...extra,
  };
}

function renderLedger(trip, initialFilters, exchangeRates) {
  return render(
    createElement(Ledger, {
      trip,
      today: REF_TODAY,
      initialFilters,
      exchangeRates,
      onScan: () => {},
      onAdd: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onOpenDay: () => {},
    }),
  );
}

function recordedJpy(expenses) {
  return expenses.reduce((sum, item) => {
    const code = String(item.originalCurrency || item.currency || '').toUpperCase();
    return code === 'JPY' ? sum + (Number(item.originalAmount) || 0) : sum;
  }, 0);
}

describe('ledger original-currency total', () => {
  it('shows the JPY amount on first paint while mobile tools stay closed, without changing the accounting total, count, or budget', () => {
    installMobileTools();
    const trip = tripWith([
      expense({
        id: 'jpy-1',
        currency: 'JPY',
        originalAmount: 213352,
        hkdAmount: 11222,
      }),
    ]);
    const summary = ledgerTotalSummary({
      shown: trip.expenses,
      all: trip.expenses,
      budget: trip.settings.budget,
      filtered: false,
      person: '全部',
      people: trip.settings.people,
    });
    expect(summary.hkd).toBe(11222);
    expect(summary.count).toBe(1);
    expect(summary.jpy).toBe(213352);
    expect(summary.budget.pct).toBe(75);
    expect(summary.budget.spent).toBe(11222);

    renderLedger(trip);

    const toggle = screen.getByTestId('ledger-tools-toggle');
    const tools = screen.getByTestId('ledger-optional-tools', { hidden: true });
    const card = screen.getByTestId('ledger-total-card');
    const amount = screen.getByTestId('ledger-total-amount');
    const count = screen.getByTestId('ledger-total-sub');
    const original = screen.getByTestId('ledger-original-total');
    const budget = screen.getByTestId('ledger-budget');

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('ledger-optional-tools');
    expect(tools.hasAttribute('hidden')).toBe(true);
    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    expect(tools.contains(original)).toBe(false);

    expect(amount.textContent).toBe('HKD $11,222');
    expect(amount.textContent).toBe(fmtHKD(summary.hkd));
    expect(count.textContent).toBe('1 筆');
    expect(count.textContent).not.toContain('213,352');
    expect(amount.parentElement).toBe(count.parentElement);
    expect(original.textContent).toContain('原幣');
    expect(original.textContent).toContain('JPY ¥213,352');
    expect(original.textContent).toContain(fmtJPY(summary.jpy));
    expect(original.textContent).not.toContain('HKD');
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 75%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $3,778');
    expect(card.getAttribute('aria-label')).toBe('帳本總額 HKD $11,222，1 筆');
    expect(card.getAttribute('aria-label')).not.toContain('JPY');
    expect(amount.compareDocumentPosition(original) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(original.compareDocumentPosition(budget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('sums recorded JPY originals only and does not convert HKD or KRW onto that line', () => {
    const exchangeRates = { HKD: 1, JPY: 20 };
    const expenses = [
      expense({ id: 'jpy', currency: 'JPY', originalAmount: 2000, hkdAmount: 100 }),
      expense({
        id: 'hkd',
        currency: 'HKD',
        originalAmount: 50,
        hkdAmount: 50,
        category: '交通',
      }),
      expense({
        id: 'krw',
        currency: 'KRW',
        originalAmount: 9000,
        hkdAmount: 40,
        category: '購物',
      }),
    ];
    const trip = tripWith(expenses, { exchangeRates });
    const jpy = recordedJpy(expenses);
    const summary = ledgerTotalSummary({
      shown: expenses,
      all: expenses,
      person: '全部',
      people: trip.settings.people,
      exchangeRates,
    });

    expect(jpy).toBe(2000);
    expect(summary.jpy).toBe(jpy);
    expect(summary.hkd).toBe(190);
    expect(summary.jpy).not.toBe(2000 * exchangeRates.JPY);
    expect(summary.jpy).not.toBe(2000 / exchangeRates.JPY);

    renderLedger(trip, undefined, exchangeRates);
    const original = screen.getByTestId('ledger-original-total').textContent;
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $190');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('3 筆');
    expect(original).toContain('原幣');
    expect(original).toContain('JPY ¥2,000');
    expect(original).toContain(fmtJPY(jpy));
    expect(original).not.toContain('HKD');
    expect(original).not.toContain('KRW');
    expect(original).not.toContain('50');
    expect(original).not.toContain('9,000');
    expect(original).not.toContain('2,050');
    expect(original).not.toContain('11,000');
    expect(original).not.toContain(fmtJPY(2000 * 20));
    expect(original).not.toContain(fmtJPY(2000 / 20));
  });

  it('omits the original line when currencies match, when nothing positive was recorded, and on a non-JPY trip', () => {
    const equalTrip = tripWith(
      [expense({ id: 'same', currency: 'JPY', originalAmount: 8000, hkdAmount: 8000 })],
      { accountingCurrency: 'JPY' },
    );
    renderLedger(equalTrip);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $8,000');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('1 筆');
    expect(screen.queryByTestId('ledger-original-total')).toBeNull();
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('JPY ¥8,000');
    cleanup();

    const missingTrip = tripWith([
      expense({ id: 'missing', currency: 'JPY', hkdAmount: 90 }),
    ]);
    renderLedger(missingTrip);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $90');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('1 筆');
    expect(screen.queryByTestId('ledger-original-total')).toBeNull();
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('JPY');
    expect(ledgerTotalSummary({ shown: missingTrip.expenses, all: missingTrip.expenses }).jpy).toBe(0);
    cleanup();

    const emptyTrip = tripWith([]);
    renderLedger(emptyTrip);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe(fmtHKD(0));
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('0 筆');
    expect(screen.queryByTestId('ledger-original-total')).toBeNull();
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('JPY');
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 0%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $15,000');
    cleanup();

    const zeroTrip = tripWith([
      expense({ id: 'zero', currency: 'JPY', originalAmount: 0, hkdAmount: 40 }),
    ]);
    renderLedger(zeroTrip);
    expect(screen.queryByTestId('ledger-original-total')).toBeNull();
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe(fmtHKD(40));
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('JPY ¥0');
    cleanup();

    const krTrip = tripWith(
      [
        expense({ id: 'kr', currency: 'KRW', originalAmount: 58000, hkdAmount: 336 }),
        expense({ id: 'stray-jpy', currency: 'JPY', originalAmount: 1000, hkdAmount: 50 }),
      ],
      { tripCurrency: 'KRW', accountingCurrency: 'HKD' },
    );
    renderLedger(krTrip);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $386');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('2 筆');
    expect(screen.queryByTestId('ledger-original-total')).toBeNull();
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('KRW');
    expect(screen.getByTestId('ledger-total-card').textContent).not.toContain('JPY ¥1,000');
    expect(ledgerTotalSummary({ shown: krTrip.expenses, all: krTrip.expenses }).jpy).toBe(1000);
  });

  it('follows person shares and category filters from ledgerTotalSummary', () => {
    const exchangeRates = { HKD: 1, JPY: 20 };
    const people = ['共同', 'Oscar', '阿明'];
    const expenses = [
      expense({
        id: 'whole',
        store: 'UNIQLO',
        category: '購物',
        assignedTo: 'Oscar',
        currency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 500,
      }),
      expense({
        id: 'split',
        store: '松本清',
        category: '購物',
        assignedTo: '共同',
        currency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 500,
        items: [
          { name: '感冒藥', price: 6000, assignedTo: 'Oscar' },
          { name: '面膜', price: 4000, assignedTo: '阿明' },
        ],
      }),
      expense({
        id: 'ming',
        store: '一蘭',
        category: '飲食',
        assignedTo: '阿明',
        currency: 'JPY',
        originalAmount: 2000,
        hkdAmount: 100,
      }),
      expense({
        id: 'hkd-food',
        store: '茶餐廳',
        category: '飲食',
        assignedTo: 'Oscar',
        currency: 'HKD',
        originalAmount: 80,
        hkdAmount: 80,
      }),
    ];
    const trip = tripWith(expenses, {
      settings: { people, budget: 2000 },
      exchangeRates,
    });
    const summaryOpts = {
      all: expenses,
      budget: 2000,
      people,
      exchangeRates,
    };
    const allSummary = ledgerTotalSummary({
      ...summaryOpts,
      shown: expenses,
      filtered: false,
      person: '全部',
    });
    expect(allSummary.jpy).toBe(recordedJpy(expenses));
    expect(allSummary.jpy).toBe(22000);
    expect(allSummary.hkd).toBe(1180);
    expect(allSummary.count).toBe(4);
    expect(allSummary.budget.pct).toBe(59);
    expect(allSummary.budget.spent).toBe(1180);

    renderLedger(trip, undefined, exchangeRates);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe(fmtHKD(allSummary.hkd));
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('4 筆');
    expect(screen.getByTestId('ledger-original-total').textContent).toContain(fmtJPY(allSummary.jpy));
    expect(screen.getByTestId('ledger-original-total').textContent).toContain('JPY ¥22,000');
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 59%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $820');
    const unfilteredBudget = screen.getByTestId('ledger-budget-remaining').textContent;

    fireEvent.click(screen.getByRole('button', { name: 'Oscar (3)' }));
    const oscarShown = expenses.filter((item) => ['whole', 'split', 'hkd-food'].includes(item.id));
    const oscarSummary = ledgerTotalSummary({
      ...summaryOpts,
      shown: oscarShown,
      filtered: true,
      person: 'Oscar',
    });
    expect(oscarSummary.hkd).toBe(880);
    expect(oscarSummary.jpy).toBe(16000);
    expect(oscarSummary.count).toBe(3);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $880');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('3 筆');
    expect(screen.getByTestId('ledger-original-total').textContent).toContain('JPY ¥16,000');
    expect(screen.getByTestId('ledger-original-total').textContent).not.toContain('22,000');
    expect(screen.getByTestId('ledger-original-total').textContent).not.toContain('80');
    expect(screen.getByTestId('ledger-total-card').getAttribute('aria-label')).toBe(
      '已篩選總額 HKD $880，3 筆',
    );
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 59%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe(unfilteredBudget);
    cleanup();

    renderLedger(trip, { person: '阿明' }, exchangeRates);
    const mingShown = expenses.filter((item) => ['split', 'ming'].includes(item.id));
    const mingSummary = ledgerTotalSummary({
      ...summaryOpts,
      shown: mingShown,
      filtered: true,
      person: '阿明',
    });
    expect(mingSummary.jpy).toBe(6000);
    expect(mingSummary.hkd).toBe(300);
    expect(mingSummary.count).toBe(2);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe(fmtHKD(mingSummary.hkd));
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('2 筆');
    expect(screen.getByTestId('ledger-original-total').textContent).toContain(fmtJPY(6000));
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $820');
    cleanup();

    renderLedger(trip, { category: '飲食' }, exchangeRates);
    const foodShown = expenses.filter((item) => item.category === '飲食');
    const foodSummary = ledgerTotalSummary({
      ...summaryOpts,
      shown: foodShown,
      filtered: true,
      person: '全部',
    });
    expect(foodSummary.jpy).toBe(2000);
    expect(foodSummary.hkd).toBe(180);
    expect(foodSummary.count).toBe(2);
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $180');
    expect(screen.getByTestId('ledger-total-sub').textContent).toBe('2 筆');
    expect(screen.getByTestId('ledger-original-total').textContent).toContain('JPY ¥2,000');
    expect(screen.getByTestId('ledger-original-total').textContent).not.toContain('22,000');
    expect(screen.getByTestId('ledger-budget-pct').textContent).toBe('已用 59%');
    expect(screen.getByTestId('ledger-budget-remaining').textContent).toBe('剩餘 HKD $820');
  });
});
