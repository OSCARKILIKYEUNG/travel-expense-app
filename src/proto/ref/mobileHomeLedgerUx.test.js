// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n.js';
import { deriveTodayTodos } from '../../journal/todayTodos.js';
import Home from './Home.jsx';
import Ledger from './Ledger.jsx';
import { createRefTrip, REF_TODAY } from './mockRefTrip.js';

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

function installMatchMedia(mobile) {
  window.matchMedia = (query) => ({
    matches: query === MOBILE_QUERY ? mobile : false,
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

/** Shared listener list so a test can fire the hook's real `change` subscription. */
function installMatchMediaController(initialMobile) {
  let mobile = initialMobile;
  const listeners = new Set();
  window.matchMedia = (query) => ({
    get matches() {
      return query === MOBILE_QUERY ? mobile : false;
    },
    media: query,
    onchange: null,
    addEventListener(type, listener) {
      if (type === 'change') listeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === 'change') listeners.delete(listener);
    },
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
    dispatchEvent() {
      return false;
    },
  });
  return {
    setMobile(next) {
      mobile = next;
    },
    emitChange() {
      for (const listener of [...listeners]) listener();
    },
  };
}

function pos(html, id) {
  const index = html.indexOf(`data-testid="${id}"`);
  expect(index, id).toBeGreaterThan(-1);
  return index;
}

function homeProps(overrides = {}) {
  return {
    trip: createRefTrip(),
    today: REF_TODAY,
    month: '2026-10',
    setMonth: () => {},
    selectedDay: null,
    onOpenDay: () => {},
    onScan: () => {},
    onAdd: () => {},
    ...overrides,
  };
}

const ledgerTrip = {
  name: '夾錢',
  startDate: '2026-10-01',
  endDate: '2026-10-03',
  settings: { people: ['共同', 'A', 'B'], budget: 5000 },
  expenses: [
    {
      id: 1,
      hkdAmount: 300,
      assignedTo: '共同',
      payer: 'A',
      store: '拉麵店',
      category: '飲食',
      currency: 'HKD',
      date: '2026-10-01',
    },
    {
      id: 2,
      hkdAmount: 100,
      assignedTo: 'A',
      payer: 'B',
      store: '電車',
      category: '交通',
      currency: 'HKD',
      date: '2026-10-02',
    },
  ],
};

function renderLedger(props = {}) {
  return render(
    createElement(Ledger, {
      trip: ledgerTrip,
      onScan: () => {},
      onAdd: () => {},
      onEdit: () => {},
      onDelete: () => {},
      onOpenDay: () => {},
      ...props,
    }),
  );
}

describe('mobile Home hierarchy', () => {
  it('places 今日待辦 before scan/add and the calendar while desktop grid pins stay', () => {
    const html = renderToStaticMarkup(createElement(Home, homeProps()));
    const summary = pos(html, 'summary');
    const todayRow = pos(html, 'today-row');
    const todos = pos(html, 'today-todos');
    const scan = pos(html, 'home-scan');
    const add = pos(html, 'home-add');
    const calendar = pos(html, 'calendar');
    const nextDays = pos(html, 'next-days');
    expect(summary).toBeLessThan(todayRow);
    expect(todayRow).toBeLessThan(todos);
    expect(todos).toBeLessThan(scan);
    expect(scan).toBeLessThan(add);
    expect(add).toBeLessThan(calendar);
    expect(calendar).toBeLessThan(nextDays);

    const root = html.match(/<div\b[^>]*data-testid="home"[^>]*>/);
    expect(root[0]).toContain('lg:grid');
    expect(root[0]).toContain('lg:grid-cols-12');

    const summaryTag = html.match(/<div\b[^>]*data-testid="summary"[^>]*>/);
    expect(summaryTag[0]).toContain('lg:col-start-1');
    expect(summaryTag[0]).toContain('lg:row-start-1');
    expect(html).toContain('lg:col-start-6 lg:row-start-2');
    expect(html).toContain('lg:col-start-1 lg:row-start-2');

    const todosTag = html.match(/<section\b[^>]*data-testid="today-todos"[^>]*>/);
    expect(todosTag[0]).toContain('lg:col-span-5');
    expect(todosTag[0]).toContain('lg:col-start-1');
    expect(todosTag[0]).toContain('lg:row-start-3');

    const calendarTag = html.match(/<div\b[^>]*data-testid="calendar"[^>]*>/);
    expect(calendarTag[0]).toContain('lg:col-span-7');
    expect(calendarTag[0]).toContain('lg:col-start-6');
    expect(calendarTag[0]).toContain('lg:row-start-1');
    expect(html).toContain('lg:col-span-7 lg:col-start-6 lg:row-start-3');
    expect(html).toContain('data-testid="japan-mini-map"');
  });

  it('keeps calendar selection and month changes on the same callbacks', () => {
    const onOpenDay = vi.fn();
    const setMonth = vi.fn();
    render(
      createElement(
        Home,
        homeProps({
          selectedDay: REF_TODAY,
          onOpenDay,
          setMonth,
        }),
      ),
    );

    const selected = screen.getByTestId(`day-cell-${REF_TODAY}`);
    expect(selected.getAttribute('data-selected')).toBe('true');
    expect(selected.getAttribute('aria-current')).toBe('date');
    expect(screen.getByTestId('day-cell-2026-10-23').hasAttribute('data-selected')).toBe(false);

    fireEvent.click(screen.getByTestId('day-cell-2026-10-23'));
    expect(onOpenDay).toHaveBeenCalledTimes(1);
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-23');

    fireEvent.click(screen.getByRole('button', { name: '上個月' }));
    expect(setMonth).toHaveBeenCalledWith('2026-09');
    fireEvent.click(screen.getByTestId('home-scan'));
    fireEvent.click(screen.getByTestId('home-add'));
    fireEvent.click(screen.getByTestId('today-row'));
    expect(onOpenDay).toHaveBeenCalledWith(REF_TODAY);
  });

  it('toggles today checklist in memory only', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const trip = createRefTrip();
    const [first] = deriveTodayTodos(trip, REF_TODAY);
    expect(first?.id).toBeTruthy();

    const { unmount } = render(createElement(Home, homeProps({ trip })));
    const box = screen.getByTestId(`today-todo-${first.id}`);
    expect(box.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(box);
    expect(screen.getByTestId(`today-todo-${first.id}`).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId(`today-todo-${first.id}`));
    expect(screen.getByTestId(`today-todo-${first.id}`).getAttribute('aria-checked')).toBe('false');
    expect(setItem).not.toHaveBeenCalled();
    unmount();

    render(createElement(Home, homeProps({ trip })));
    expect(screen.getByTestId(`today-todo-${first.id}`).getAttribute('aria-checked')).toBe('false');
    setItem.mockRestore();
  });
});

describe('mobile Ledger search and filters', () => {
  it('starts collapsed, keeps values and the list pipeline, and clears while closed', async () => {
    installMatchMedia(true);
    renderLedger();

    const toggle = screen.getByTestId('ledger-tools-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('type')).toBe('button');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('ledger-optional-tools');
    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    const panel = screen.getByTestId('ledger-optional-tools', { hidden: true });
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(screen.getByTestId('ledger-search', { hidden: true }).closest('[hidden]')).toBe(panel);
    expect(screen.getByTestId('ledger-group-2026-10-01')).toBeTruthy();
    expect(screen.getByTestId('ledger-group-2026-10-02')).toBeTruthy();
    expect(screen.getByTestId('ledger-scan')).toBeTruthy();
    expect(screen.getByTestId('ledger-add')).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
    const search = screen.getByRole('textbox', { name: '搜尋' });
    expect(document.activeElement).toBe(search);

    fireEvent.change(search, { target: { value: '電車' } });
    fireEvent.click(screen.getByTestId('ledger-filter-btn'));
    expect(screen.getByTestId('ledger-filter-sheet')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('ledger-filter-sheet')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('textbox', { name: '搜尋' }).value).toBe('電車');

    fireEvent.click(screen.getByTestId('ledger-filter-btn'));
    fireEvent.click(screen.getByTestId('filter-cat-交通'));
    fireEvent.click(screen.getByTestId('filter-sheet-done'));
    expect(screen.getByTestId('ledger-tools-count').textContent).toBe('2');
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('電車');
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();
    expect(screen.getByTestId('ledger-group-2026-10-02').textContent).toContain('電車');
    expect(screen.getByTestId('ledger-tools-status').textContent).toContain('已篩選 2 項');
    expect(screen.getByTestId('ledger-tools-count').textContent).toBe('2');
    await waitFor(() => {
      expect(document.activeElement).toBe(toggle);
    });

    fireEvent.click(toggle);
    expect(screen.getByRole('textbox', { name: '搜尋' }).value).toBe('電車');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('電車');
    await waitFor(() => {
      expect(document.activeElement).toBe(toggle);
    });

    fireEvent.click(screen.getByTestId('ledger-tools-clear'));
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();
    expect(screen.queryByTestId('ledger-tools-count')).toBeNull();
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('');
    expect(screen.getByTestId('ledger-group-2026-10-01').textContent).toContain('拉麵店');
    expect(screen.getByTestId('ledger-group-2026-10-02').textContent).toContain('電車');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows the filtered empty state while tools stay collapsed, then restores the list', () => {
    installMatchMedia(true);
    renderLedger();
    fireEvent.click(screen.getByTestId('ledger-tools-toggle'));
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋' }), {
      target: { value: '沒有這店' },
    });
    fireEvent.click(screen.getByTestId('ledger-tools-toggle'));

    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    expect(screen.getByTestId('ledger-empty-state').textContent).toContain('找不到符合條件的消費記錄');
    expect(screen.getByTestId('ledger-clear-empty')).toBeTruthy();
    expect(screen.getByTestId('ledger-tools-status').textContent).toContain('已篩選 1 項');

    fireEvent.click(screen.getByTestId('ledger-tools-clear'));
    expect(screen.queryByTestId('ledger-empty-state')).toBeNull();
    expect(screen.getByTestId('ledger-group-2026-10-01')).toBeTruthy();
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('');
  });

  it('shows an active payer that arrived closed, and clear resets the total', () => {
    installMatchMedia(true);
    renderLedger({ initialFilters: { payer: 'A' } });
    expect(screen.getByTestId('ledger-tools-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    expect(screen.getByTestId('ledger-tools-count').textContent).toBe('1');
    expect(screen.getByTestId('ledger-tools-status').textContent).toContain('已篩選 1 項');
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $300');
    expect(screen.queryByText('電車')).toBeNull();

    fireEvent.click(screen.getByTestId('ledger-tools-clear'));
    expect(screen.getByTestId('ledger-total-amount').textContent).toBe('HKD $400');
    expect(screen.getByText('電車')).toBeTruthy();
    expect(screen.getByText('拉麵店')).toBeTruthy();
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();
  });

  it('keeps desktop search visible inside the sticky rail and does not render the toggle', () => {
    installMatchMedia(false);
    renderLedger();
    expect(screen.queryByTestId('ledger-tools-toggle')).toBeNull();
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();
    expect(screen.getByRole('textbox', { name: '搜尋' })).toBeTruthy();
    const panel = screen.getByTestId('ledger-optional-tools');
    expect(panel.hasAttribute('hidden')).toBe(false);
    const ledgerEl = screen.getByTestId('ledger');
    const rail = ledgerEl.querySelector('aside');
    expect(rail.className).toContain('lg:sticky');
    expect(rail.className).toContain('lg:top-20');
    expect(rail.className).toContain('lg:col-span-5');
    expect(rail.className).toContain('lg:col-start-1');
    expect(rail.className).toContain('lg:row-start-1');
    const listCol = screen.getByTestId('ledger-group-2026-10-02').parentElement;
    expect(listCol.className).toContain('lg:col-span-7');
    expect(listCol.className).toContain('lg:col-start-6');
    expect(listCol.className).toContain('lg:row-start-1');
    expect(rail.querySelector('[data-testid="ledger-search"]')).toBeTruthy();
    expect(rail.querySelector('[data-testid="ledger-filter-btn"]')).toBeTruthy();
  });

  it('returns focus to the disclosure toggle when the collapsed clear button goes away', async () => {
    installMatchMedia(true);
    renderLedger();
    fireEvent.click(screen.getByTestId('ledger-tools-toggle'));
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋' }), {
      target: { value: '電車' },
    });
    fireEvent.click(screen.getByTestId('ledger-tools-toggle'));

    const clear = screen.getByTestId('ledger-tools-clear');
    clear.focus();
    expect(document.activeElement).toBe(clear);
    expect(screen.getByTestId('ledger-tools-count').textContent).toBe('1');
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();

    fireEvent.click(clear);

    const toggle = screen.getByTestId('ledger-tools-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();
    expect(screen.queryByTestId('ledger-tools-count')).toBeNull();
    expect(screen.queryByTestId('ledger-tools-clear')).toBeNull();
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('');
    expect(screen.getByTestId('ledger-group-2026-10-01').textContent).toContain('拉麵店');
    expect(screen.getByTestId('ledger-group-2026-10-02').textContent).toContain('電車');
    await waitFor(() => {
      expect(document.activeElement).toBe(toggle);
    });
    const panel = screen.getByTestId('ledger-optional-tools', { hidden: true });
    expect(panel.hasAttribute('hidden')).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it('follows the matchMedia change listener across mobile and desktop without resetting filters', async () => {
    const media = installMatchMediaController(true);
    renderLedger();

    const toggle = screen.getByTestId('ledger-tools-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋' }), {
      target: { value: '電車' },
    });
    fireEvent.click(screen.getByTestId('ledger-tools-toggle'));
    expect(screen.getByTestId('ledger-tools-status').textContent).toContain('已篩選 1 項');
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('ledger-tools-toggle'));
    });

    media.setMobile(false);
    expect(screen.getByTestId('ledger-tools-toggle').getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      media.emitChange();
    });

    expect(screen.queryByTestId('ledger-tools-toggle')).toBeNull();
    expect(screen.queryByTestId('ledger-tools-status')).toBeNull();
    const search = screen.getByRole('textbox', { name: '搜尋' });
    expect(search.value).toBe('電車');
    const panel = screen.getByTestId('ledger-optional-tools');
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();
    expect(screen.getByTestId('ledger-group-2026-10-02').textContent).toContain('電車');
    const rail = screen.getByTestId('ledger').querySelector('aside');
    expect(rail.className).toContain('lg:sticky');
    expect(rail.className).toContain('lg:top-20');
    expect(rail.className).toContain('lg:col-start-1');
    const listCol = screen.getByTestId('ledger-group-2026-10-02').parentElement;
    expect(listCol.className).toContain('lg:col-start-6');

    search.focus();
    expect(document.activeElement).toBe(search);

    media.setMobile(true);
    await act(async () => {
      media.emitChange();
    });

    const collapsedToggle = screen.getByTestId('ledger-tools-toggle');
    expect(collapsedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(collapsedToggle);
    expect(screen.getByTestId('ledger-search', { hidden: true }).value).toBe('電車');
    expect(screen.getByTestId('ledger-tools-count').textContent).toBe('1');
    expect(screen.getByTestId('ledger-tools-status').textContent).toContain('已篩選 1 項');
    expect(screen.queryByRole('textbox', { name: '搜尋' })).toBeNull();
    const hiddenPanel = screen.getByTestId('ledger-optional-tools', { hidden: true });
    expect(hiddenPanel.hasAttribute('hidden')).toBe(true);
    expect(hiddenPanel.contains(document.activeElement)).toBe(false);
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();

    fireEvent.click(collapsedToggle);
    expect(screen.getByRole('textbox', { name: '搜尋' }).value).toBe('電車');
    expect(screen.getByTestId('ledger-tools-toggle').getAttribute('aria-expanded')).toBe('true');

    media.setMobile(false);
    await act(async () => {
      media.emitChange();
    });
    expect(screen.queryByTestId('ledger-tools-toggle')).toBeNull();
    expect(screen.getByRole('textbox', { name: '搜尋' }).value).toBe('電車');
    expect(screen.getByTestId('ledger-optional-tools').hasAttribute('hidden')).toBe(false);

    media.setMobile(true);
    await act(async () => {
      media.emitChange();
    });
    expect(screen.getByTestId('ledger-tools-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('textbox', { name: '搜尋' }).value).toBe('電車');
    expect(screen.getByTestId('ledger-optional-tools').hasAttribute('hidden')).toBe(false);
    expect(screen.queryByTestId('ledger-group-2026-10-01')).toBeNull();
    expect(screen.getByTestId('ledger-group-2026-10-02').textContent).toContain('電車');
  });
});
