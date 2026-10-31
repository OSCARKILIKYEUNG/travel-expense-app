// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
