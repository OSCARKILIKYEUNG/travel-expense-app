// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import NotebookApp from './NotebookApp';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('NotebookApp currentWindowHash fallback', () => {
  it('opens initialHash view in controlled mode when window.location.hash is empty', () => {
    window.location.hash = '';
    const trip = createRefTrip();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '#charts',
        }),
      ),
    );

    expect(screen.getByTestId('page-charts')).toBeTruthy();
    expect(screen.queryByTestId('ledger')).toBeNull();
  });

  it('prefers non-empty window.location.hash over initialHash in controlled mode', () => {
    window.location.hash = '#ledger';
    const trip = createRefTrip();

    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '#charts',
        }),
      ),
    );

    expect(screen.getByTestId('ledger')).toBeTruthy();
    expect(screen.queryByTestId('page-charts')).toBeNull();
  });
});

describe('NotebookApp D3 desktop navigation at lg', () => {
  it('renders localized nav landmarks, aria-current="page", distinct testids, display:none breakpoint classes, and header → nav → main tab order', async () => {
    window.location.hash = '';
    const trip = createRefTrip();

    await i18n.changeLanguage('zh-TW');
    const { container, unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
        }),
      ),
    );

    const desktopNav = screen.getByTestId('desktop-nav');
    const mobileNav = screen.getByTestId('nav');
    const main = container.querySelector('main');
    const tripSwitcher = screen.getByTestId('trip-switcher');

    expect(desktopNav.tagName).toBe('NAV');
    expect(mobileNav.tagName).toBe('NAV');
    expect(desktopNav.getAttribute('aria-label')).toBe('主要導覽');
    expect(mobileNav.getAttribute('aria-label')).toBe('主要導覽');

    // Mutual exclusivity via display:none classes across lg (1024px)
    expect(desktopNav.className).toContain('hidden');
    expect(desktopNav.className).toContain('lg:flex');
    expect(mobileNav.className).toContain('lg:hidden');
    expect(main.className).toContain('pb-24');
    expect(main.className).toContain('lg:pb-10');

    // Logical DOM / tab order: header controls (trip-switcher) → desktop-nav → main
    expect(
      Boolean(tripSwitcher.compareDocumentPosition(desktopNav) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    expect(
      Boolean(desktopNav.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);

    // Distinct testids and 44px minimum height (min-h-11) on all 4 items
    const expectedZh = [
      ['home', '日曆', 'page'],
      ['ledger', '帳本', null],
      ['charts', '圖表', null],
      ['settings', '設定', null],
    ];
    for (const [key, label, current] of expectedZh) {
      const desktopBtn = screen.getByTestId(`desktop-nav-${key}`);
      const mobileBtn = screen.getByTestId(`nav-${key}`);
      expect(desktopBtn).not.toBe(mobileBtn);
      expect(desktopBtn.textContent).toBe(label);
      expect(mobileBtn.textContent).toBe(label);
      expect(desktopBtn.getAttribute('aria-current')).toBe(current);
      expect(mobileBtn.getAttribute('aria-current')).toBe(current);
      expect(desktopBtn.className).toContain('min-h-11');
      expect(desktopBtn.className).toContain('focus-visible:ring-2');
      expect(desktopBtn.className).toContain('focus-visible:ring-teal');
    }

    // Clicking desktop nav items routes and updates aria-current="page"
    fireEvent.click(screen.getByTestId('desktop-nav-ledger'));
    expect(screen.getByTestId('ledger')).toBeTruthy();
    expect(screen.getByTestId('desktop-nav-ledger').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('desktop-nav-home').getAttribute('aria-current')).toBeNull();

    fireEvent.click(screen.getByTestId('desktop-nav-charts'));
    expect(screen.getByTestId('page-charts')).toBeTruthy();
    expect(screen.getByTestId('desktop-nav-charts').getAttribute('aria-current')).toBe('page');

    fireEvent.click(screen.getByTestId('desktop-nav-settings'));
    expect(screen.getByTestId('page-settings')).toBeTruthy();
    expect(screen.getByTestId('desktop-nav-settings').getAttribute('aria-current')).toBe('page');

    unmount();

    // Verify English labels and landmark aria-label
    window.location.hash = '';
    await i18n.changeLanguage('en');
    render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
        }),
      ),
    );
    expect(screen.getByTestId('desktop-nav').getAttribute('aria-label')).toBe('Main navigation');
    expect(screen.getByTestId('desktop-nav-home').textContent).toBe('Calendar');
    expect(screen.getByTestId('desktop-nav-ledger').textContent).toBe('Ledger');
    expect(screen.getByTestId('desktop-nav-charts').textContent).toBe('Charts');
    expect(screen.getByTestId('desktop-nav-settings').textContent).toBe('Settings');

    await i18n.changeLanguage('zh-TW');
  });
});

