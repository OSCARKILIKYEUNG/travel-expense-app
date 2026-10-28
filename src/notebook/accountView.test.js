import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import { derivePlanView } from '../utils/planView';
import NotebookApp from './NotebookApp';
import SettingsView, { applyNotebookSignOut } from './SettingsView';
import { buildAccountView } from './accountView';

describe('buildAccountView', () => {
  it('returns null when there is no user or no user email', () => {
    expect(buildAccountView()).toBeNull();
    expect(buildAccountView({ user: null, planView: { state: 'free' } })).toBeNull();
    expect(buildAccountView({ user: {}, planView: { state: 'pro' } })).toBeNull();
    expect(buildAccountView({ user: { email: '   ' }, planView: { state: 'pro' } })).toBeNull();
  });

  it('maps pro planView to plan="pro" with null scan numbers', () => {
    const planView = derivePlanView({
      phase: 'ready',
      snapshot: {
        plan: 'pro',
        hasUnlimitedScans: true,
        subscriptionStatus: 'active',
        remainingFreeScans: 0,
        freeScanLimit: 5,
      },
    });
    expect(
      buildAccountView({
        user: { email: 'pro@example.com' },
        planView,
      }),
    ).toEqual({
      email: 'pro@example.com',
      plan: 'pro',
      remainingFreeScans: null,
      freeScanLimit: null,
    });
  });

  it('maps free planView with remaining 3 of 5 scans', () => {
    const planView = derivePlanView({
      phase: 'ready',
      snapshot: {
        plan: 'free',
        hasUnlimitedScans: false,
        remainingFreeScans: 3,
        usedReceiptScans: 2,
        freeScanLimit: 5,
      },
    });
    expect(
      buildAccountView({
        user: { email: 'traveler@example.com' },
        planView,
      }),
    ).toEqual({
      email: 'traveler@example.com',
      plan: 'free',
      remainingFreeScans: 3,
      freeScanLimit: 5,
    });
  });

  it('maps free planView with 0 remaining scans', () => {
    const planView = derivePlanView({
      phase: 'ready',
      snapshot: {
        plan: 'free',
        hasUnlimitedScans: false,
        remainingFreeScans: 0,
        usedReceiptScans: 5,
        freeScanLimit: 5,
      },
    });
    expect(
      buildAccountView({
        user: { email: 'zero@example.com' },
        planView,
      }),
    ).toEqual({
      email: 'zero@example.com',
      plan: 'free',
      remainingFreeScans: 0,
      freeScanLimit: 5,
    });
  });

  it('maps loading or missing planView to plan="loading" with null scan numbers', () => {
    const loadingPlanView = derivePlanView({ phase: 'loading', snapshot: null });
    expect(
      buildAccountView({
        user: { email: 'loading@example.com' },
        planView: loadingPlanView,
      }),
    ).toEqual({
      email: 'loading@example.com',
      plan: 'loading',
      remainingFreeScans: null,
      freeScanLimit: null,
    });

    expect(
      buildAccountView({
        user: { email: 'loading@example.com' },
      }),
    ).toEqual({
      email: 'loading@example.com',
      plan: 'loading',
      remainingFreeScans: null,
      freeScanLimit: null,
    });
  });

  it('maps error planView to plan="loading" with null scan numbers', () => {
    const errorPlanView = derivePlanView({
      phase: 'error',
      snapshot: null,
      error: 'network timeout',
    });
    expect(
      buildAccountView({
        user: { email: 'error@example.com' },
        planView: errorPlanView,
      }),
    ).toEqual({
      email: 'error@example.com',
      plan: 'loading',
      remainingFreeScans: null,
      freeScanLimit: null,
    });
  });
});

describe('SettingsView Account card & applyNotebookSignOut', () => {
  const trip = createRefTrip();

  it('omits the account card when no account prop is passed (prototype mode)', async () => {
    await i18n.changeLanguage('zh-TW');
    const html = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          initialHash: '#settings',
          uiLanguage: 'zh-TW',
        }),
      ),
    );
    expect(html).not.toContain('data-testid="account-card"');
    expect(html).toContain('data-testid="language-select"');
  });

  it('renders Account card before Language card for Free (3/5 and 0/5), Pro, and Loading in zh-TW and en', async () => {
    await i18n.changeLanguage('zh-TW');
    const freeAccount = buildAccountView({
      user: { email: 'very.long.email.address@example.com' },
      planView: { state: 'free', remainingFreeScans: 3, freeScanLimit: 5 },
    });

    const zhFreeHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          initialHash: '#settings',
          uiLanguage: 'zh-TW',
          account: freeAccount,
        }),
      ),
    );

    const accountIdx = zhFreeHtml.indexOf('data-testid="account-card"');
    const langIdx = zhFreeHtml.indexOf('data-testid="language-select"');
    expect(accountIdx).toBeGreaterThan(-1);
    expect(accountIdx).toBeLessThan(langIdx);
    expect(zhFreeHtml).toContain('帳戶');
    expect(zhFreeHtml).toContain('登入電郵');
    expect(zhFreeHtml).toContain('data-testid="account-email"');
    expect(zhFreeHtml).toContain('break-all');
    expect(zhFreeHtml).toContain('very.long.email.address@example.com');
    expect(zhFreeHtml).toContain('data-testid="account-plan"');
    expect(zhFreeHtml).toContain('免費');
    expect(zhFreeHtml).toContain('data-testid="account-scans"');
    expect(zhFreeHtml).toContain('尚餘 3 / 5 次免費 AI 掃描');
    expect(zhFreeHtml).toContain('data-testid="account-signout"');
    expect(zhFreeHtml).toContain('登出');

    const zeroFreeHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          uiLanguage: 'zh-TW',
          account: buildAccountView({
            user: { email: 'zero@example.com' },
            planView: { state: 'free', remainingFreeScans: 0, freeScanLimit: 5 },
          }),
        }),
      ),
    );
    expect(zeroFreeHtml).toContain('尚餘 0 / 5 次免費 AI 掃描');
    expect(zeroFreeHtml).toContain('text-coral-ink');

    await i18n.changeLanguage('en');
    const enProHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          uiLanguage: 'en',
          account: buildAccountView({
            user: { email: 'pro@example.com' },
            planView: { state: 'pro' },
          }),
        }),
      ),
    );
    expect(enProHtml).toContain('Account');
    expect(enProHtml).toContain('Signed in as');
    expect(enProHtml).toContain('bg-teal-strong');
    expect(enProHtml).toContain('Pro');
    expect(enProHtml).not.toContain('data-testid="account-scans"');
    expect(enProHtml).toContain('Sign out');

    const enLoadingHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          today: '2026-10-28',
          uiLanguage: 'en',
          account: buildAccountView({
            user: { email: 'wait@example.com' },
            planView: { state: 'loading' },
          }),
          initialSigningOut: true,
        }),
      ),
    );
    expect(enLoadingHtml).toContain('Loading…');
    expect(enLoadingHtml).not.toContain('data-testid="account-scans"');
    expect(enLoadingHtml).toContain('Signing out…');

    await i18n.changeLanguage('zh-TW');
  });

  it('handles sign-out pending state and error toast on failure', async () => {
    const tZh = i18n.getFixedT('zh-TW');
    const states = [];
    const onToast = vi.fn();

    let resolvePending;
    const onSignOutOk = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    const pendingPromise = applyNotebookSignOut({
      onSignOut: onSignOutOk,
      onToast,
      t: tZh,
      setSigningOut: (v) => states.push(v),
    });
    expect(states).toEqual([true]);
    resolvePending({});
    const okRes = await pendingPromise;
    expect(okRes.ok).toBe(true);
    expect(states).toEqual([true, false]);
    expect(onToast).not.toHaveBeenCalled();

    const failStates = [];
    const onSignOutFail = vi.fn().mockRejectedValue(new Error('network error'));
    const failRes = await applyNotebookSignOut({
      onSignOut: onSignOutFail,
      onToast,
      t: tZh,
      setSigningOut: (v) => failStates.push(v),
    });
    expect(failRes.ok).toBe(false);
    expect(failStates).toEqual([true, false]);
    expect(onToast).toHaveBeenCalledWith('登出失敗，請再試一次');
  });
});
