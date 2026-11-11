// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import AuthDevHarness from '../components/auth/AuthDevHarness';
import MagazineCoverView, {
  CURL_COMMIT_THRESHOLD,
  computeCurlGeometry,
} from '../components/auth/MagazineCoverView';
import {
  LOGIN_COVERS,
  findLoginCover,
} from '../components/auth/loginCovers';
import {
  formatAuthError,
  hasConfirmedSession,
  isSessionExpired,
} from '../lib/authErrors';
import { REDUCED_MOTION_QUERY } from '../motion/tokens';
import Auth, { AUTH_PENDING_TIMEOUT_MS, PAGE_TURN_DURATION_MS } from './Auth';

const mockNavigate = vi.fn();
const routerState = {
  location: { pathname: '/login', state: { from: { pathname: '/charts' } } },
};

const authState = {
  supabaseConfigured: true,
  session: null,
  user: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendSignUpEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPasswordForEmail: vi.fn(),
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => routerState.location,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => authState,
}));

const originalMatchMedia = globalThis.matchMedia;

if (typeof globalThis.PointerEvent === 'undefined') {
  class FakePointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
    }
  }
  globalThis.PointerEvent = FakePointerEvent;
}

function setReducedMotion(matches) {
  globalThis.matchMedia = vi.fn((query) => ({
    matches: query === REDUCED_MOTION_QUERY ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function makeConfirmedSession(overrides = {}) {
  return {
    access_token: 'mock-access-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-123', email: 'reader@example.com' },
    ...overrides,
  };
}

function renderAuth() {
  return render(
    createElement(I18nextProvider, { i18n }, createElement(Auth)),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
  mockNavigate.mockReset();
  routerState.location = { pathname: '/login', state: { from: { pathname: '/charts' } } };
  authState.supabaseConfigured = true;
  authState.session = null;
  authState.user = null;
  authState.loading = false;
  authState.signIn = vi.fn();
  authState.signUp = vi.fn();
  authState.resendSignUpEmail = vi.fn();
  authState.signInWithGoogle = vi.fn();
  authState.resetPasswordForEmail = vi.fn();
  setReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (originalMatchMedia === undefined) {
    delete globalThis.matchMedia;
  } else {
    globalThis.matchMedia = originalMatchMedia;
  }
});

describe('Magazine-cover Auth page (Phase 1)', () => {
  it('renders rotating oil-painting magazine cover, painted place-name typography, exact 4-row reading order (email/password, Google/forgot, full-width register, lower-right paper corner 翻頁登入), and single primary surface', async () => {
    renderAuth();

    const coverImg = screen.getByTestId('auth-cover-image');
    const pickedId = coverImg.getAttribute('data-cover-id');
    expect(['tokyo', 'osaka', 'kyoto', 'kamakura']).toContain(pickedId);
    expect(screen.queryByTestId('auth-cover-headline')).toBeNull();
    expect(screen.queryByTestId('auth-cover-country')).toBeNull();
    expect(screen.getByTestId('auth-cover-sr-heading').textContent).toMatch(
      new RegExp(pickedId, 'i'),
    );
    expect(screen.queryByTestId('auth-placeholder-artwork-badge')).toBeNull();
    expect(screen.queryByTestId('auth-kamakura-scenery')).toBeNull();

    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    expect(emailInput.getAttribute('type')).toBe('email');
    expect(passwordInput.getAttribute('type')).toBe('password');
    expect(screen.queryByLabelText(/username|使用者名稱/i)).toBeNull();

    // Only ONE primary corner surface; no legacy duplicate submit/curl buttons or tabs
    expect(screen.queryByTestId('auth-submit-btn')).toBeNull();
    expect(screen.queryByTestId('auth-page-curl-btn')).toBeNull();
    expect(screen.queryByTestId('auth-tab-signin')).toBeNull();
    expect(screen.queryByTestId('auth-tab-signup')).toBeNull();

    const credentialsRow = screen.getByTestId('auth-credentials-row');
    const actionGrid = screen.getByTestId('auth-action-grid');
    const registerRow = screen.getByTestId('auth-register-row');
    const cornerStrip = screen.getByTestId('auth-corner-strip');
    const googleBtn = screen.getByTestId('auth-google-btn');
    const forgotBtn = screen.getByTestId('auth-forgot-password-link');
    const modeSwitchBtn = screen.getByTestId('auth-mode-switch-btn');
    const primarySurface = screen.getByTestId('auth-primary-surface');
    const loginOverlay = screen.getByTestId('auth-login-overlay');
    const form = screen.getByTestId('auth-credentials-form');

    expect(loginOverlay.contains(emailInput)).toBe(true);
    expect(loginOverlay.contains(passwordInput)).toBe(true);
    expect(loginOverlay.contains(googleBtn)).toBe(true);
    expect(loginOverlay.contains(forgotBtn)).toBe(true);
    expect(loginOverlay.contains(modeSwitchBtn)).toBe(true);
    expect(loginOverlay.contains(primarySurface)).toBe(true);

    // Exact 4-row reading order inside credentials form:
    // Row 1 (email + password) -> Row 2 (Google + forgot) -> Row 3 (full-width REGISTER) -> Row 4 (corner strip with 翻頁登入)
    const formChildren = Array.from(form.children);
    expect(formChildren).toEqual([credentialsRow, actionGrid, registerRow, cornerStrip]);
    expect(credentialsRow.contains(emailInput)).toBe(true);
    expect(credentialsRow.contains(passwordInput)).toBe(true);
    expect(actionGrid.contains(googleBtn)).toBe(true);
    expect(actionGrid.contains(forgotBtn)).toBe(true);
    expect(actionGrid.className).toContain('mc-action-grid--2');
    expect(registerRow.contains(modeSwitchBtn)).toBe(true);
    expect(cornerStrip.contains(primarySurface)).toBe(true);

    expect(screen.getByTestId('auth-magazine-sheet').getAttribute('data-cover-layout')).toBe(
      'full-bleed-single-cover',
    );
    expect(modeSwitchBtn.textContent).toContain('未有帳戶？註冊');
    expect(modeSwitchBtn.getAttribute('data-target-mode')).toBe('signup');
    expect(primarySurface.textContent).toContain('翻頁登入');
    expect(primarySurface.getAttribute('type')).toBe('button');
    expect(primarySurface.getAttribute('aria-label')).toBe('翻頁登入');

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByTestId('auth-cover-image').getAttribute('data-cover-id')).toBe(pickedId);
    expect(screen.getByTestId('auth-mode-switch-btn').textContent).toContain(
      'No account? Sign up',
    );
    expect(screen.getByTestId('auth-primary-surface').textContent).toContain(
      'Turn page to sign in',
    );
    expect(screen.getByTestId('auth-primary-surface').getAttribute('aria-label')).toBe(
      'Turn page to sign in',
    );
  });

  it('shares ONE guarded submit across corner primary surface, keyboard activation, and Enter key, preventing duplicate in-flight submits', async () => {
    let resolveSignIn;
    authState.signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    renderAuth();

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: '  reader@example.com  ' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    const primarySurface = screen.getByTestId('auth-primary-surface');
    // Trigger via corner primary surface, then immediately re-click, press Space, & submit form (Enter) while in-flight
    fireEvent.click(primarySurface);
    fireEvent.click(primarySurface);
    fireEvent.keyDown(primarySurface, { key: ' ' });
    fireEvent.submit(screen.getByTestId('auth-credentials-form'));

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(authState.signIn).toHaveBeenCalledWith('reader@example.com', 'secret123');

    await act(async () => {
      resolveSignIn({
        data: { session: makeConfirmedSession(), user: { id: 'user-123', email: 'reader@example.com' } },
        error: null,
      });
    });

    // While turningPage is active, additional clicks or Enter still cannot re-trigger signIn
    fireEvent.click(primarySurface);
    fireEvent.submit(screen.getByTestId('auth-credentials-form'));
    expect(authState.signIn).toHaveBeenCalledTimes(1);
  });

  it('invokes guarded signIn via corner primary surface and via Enter form submit independently', async () => {
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });
    setReducedMotion(true);

    const { unmount } = renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'curl@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'pass123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(authState.signIn).toHaveBeenCalledWith('curl@example.com', 'pass123');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    unmount();

    // Now test Enter key form submission
    authState.signIn.mockClear();
    mockNavigate.mockClear();
    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'enter@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'pass456' },
    });

    await act(async () => {
      fireEvent.submit(screen.getByTestId('auth-credentials-form'));
    });

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(authState.signIn).toHaveBeenCalledWith('enter@example.com', 'pass456');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('rejects no-error/no-session and expired-session responses: stays on cover, shows errorNoSession, retains email, and never turns or navigates', async () => {
    // 1) { data: { session: null, user: null }, error: null }
    authState.signIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    });

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    fireEvent.change(emailInput, { target: { value: 'nosession@example.com' } });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'password123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-magazine-sheet').className).not.toContain(
      'mc-cover-sheet--turning',
    );
    const alert = screen.getByTestId('auth-error-alert');
    expect(alert.textContent).toContain('尚未建立有效登入狀態');
    expect(screen.getByTestId('auth-email-input').value).toBe('nosession@example.com');

    // 2) Expired session in signInResult is also rejected
    authState.signIn.mockResolvedValueOnce({
      data: {
        session: makeConfirmedSession({ expires_at: Math.floor(Date.now() / 1000) - 120 }),
        user: { id: 'user-123', email: 'nosession@example.com' },
      },
      error: null,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('尚未建立有效登入狀態');
  });

  it('turns the cover on confirmed session success and navigates once via timeout fallback when CSS animationend does not fire', async () => {
    vi.useFakeTimers();
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'correct-horse' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    // Cover is now in turning state; navigation has not happened before timeout/animationend
    expect(screen.getByTestId('auth-magazine-sheet').className).toContain(
      'mc-cover-sheet--turning',
    );
    expect(screen.getByTestId('auth-turning-status').textContent).toContain(
      '正在開啟旅遊手帳',
    );
    expect(mockNavigate).not.toHaveBeenCalled();

    // Advance timer to PAGE_TURN_DURATION_MS (420ms) fallback
    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
  });

  it('completes navigation on animationend and does not double-navigate when fallback timer expires', async () => {
    vi.useFakeTimers();
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'correct-horse' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    const sheet = screen.getByTestId('auth-magazine-sheet');
    expect(sheet.className).toContain('mc-cover-sheet--turning');

    await act(async () => {
      fireEvent.animationEnd(sheet);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS * 2);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('navigates immediately without curl animation delay when prefers-reduced-motion is enabled', async () => {
    vi.useFakeTimers();
    setReducedMotion(true);
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    renderAuth();
    expect(screen.getByTestId('auth-magazine-backdrop').getAttribute('data-reduced-motion')).toBe(
      'true',
    );

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'reduced@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
    expect(screen.getByTestId('auth-magazine-sheet').className).not.toContain(
      'mc-cover-sheet--turning',
    );
  });

  it('handles wrong credentials, offline network errors, and rate-limits by staying on cover, focusing announced alert, retaining email, and hiding raw server messages', async () => {
    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');

    fireEvent.change(emailInput, { target: { value: 'keepme@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } });

    // 1) Wrong credentials (user_not_found vs invalid_credentials produce identical non-enumerating copy)
    authState.signIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { code: 'user_not_found', message: 'User keepme@example.com does not exist in DB' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    const alert1 = screen.getByTestId('auth-error-alert');
    expect(alert1.getAttribute('role')).toBe('alert');
    expect(alert1.textContent).toBe('電子郵件或密碼不正確，請重新輸入後再試。');
    expect(alert1.textContent).not.toContain('does not exist in DB');
    expect(document.activeElement).toBe(alert1);
    expect(screen.getByTestId('auth-email-input').value).toBe('keepme@example.com');
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2) Offline / network failure
    authState.signIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(screen.getByTestId('auth-error-alert').textContent).toBe(
      '目前無法連線至網路，請檢查網路後再試。',
    );
    expect(screen.getByTestId('auth-email-input').value).toBe('keepme@example.com');
    expect(mockNavigate).not.toHaveBeenCalled();

    // 3) Rate limit (429)
    authState.signIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { status: 429, code: 'over_request_rate_limit', message: 'Too many requests' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(screen.getByTestId('auth-error-alert').textContent).toBe(
      '登入次數已達上限，請稍後再試。',
    );
    expect(screen.getByTestId('auth-email-input').value).toBe('keepme@example.com');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('skips repeat login and curl animation when a confirmed session already exists, but never authorizes user-only without session', () => {
    // 1) User object alone without session must NOT navigate (production safety)
    authState.user = { id: 'user-only', email: 'only@example.com' };
    authState.session = null;
    const { unmount } = renderAuth();
    expect(mockNavigate).not.toHaveBeenCalled();
    unmount();

    // 2) Confirmed session + user navigates immediately without animation
    const confirmed = makeConfirmedSession();
    authState.session = confirmed;
    authState.user = confirmed.user;
    renderAuth();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
    expect(screen.getByTestId('auth-magazine-sheet').className).not.toContain(
      'mc-cover-sheet--turning',
    );
  });

  it('preserves Google OAuth sign-in, sign-up email verification + resend, and password reset flows', async () => {
    // Google OAuth error handling
    authState.signInWithGoogle.mockResolvedValueOnce({
      error: { code: 'network_error', message: 'Network request failed' },
    });
    renderAuth();

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-google-btn'));
    });
    expect(authState.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('無法連線至網路');

    // Switch to sign-up mode via full-width contextual mode switch -> submit via corner -> pending verification inbox -> resend
    authState.signUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user', email: 'new@example.com' }, session: null },
      error: null,
    });
    authState.resendSignUpEmail.mockResolvedValueOnce({ error: null });

    fireEvent.click(screen.getByTestId('auth-mode-switch-btn'));
    expect(screen.getByTestId('auth-primary-surface').textContent).toContain('翻頁註冊');
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'newpass123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(authState.signUp).toHaveBeenCalledWith('new@example.com', 'newpass123');
    expect(screen.getByTestId('auth-verify-email-panel').textContent).toContain('new@example.com');

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-resend-signup-btn'));
    });
    expect(authState.resendSignUpEmail).toHaveBeenCalledWith('new@example.com');
    expect(screen.getByTestId('auth-success-banner').textContent).toContain('已重新寄送驗證信');

    // Back from pending email -> switch back to sign-in -> forgot password flow
    fireEvent.click(screen.getByTestId('auth-back-from-verify-btn'));
    fireEvent.click(screen.getByTestId('auth-mode-switch-btn'));
    fireEvent.click(screen.getByTestId('auth-forgot-password-link'));

    authState.resetPasswordForEmail.mockResolvedValue({ error: null });
    const forgotEmailInput = screen.getByTestId('auth-forgot-email-input');
    expect(forgotEmailInput.closest('.mc-corner-safe-row')).toBeTruthy();
    fireEvent.change(forgotEmailInput, {
      target: { value: 'reset@example.com' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-forgot-submit-btn'));
    });

    expect(authState.resetPasswordForEmail).toHaveBeenCalledWith('reset@example.com');
    expect(screen.getByTestId('auth-reset-sent-panel')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-resend-reset-btn'));
    });
    expect(authState.resetPasswordForEmail).toHaveBeenCalledTimes(2);
  });

  it('renders loading screen when authLoading is true and config-missing screen when supabaseConfigured is false', () => {
    authState.loading = true;
    const { unmount } = renderAuth();
    expect(screen.getByTestId('auth-loading-screen')).toBeTruthy();
    unmount();

    authState.loading = false;
    authState.supabaseConfigured = false;
    renderAuth();
    expect(screen.getByTestId('auth-config-missing-screen')).toBeTruthy();
  });

  it('updates continuous curl geometry during corner drag and springs back on below-threshold release or cancel without submitting', () => {
    vi.useFakeTimers();
    renderAuth();

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const surface = screen.getByTestId('auth-cover-surface');

    const restCutX = Number(sheet.getAttribute('data-cut-x-pct'));
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');

    // 1) Below-threshold pointer drag -> geometry progresses continuously, then springs back on release
    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 610,
    });

    const midProgress = Number(sheet.getAttribute('data-curl-progress'));
    const midCutX = Number(sheet.getAttribute('data-cut-x-pct'));
    expect(midProgress).toBeGreaterThan(0);
    expect(midProgress).toBeLessThan(CURL_COMMIT_THRESHOLD);
    expect(midCutX).toBeGreaterThan(restCutX);
    expect(surface.style.clipPath).toContain('polygon(');

    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 610,
    });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');

    // 2) Pointer cancel / lost pointer capture mid-drag safely springs back to 0 without submitting
    fireEvent.pointerDown(curlBtn, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 160,
      clientY: 500,
    });
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(
      CURL_COMMIT_THRESHOLD,
    );

    fireEvent.pointerCancel(curlBtn, { pointerId: 2 });
    expect(authState.signIn).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
  });

  it('commits corner drag past threshold via shared guarded submit, suppresses trailing synthetic click, and never self-authorizes when session is unconfirmed', async () => {
    authState.signIn.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: null,
    });

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'gesture@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'pass1234' },
    });

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');

    const restGeom = computeCurlGeometry(0);
    const dragGeom = computeCurlGeometry(0.68);
    expect(restGeom.thresholdMet).toBe(false);
    expect(dragGeom.thresholdMet).toBe(true);
    expect(dragGeom.cutX).toBeGreaterThan(restGeom.cutX);

    await act(async () => {
      fireEvent.touchStart(curlBtn, {
        touches: [{ identifier: 0, clientX: 360, clientY: 640 }],
      });
      fireEvent.touchMove(curlBtn, {
        touches: [{ identifier: 0, clientX: 170, clientY: 490 }],
      });
      fireEvent.touchEnd(curlBtn, {
        changedTouches: [{ identifier: 0, clientX: 170, clientY: 490 }],
      });
      // Trailing browser compatibility click after touchEnd must be suppressed once
      fireEvent.click(curlBtn);
    });

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(authState.signIn).toHaveBeenCalledWith('gesture@example.com', 'pass1234');
    expect(curlBtn.getAttribute('data-submit-count')).toBe('1');
    expect(curlBtn.getAttribute('data-last-submit-source')).toBe('drag');
    // Unconfirmed session must NOT turn the cover or navigate; corner springs back to 0
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(sheet.className).not.toContain('mc-cover-sheet--turning');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('尚未建立有效登入狀態');
  });

  it('keeps the lower-right 翻頁登入 corner cue unboxed (no border, background, background-image, shadow, or rounded tile in rest/hover/active) while preserving >=44px hit target and keyboard-only focus-visible outline', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/theme/journal.css'),
      'utf8',
    );

    const extractRule = (selector) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
      return match ? match[1] : '';
    };

    const surfaceRule = extractRule('.mc-primary-corner-surface');
    expect(surfaceRule).toContain('min-height: 44px');
    expect(surfaceRule).toContain('border: 0');
    expect(surfaceRule).toContain('border-radius: 0');
    expect(surfaceRule).toContain('background-color: transparent');
    expect(surfaceRule).toContain('background-image: none');
    expect(surfaceRule).toContain('box-shadow: none');

    const hoverRule = extractRule('.mc-primary-corner-surface:hover:not(:disabled)');
    expect(hoverRule).toContain('border: 0');
    expect(hoverRule).toContain('border-radius: 0');
    expect(hoverRule).toContain('background-color: transparent');
    expect(hoverRule).toContain('background-image: none');
    expect(hoverRule).toContain('box-shadow: none');
    expect(hoverRule).not.toContain('outline: none');

    const activeRule = extractRule('.mc-primary-corner-surface:active:not(:disabled)');
    expect(activeRule).toContain('border: 0');
    expect(activeRule).toContain('border-radius: 0');
    expect(activeRule).toContain('background-color: transparent');
    expect(activeRule).toContain('background-image: none');
    expect(activeRule).toContain('box-shadow: none');
    expect(activeRule).not.toContain('outline: none');

    const focusNotVisibleRule = extractRule(
      '.mc-primary-corner-surface:focus:not(:focus-visible)',
    );
    expect(focusNotVisibleRule).toContain('outline: none');
    expect(focusNotVisibleRule).toContain('box-shadow: none');

    const focusVisibleRule = extractRule('.mc-primary-corner-surface:focus-visible');
    expect(focusVisibleRule).toContain('outline: 2px solid rgb(var(--c-route))');
    expect(focusVisibleRule).toContain('outline-offset: 2px');

    // Simultaneous keyboard focus-visible + pointer hover/active must preserve painted 2px solid outline
    expect(css).toContain('.mc-primary-corner-surface:focus-visible:hover:not(:disabled)');
    expect(css).toContain('.mc-primary-corner-surface:focus-visible:active:not(:disabled)');
    expect(css).toContain('@media (forced-colors: active)');
  });

  it('cancels active pointer drag and releases pointer capture on keyboard Tab/Escape or blur abandonment, preventing late threshold commit and keeping focus off BODY', () => {
    vi.useFakeTimers();
    renderAuth();

    const emailInput = screen.getByTestId('auth-email-input');
    const modeSwitchBtn = screen.getByTestId('auth-mode-switch-btn');
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');

    fireEvent.change(emailInput, { target: { value: 'abandon@example.com' } });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'pass1234' },
    });

    const capturedIds = new Set();
    curlBtn.setPointerCapture = vi.fn((id) => capturedIds.add(id));
    curlBtn.releasePointerCapture = vi.fn((id) => capturedIds.delete(id));
    curlBtn.hasPointerCapture = vi.fn((id) => capturedIds.has(id));

    // 1) Start pointer drag and move into intermediate curl pose
    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 290,
      clientY: 600,
    });

    expect(curlBtn.hasPointerCapture(1)).toBe(true);
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(document.activeElement).toBe(curlBtn);

    // Press Tab while pointer drag is still held: must release capture immediately, exit dragging, and focus email input (not BODY)
    fireEvent.keyDown(curlBtn, { key: 'Tab' });

    expect(curlBtn.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(curlBtn.hasPointerCapture(1)).toBe(false);
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(document.activeElement).toBe(emailInput);

    // Continuing to move and release the abandoned pointer past threshold must NOT commit or submit
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 440,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 440,
    });
    fireEvent.click(curlBtn);

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(document.activeElement).toBe(emailInput);
    expect(authState.signIn).not.toHaveBeenCalled();

    // 2) Shift+Tab while pointer drag is held moves focus to previous control (modeSwitchBtn) and cancels capture
    fireEvent.pointerDown(curlBtn, {
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 290,
      clientY: 600,
    });
    expect(curlBtn.hasPointerCapture(2)).toBe(true);

    fireEvent.keyDown(curlBtn, { key: 'Tab', shiftKey: true });
    expect(curlBtn.hasPointerCapture(2)).toBe(false);
    expect(document.activeElement).toBe(modeSwitchBtn);

    // 3) Escape while pointer drag is held cancels capture and retains focus on primary corner surface
    fireEvent.pointerDown(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 480,
    });
    expect(curlBtn.hasPointerCapture(3)).toBe(true);

    fireEvent.keyDown(curlBtn, { key: 'Escape' });
    expect(curlBtn.hasPointerCapture(3)).toBe(false);
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(document.activeElement).toBe(curlBtn);
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: 150, clientY: 480 });
    expect(authState.signIn).not.toHaveBeenCalled();
  });

  it('maintains explicit focus and inert/aria-hidden lifecycle across pending auth, confirmed turning paper, and error recovery', async () => {
    let resolveAttempt1;
    authState.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAttempt1 = resolve;
        }),
    );

    renderAuth();

    const form = screen.getByTestId('auth-credentials-form');
    const controlIds = [
      'auth-email-input',
      'auth-password-input',
      'auth-google-btn',
      'auth-forgot-password-link',
      'auth-mode-switch-btn',
      'auth-primary-surface',
    ];
    const getControls = () => controlIds.map((id) => screen.getByTestId(id));

    // Ready state: all controls interactive, tabIndex=0, not inert, not aria-hidden
    for (const ctrl of getControls()) {
      expect(ctrl.disabled).toBe(false);
      expect(ctrl.inert).toBe(false);
      expect(ctrl.hasAttribute('inert')).toBe(false);
      expect(ctrl.getAttribute('aria-hidden')).toBeNull();
      expect(ctrl.tabIndex).toBe(0);
    }

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'lifecycle@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    // 1) Trigger submit -> enters pending auth state
    fireEvent.click(screen.getByTestId('auth-primary-surface'));

    const submittingStatus = screen.getByTestId('auth-submitting-status');
    expect(document.activeElement).toBe(submittingStatus);
    expect(form.inert).toBe(true);
    expect(form.hasAttribute('inert')).toBe(true);
    for (const ctrl of getControls()) {
      expect(ctrl.disabled).toBe(true);
      expect(ctrl.inert).toBe(true);
      expect(ctrl.tabIndex).toBe(-1);
    }

    // Accessible >=44px cancel action is rendered OUTSIDE the inert form and reachable via normal Tab/Shift+Tab (no Tab trap on status)
    const cancelBtn = screen.getByTestId('auth-pending-cancel-btn');
    expect(form.contains(cancelBtn)).toBe(false);
    expect(cancelBtn.disabled).toBe(false);
    expect(cancelBtn.inert).toBe(false);
    expect(cancelBtn.hasAttribute('inert')).toBe(false);
    expect(cancelBtn.tabIndex).toBe(0);
    expect(cancelBtn.className).toContain('min-h-[44px]');
    expect(cancelBtn.className).toContain('min-w-[44px]');

    const tabOnStatus = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    submittingStatus.dispatchEvent(tabOnStatus);
    expect(tabOnStatus.defaultPrevented).toBe(false);

    const shiftTabOnStatus = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    submittingStatus.dispatchEvent(shiftTabOnStatus);
    expect(shiftTabOnStatus.defaultPrevented).toBe(false);

    // 2) Resolve attempt 1 with auth error -> recovers interactive controls and focuses error alert
    await act(async () => {
      resolveAttempt1({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });
    });

    const alertNode = screen.getByTestId('auth-error-alert');
    expect(document.activeElement).toBe(alertNode);
    expect(form.inert).toBe(false);
    expect(form.hasAttribute('inert')).toBe(false);
    expect(form.getAttribute('aria-hidden')).toBeNull();
    for (const ctrl of getControls()) {
      expect(ctrl.disabled).toBe(false);
      expect(ctrl.inert).toBe(false);
      expect(ctrl.hasAttribute('inert')).toBe(false);
      expect(ctrl.getAttribute('aria-hidden')).toBeNull();
      expect(ctrl.tabIndex).toBe(0);
    }

    // 3) Retry with confirmed session -> enters turning state where rotating form is inert + aria-hidden and focus stays on turning status
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValueOnce({
      data: { session, user: session.user },
      error: null,
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    const turningStatus = screen.getByTestId('auth-turning-status');
    expect(document.activeElement).toBe(turningStatus);
    expect(form.inert).toBe(true);
    expect(form.hasAttribute('inert')).toBe(true);
    expect(form.getAttribute('aria-hidden')).toBe('true');
    for (const ctrl of getControls()) {
      expect(ctrl.disabled).toBe(true);
      expect(ctrl.inert).toBe(true);
      expect(ctrl.hasAttribute('inert')).toBe(true);
      expect(ctrl.getAttribute('aria-hidden')).toBe('true');
      expect(ctrl.tabIndex).toBe(-1);
    }

    // Pressing Tab during confirmed turning pose keeps focus anchored on auth-turning-status
    fireEvent.keyDown(turningStatus, { key: 'Tab' });
    expect(document.activeElement).toBe(turningStatus);
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(turningStatus);
  });

  it('cancels indefinite pending auth via accessible >=44px cancel button and via Escape key, clearing pending feedback, retaining email, and restoring focus', async () => {
    authState.signIn.mockImplementation(() => new Promise(() => {}));

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const primarySurface = screen.getByTestId('auth-primary-surface');
    const form = screen.getByTestId('auth-credentials-form');

    fireEvent.change(emailInput, { target: { value: 'cancel.me@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // 1) Submit via corner surface -> enters pending state
    fireEvent.click(primarySurface);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();
    const cancelBtn = screen.getByTestId('auth-pending-cancel-btn');
    expect(form.contains(cancelBtn)).toBe(false);
    expect(form.inert).toBe(true);

    // Click accessible cancel button -> exits pending state, retains email, shows recovery notice, restores focus to primarySurface
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('auth-submitting-status')).toBeNull();
    expect(screen.queryByTestId('auth-pending-cancel-btn')).toBeNull();
    expect(form.inert).toBe(false);
    expect(emailInput.disabled).toBe(false);
    expect(emailInput.value).toBe('cancel.me@example.com');
    expect(screen.getByTestId('auth-success-banner').textContent).toContain('已取消等待');
    expect(document.activeElement).toBe(primarySurface);
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2) Submit via Enter from email input -> enters pending state -> press Escape to cancel
    fireEvent.keyDown(emailInput, { key: 'Enter' });
    const submittingStatus2 = screen.getByTestId('auth-submitting-status');
    expect(document.activeElement).toBe(submittingStatus2);
    expect(form.inert).toBe(true);

    fireEvent.keyDown(submittingStatus2, { key: 'Escape' });

    expect(screen.queryByTestId('auth-submitting-status')).toBeNull();
    expect(screen.queryByTestId('auth-pending-cancel-btn')).toBeNull();
    expect(form.inert).toBe(false);
    expect(emailInput.value).toBe('cancel.me@example.com');
    expect(document.activeElement).toBe(emailInput);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('bounds indefinite pending auth with AUTH_PENDING_TIMEOUT_MS, exits pending state, announces timeout alert, retains email, and ignores late resolutions', async () => {
    vi.useFakeTimers();
    let resolveStaleSuccess;
    let rejectStaleError;

    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleSuccess = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectStaleError = reject;
          }),
      );

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const primarySurface = screen.getByTestId('auth-primary-surface');
    const form = screen.getByTestId('auth-credentials-form');

    fireEvent.change(emailInput, { target: { value: 'timeout@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // 1) Start attempt 1 and advance timer to AUTH_PENDING_TIMEOUT_MS
    fireEvent.click(primarySurface);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(AUTH_PENDING_TIMEOUT_MS);
    });

    expect(screen.queryByTestId('auth-submitting-status')).toBeNull();
    expect(screen.queryByTestId('auth-pending-cancel-btn')).toBeNull();
    expect(form.inert).toBe(false);
    expect(emailInput.value).toBe('timeout@example.com');
    const timeoutAlert = screen.getByTestId('auth-error-alert');
    expect(timeoutAlert.textContent).toContain('登入等待逾時');
    expect(document.activeElement).toBe(timeoutAlert);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Late success of timed-out attempt 1 must NOT turn the cover or navigate
    const session = makeConfirmedSession();
    await act(async () => {
      resolveStaleSuccess({
        data: { session, user: session.user },
        error: null,
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-magazine-sheet').className).not.toContain(
      'mc-cover-sheet--turning',
    );

    // 2) Start attempt 2, cancel via Escape, then reject stale promise 2 -> late failure is ignored
    fireEvent.click(primarySurface);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();
    expect(screen.getByTestId('auth-success-banner').textContent).toContain('已取消等待');

    await act(async () => {
      rejectStaleError(new Error('Failed to fetch'));
    });
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('isolates retry request identity when an older cancelled promise is still pending: stale finally never clears active retry state or allows duplicate submits', async () => {
    let resolveAttempt1;
    let resolveAttempt2;
    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAttempt1 = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAttempt2 = resolve;
          }),
      );

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const primarySurface = screen.getByTestId('auth-primary-surface');
    const form = screen.getByTestId('auth-credentials-form');

    fireEvent.change(emailInput, { target: { value: 'retry@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // Start Attempt 1
    fireEvent.click(primarySurface);
    expect(authState.signIn).toHaveBeenCalledTimes(1);

    // Cancel Attempt 1 while promise 1 is still unresolved
    fireEvent.click(screen.getByTestId('auth-pending-cancel-btn'));
    expect(form.inert).toBe(false);

    // Immediately start Attempt 2 while Attempt 1 is still in flight
    fireEvent.click(primarySurface);
    expect(authState.signIn).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();
    expect(form.inert).toBe(true);

    // Now Attempt 1 resolves with an error (and runs its finally block) while Attempt 2 is still pending
    await act(async () => {
      resolveAttempt1({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });
    });

    // Attempt 2 must STILL be pending and locked against duplicate submissions, with no stale error shown
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();
    expect(form.inert).toBe(true);
    fireEvent.click(primarySurface);
    fireEvent.submit(form);
    expect(authState.signIn).toHaveBeenCalledTimes(2);

    // Now Attempt 2 resolves with a confirmed session -> cover turns and navigates
    const confirmed = makeConfirmedSession({
      user: { id: 'user-retry', email: 'retry@example.com' },
    });
    await act(async () => {
      resolveAttempt2({
        data: { session: confirmed, user: confirmed.user },
        error: null,
      });
    });

    expect(screen.getByTestId('auth-magazine-sheet').className).toContain(
      'mc-cover-sheet--turning',
    );
  });

  it('reconciles late provider context session after local cancel or timeout: never auto-turns or auto-navigates in background, and requires deliberate next user action', async () => {
    authState.signIn.mockImplementation(() => new Promise(() => {}));

    const { rerender } = renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const primarySurface = screen.getByTestId('auth-primary-surface');

    fireEvent.change(emailInput, { target: { value: 'reader@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // 1) Start sign-in and cancel locally
    fireEvent.click(primarySurface);
    fireEvent.click(screen.getByTestId('auth-pending-cancel-btn'));
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2) Provider subsequently establishes a confirmed session in AuthContext (onAuthStateChange)
    const lateConfirmed = makeConfirmedSession({
      user: { id: 'user-123', email: 'reader@example.com' },
    });
    authState.session = lateConfirmed;
    authState.user = lateConfirmed.user;
    rerender(createElement(I18nextProvider, { i18n }, createElement(Auth)));

    // Cover must NOT auto-navigate or auto-turn after local cancellation
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('auth-magazine-sheet').className).not.toContain(
      'mc-cover-sheet--turning',
    );

    // 3) Deliberate next user action on the cover uses the confirmed session and starts page turn
    await act(async () => {
      fireEvent.click(primarySurface);
    });
    expect(screen.getByTestId('auth-magazine-sheet').className).toContain(
      'mc-cover-sheet--turning',
    );
    expect(authState.signIn).toHaveBeenCalledTimes(1);
  });

  it('cleans up pending and turn timers on unmount and ignores late resolution after unmount', async () => {
    vi.useFakeTimers();
    let resolvePending;
    authState.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    const { unmount } = renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'unmount@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    fireEvent.click(screen.getByTestId('auth-primary-surface'));
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();

    unmount();

    const session = makeConfirmedSession();
    await act(async () => {
      resolvePending({
        data: { session, user: session.user },
        error: null,
      });
      vi.advanceTimersByTime(AUTH_PENDING_TIMEOUT_MS + PAGE_TURN_DURATION_MS);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('prevents canceled old threshold Promise settlement (both reject and resolve) from resetting a newer held pointer or touch curl or releasing active pointer capture', async () => {
    let resolveAttempt1;
    let rejectAttempt2;
    let resolveAttempt3;
    let rejectAttempt4;

    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAttempt1 = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectAttempt2 = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveAttempt3 = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectAttempt4 = reject;
          }),
      );

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'mock-reader@example.test' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'mock-password-only' },
    });

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');
    const capturedIds = new Set();
    curlBtn.setPointerCapture = vi.fn((id) => capturedIds.add(id));
    curlBtn.releasePointerCapture = vi.fn((id) => capturedIds.delete(id));
    curlBtn.hasPointerCapture = vi.fn((id) => capturedIds.has(id));

    // 1) Pointer threshold drag 1 -> pending -> cancel via Escape -> new held pointer drag -> old Promise 1 resolves
    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 510,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 510,
    });

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');
    expect(backdrop.getAttribute('data-curl-progress')).toBe('0');

    // Start new held pointer drag (pointerId 2) to ~0.314 progress
    fireEvent.pointerDown(curlBtn, {
      pointerId: 2,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 295,
      clientY: 605,
    });

    const heldProgress1 = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(heldProgress1).toBeGreaterThan(0);
    expect(heldProgress1).toBeLessThan(CURL_COMMIT_THRESHOLD);
    expect(curlBtn.hasPointerCapture(2)).toBe(true);

    // Old Promise 1 resolves while pointerId 2 drag is held
    const staleSession = makeConfirmedSession();
    await act(async () => {
      resolveAttempt1({
        data: { session: staleSession, user: staleSession.user },
        error: null,
      });
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(heldProgress1);
    expect(curlBtn.hasPointerCapture(2)).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Release below-threshold held drag 2 -> springs back without ghost submit
    fireEvent.pointerUp(curlBtn, {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 295,
      clientY: 605,
    });
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(curlBtn.hasPointerCapture(2)).toBe(false);

    // 2) Pointer threshold drag 2 -> pending -> cancel via Escape -> new held pointer drag -> old Promise 2 rejects
    fireEvent.pointerDown(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 510,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 510,
    });

    expect(authState.signIn).toHaveBeenCalledTimes(2);
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');

    fireEvent.pointerDown(curlBtn, {
      pointerId: 4,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 4,
      pointerType: 'mouse',
      clientX: 295,
      clientY: 605,
    });

    const heldProgress2 = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(curlBtn.hasPointerCapture(4)).toBe(true);

    // Old Promise 2 rejects while pointerId 4 drag is held
    await act(async () => {
      rejectAttempt2(new Error('late mock invalid credentials'));
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(heldProgress2);
    expect(curlBtn.hasPointerCapture(4)).toBe(true);
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.pointerUp(curlBtn, {
      pointerId: 4,
      pointerType: 'mouse',
      clientX: 295,
      clientY: 605,
    });
    expect(authState.signIn).toHaveBeenCalledTimes(2);

    // 3) Touch threshold drag 3 -> cancel -> new held touch drag -> old Promise 3 resolves & Touch threshold drag 4 -> cancel -> new held touch drag -> old Promise 4 rejects
    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 0, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 0, clientX: 160, clientY: 500 }],
    });
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 0, clientX: 160, clientY: 500 }],
    });

    expect(authState.signIn).toHaveBeenCalledTimes(3);
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    fireEvent.click(screen.getByTestId('auth-pending-cancel-btn'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');

    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 1, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 1, clientX: 290, clientY: 600 }],
    });
    const touchHeldProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(touchHeldProgress).toBeGreaterThan(0);

    await act(async () => {
      resolveAttempt3({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(touchHeldProgress);

    // Continue held touch drag past threshold and release -> commits attempt 4
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 1, clientX: 160, clientY: 500 }],
    });
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 1, clientX: 160, clientY: 500 }],
    });
    expect(authState.signIn).toHaveBeenCalledTimes(4);
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 2, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 2, clientX: 290, clientY: 600 }],
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');

    await act(async () => {
      rejectAttempt4(new Error('late network failure'));
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(touchHeldProgress);
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 2, clientX: 290, clientY: 600 }],
    });
    expect(authState.signIn).toHaveBeenCalledTimes(4);
  });

  it('preserves a newer threshold awaiting-auth curl when an older canceled or timed-out Promise settles (both resolve and reject)', async () => {
    vi.useFakeTimers();
    let rejectOldAttempt1;
    let resolveOldAttempt2;
    let resolveActiveAttempt3;

    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectOldAttempt1 = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOldAttempt2 = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveActiveAttempt3 = resolve;
          }),
      );

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'threshold-race@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');

    // Attempt 1 via threshold drag -> cancel via Escape
    fireEvent.pointerDown(curlBtn, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: 150, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: 150, clientY: 510 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');

    // Attempt 2 via threshold drag -> let 12s timeout expire
    fireEvent.pointerDown(curlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: 150, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: 150, clientY: 510 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    await act(async () => {
      vi.advanceTimersByTime(AUTH_PENDING_TIMEOUT_MS);
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');
    expect(backdrop.getAttribute('data-curl-progress')).toBe('0');

    // Attempt 3 via threshold drag -> now actively pending in awaiting-auth
    fireEvent.pointerDown(curlBtn, { pointerId: 3, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 3, clientX: 140, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: 140, clientY: 500 });

    const pendingProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');
    expect(pendingProgress).toBeGreaterThanOrEqual(CURL_COMMIT_THRESHOLD);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();

    // Settle both old Attempt 1 (reject) and old Attempt 2 (resolve) while Attempt 3 is pending
    await act(async () => {
      rejectOldAttempt1(new Error('stale attempt 1 rejection'));
      resolveOldAttempt2({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid' },
      });
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(pendingProgress);
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();

    // Now resolve active Attempt 3 with confirmed session -> transitions to turning
    const confirmed = makeConfirmedSession();
    await act(async () => {
      resolveActiveAttempt3({
        data: { session: confirmed, user: confirmed.user },
        error: null,
      });
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');
  });

  it('prevents stale springback timers, click-suppression timers, and stale pointerIds from clobbering newer drags, focus, or submits', async () => {
    vi.useFakeTimers();
    let resolvePending;
    authState.signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePending = resolve;
        }),
    );

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'timers@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');
    const capturedIds = new Set();
    curlBtn.setPointerCapture = vi.fn((id) => capturedIds.add(id));
    curlBtn.releasePointerCapture = vi.fn((id) => capturedIds.delete(id));
    curlBtn.hasPointerCapture = vi.fn((id) => capturedIds.has(id));

    // 1) Below-threshold drag release starts 220ms springback timer; new drag starts at 100ms
    fireEvent.pointerDown(curlBtn, { pointerId: 10, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 10, clientX: 300, clientY: 610 });
    fireEvent.pointerUp(curlBtn, { pointerId: 10, clientX: 300, clientY: 610 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('springback');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Start new drag with pointerId 20
    fireEvent.pointerDown(curlBtn, { pointerId: 20, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 20, clientX: 280, clientY: 590 });
    const activeProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(curlBtn.hasPointerCapture(20)).toBe(true);

    // Late lostpointercapture / pointercancel for old pointerId 10 must NOT cancel pointerId 20 or release capture 20
    fireEvent(
      curlBtn,
      new window.PointerEvent('lostpointercapture', { bubbles: true, pointerId: 10 }),
    );
    fireEvent.pointerCancel(curlBtn, { pointerId: 10 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(activeProgress);
    expect(curlBtn.hasPointerCapture(20)).toBe(true);

    // Advance past original 220ms springback window: old springback timer must NOT reset phase to idle
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(activeProgress);
    expect(curlBtn.hasPointerCapture(20)).toBe(true);

    // Cancel drag 20 -> enters springback -> immediately submit via Enter on email input before 220ms elapses
    fireEvent.keyDown(curlBtn, { key: 'Escape' });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('springback');

    fireEvent.keyDown(screen.getByTestId('auth-email-input'), { key: 'Enter' });
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    const submittingStatus = screen.getByTestId('auth-submitting-status');
    expect(document.activeElement).toBe(submittingStatus);

    // Blur to body and advance 220ms: stale springback timer must NOT steal focus or mutate state while pending
    submittingStatus.blur();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(document.activeElement).not.toBe(curlBtn);

    await act(async () => {
      resolvePending({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid' },
      });
    });
  });

  it('isolates standalone MagazineCoverView interaction epochs across deferred promises and unmount without controller submitting prop', async () => {
    let resolveFirst;
    let rejectSecond;
    let resolveThird;
    const calls = [];
    const handleCurlSubmit = vi
      .fn()
      .mockImplementationOnce(
        (payload) =>
          new Promise((resolve) => {
            calls.push(payload);
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        (payload) =>
          new Promise((_resolve, reject) => {
            calls.push(payload);
            rejectSecond = reject;
          }),
      )
      .mockImplementationOnce(
        (payload) =>
          new Promise((resolve) => {
            calls.push(payload);
            resolveThird = resolve;
          }),
      );

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, {
          email: 'view@example.com',
          password: 'secret',
          onPageCurlSubmit: handleCurlSubmit,
        }),
      ),
    );

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');
    const capturedIds = new Set();
    curlBtn.setPointerCapture = vi.fn((id) => capturedIds.add(id));
    curlBtn.releasePointerCapture = vi.fn((id) => capturedIds.delete(id));
    curlBtn.hasPointerCapture = vi.fn((id) => capturedIds.has(id));

    // 1) Threshold drag 1 -> awaiting-auth
    fireEvent.pointerDown(curlBtn, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: 150, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: 150, clientY: 510 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    // 2) Start new held drag 2 -> dragging
    fireEvent.pointerDown(curlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: 295, clientY: 605 });
    const heldProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');

    // First deferred promise resolves while drag 2 is held -> must not reset drag 2
    await act(async () => {
      resolveFirst();
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(heldProgress);

    // Move drag 2 past threshold and release -> awaiting-auth (second deferred promise)
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: 150, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: 150, clientY: 510 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    // 3) Commit threshold drag 3 -> awaiting-auth (third deferred promise)
    fireEvent.pointerDown(curlBtn, { pointerId: 3, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 3, clientX: 145, clientY: 505 });
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: 145, clientY: 505 });
    const thirdProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    // Second deferred promise rejects while third threshold drag is awaiting-auth -> must not reset third
    await act(async () => {
      rejectSecond(new Error('stale view promise rejected'));
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(thirdProgress);

    // Third deferred promise resolves while current -> cleanly resets to idle / 0
    await act(async () => {
      resolveThird();
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');
    expect(backdrop.getAttribute('data-curl-progress')).toBe('0');

    // 4) Start a new drag (pointerId 4) and unmount while captured -> unmount must not call releasePointerCapture
    curlBtn.releasePointerCapture.mockClear();
    fireEvent.pointerDown(curlBtn, { pointerId: 4, clientX: 360, clientY: 640 });
    expect(curlBtn.hasPointerCapture(4)).toBe(true);
    unmount();
    expect(curlBtn.releasePointerCapture).not.toHaveBeenCalled();
  });

  it('renders R11 placeholder scenery and bilingual badge when coverImage is null, and omits them when coverImage is set', async () => {
    const { rerender } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, { coverImage: null }),
      ),
    );

    expect(screen.queryByTestId('auth-cover-image')).toBeNull();
    expect(screen.queryByTestId('auth-cover-image-backdrop')).toBeNull();
    expect(screen.queryByTestId('auth-cover-form-wash')).toBeNull();
    expect(screen.getByTestId('auth-login-overlay').className).not.toContain(
      'mc-login-overlay--cover-wash',
    );
    expect(screen.getByTestId('auth-cover-headline').textContent).toBe('KAMAKURA');
    expect(screen.getByTestId('auth-cover-issue').textContent).toBe('第 01 期 · 海岸線特集');
    expect(screen.getByTestId('auth-cover-subtitle').textContent).toBe(
      '日本 · 海岸電車與旅途手札',
    );
    expect(screen.getByTestId('auth-kamakura-scenery')).toBeTruthy();
    expect(screen.getByTestId('auth-placeholder-artwork-badge').textContent).toContain(
      '暫代示範插畫景色（非最終完成圖）',
    );
    expect(screen.getByTestId('auth-placeholder-artwork-badge').textContent).toContain(
      'not final artwork',
    );

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByTestId('auth-cover-issue').textContent).toBe(
      'ISSUE 01 · COASTAL EDITION',
    );
    expect(screen.getByTestId('auth-cover-subtitle').textContent).toBe(
      'Japan · Shonan & Coastal Railway Notes',
    );
    expect(screen.getByTestId('auth-placeholder-artwork-badge').textContent).toContain(
      'Placeholder scenery illustration — not final artwork',
    );
    expect(screen.getByTestId('auth-placeholder-artwork-badge').textContent).toContain(
      '非最終完成圖',
    );

    const kyotoCover = findLoginCover('kyoto');
    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, {
          coverImage: kyotoCover,
          coverHeadline: 'html',
        }),
      ),
    );

    const surface = screen.getByTestId('auth-cover-surface');
    const backdropImg = screen.getByTestId('auth-cover-image-backdrop');
    const img = screen.getByTestId('auth-cover-image');
    expect(img.getAttribute('data-cover-id')).toBe('kyoto');
    expect(img.getAttribute('src')).toBe(kyotoCover.src);
    expect(img.getAttribute('alt')).toBe(kyotoCover.alt);
    expect(img.getAttribute('decoding')).toBe('async');
    expect(backdropImg.getAttribute('src')).toBe(kyotoCover.src);
    expect(backdropImg.getAttribute('alt')).toBe('');
    expect(backdropImg.getAttribute('aria-hidden')).toBe('true');
    expect(surface.contains(backdropImg)).toBe(true);
    expect(surface.contains(img)).toBe(true);
    expect(screen.queryByTestId('auth-cover-form-wash')).toBeNull();
    expect(screen.getByTestId('auth-login-overlay').className).toContain(
      'mc-login-overlay--cover-wash',
    );
    expect(screen.queryByTestId('auth-kamakura-scenery')).toBeNull();
    expect(screen.queryByTestId('auth-placeholder-artwork-badge')).toBeNull();
  });

  it('supports html and painted coverHeadline modes, full-width top-anchored image with blurred bottom backdrop, solid top sky scrim, neutral copy, and accessible h1', async () => {
    const osakaCover = findLoginCover('osaka');
    const { rerender } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, {
          coverImage: osakaCover,
          coverHeadline: 'html',
        }),
      ),
    );

    const backdropImg = screen.getByTestId('auth-cover-image-backdrop');
    const img = screen.getByTestId('auth-cover-image');
    expect(img.getAttribute('data-cover-id')).toBe('osaka');
    expect(img.style.pointerEvents).toBe('none');
    expect(img.className).toContain('pointer-events-none');
    expect(backdropImg.style.pointerEvents).toBe('none');
    expect(backdropImg.className).toContain('pointer-events-none');
    expect(screen.getByTestId('auth-cover-headline').textContent).toBe('OSAKA');
    expect(screen.getByTestId('auth-cover-issue').textContent).toBe('ISSUE 01');
    expect(screen.getByTestId('auth-cover-stamp').textContent).toBe('OSAKA · 01');
    expect(screen.getByTestId('auth-cover-stamp').textContent).not.toContain('鎌倉');
    expect(screen.getByTestId('auth-cover-caption-left').textContent).not.toContain('鎌倉');
    expect(screen.getByTestId('auth-cover-subtitle').textContent).not.toContain('海岸電車');
    expect(screen.getByTestId('auth-cover-subtitle').textContent).not.toContain('Shonan');
    expect(screen.getByTestId('auth-cover-sky-scrim')).toBeTruthy();

    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByTestId('auth-cover-issue').textContent).toBe('ISSUE 01');
    expect(screen.getByTestId('auth-cover-subtitle').textContent).not.toContain('Shonan');
    expect(screen.getByTestId('auth-cover-subtitle').textContent).not.toContain('Coastal');

    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/theme/journal.css'),
      'utf8',
    );
    const imgRuleMatch = css.match(/\.mc-cover-image\s*\{([^}]*)\}/);
    expect(imgRuleMatch?.[1] || '').toContain('pointer-events: none');
    expect(imgRuleMatch?.[1] || '').toContain('width: 100%');
    expect(imgRuleMatch?.[1] || '').toContain('height: auto');
    expect(imgRuleMatch?.[1] || '').toContain('top: 0');
    expect(imgRuleMatch?.[1] || '').not.toContain('animation:');

    const backdropRuleMatch = css.match(/\.mc-cover-image-backdrop\s*\{([^}]*)\}/);
    expect(backdropRuleMatch?.[1] || '').toContain('pointer-events: none');
    expect(backdropRuleMatch?.[1] || '').toContain('object-fit: cover');
    expect(backdropRuleMatch?.[1] || '').toContain('object-position: bottom');
    expect(backdropRuleMatch?.[1] || '').toContain('blur(16px)');

    const scrimRuleMatch = css.match(/\.mc-cover-sky-scrim\s*\{([^}]*)\}/);
    expect(scrimRuleMatch?.[1] || '').toContain('rgb(var(--c-route)) 0%');
    expect(scrimRuleMatch?.[1] || '').toContain('rgb(var(--c-route)) 30%');
    expect(scrimRuleMatch?.[1] || '').toContain('transparent 46%');

    expect(css).not.toContain('.mc-cover-form-wash');
    expect(css).not.toContain('mc-cover-image-fade');

    const washRuleMatch = css.match(/\.mc-login-overlay--cover-wash\s*\{([^}]*)\}/);
    const washBeforeRuleMatch = css.match(/\.mc-login-overlay--cover-wash::before\s*\{([^}]*)\}/);
    expect(washRuleMatch?.[1] || '').toContain('rgb(var(--c-paper) / 0.88)');
    expect(washRuleMatch?.[1] || '').not.toMatch(/\bborder\b|\bborder-radius\b|\bbox-shadow\b|\bpadding\b|\bmargin\b/);
    expect(washBeforeRuleMatch?.[1] || '').toContain('top: -1.5rem');
    expect(washBeforeRuleMatch?.[1] || '').toContain('pointer-events: none');
    expect(washBeforeRuleMatch?.[1] || '').toContain('transparent 0%');
    expect(washBeforeRuleMatch?.[1] || '').toContain('rgb(var(--c-paper) / 0.88) 1.5rem');
    expect(washBeforeRuleMatch?.[1] || '').toContain('rgb(var(--c-paper) / 0.88) 100%');
    expect(washBeforeRuleMatch?.[1] || '').not.toMatch(/\bborder\b|\bborder-radius\b|\bbox-shadow\b|\bpadding\b|\bmargin\b/);

    // Switch to painted mode: HTML headline block hidden, accessible h1 retained
    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, {
          coverImage: osakaCover,
          coverHeadline: 'painted',
        }),
      ),
    );

    expect(screen.queryByTestId('auth-cover-headline')).toBeNull();
    expect(screen.queryByTestId('auth-cover-country')).toBeNull();
    expect(screen.queryByTestId('auth-cover-subtitle')).toBeNull();
    expect(screen.queryByTestId('auth-cover-sky-scrim')).toBeNull();

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('OSAKA');
    expect(LOGIN_COVERS).toHaveLength(4);
  });

  it('does not call onTurnAnimationEnd when animationEnd fires on the cover image and renders no false auth-success-banner on a fresh dev harness load', () => {
    const tokyoCover = findLoginCover('tokyo');
    const onTurnAnimationEnd = vi.fn();

    const { unmount } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, {
          coverImage: tokyoCover,
          coverHeadline: 'painted',
          onTurnAnimationEnd,
        }),
      ),
    );

    const coverImg = screen.getByTestId('auth-cover-image');
    const backdropImg = screen.getByTestId('auth-cover-image-backdrop');
    fireEvent.animationEnd(coverImg);
    fireEvent.animationEnd(backdropImg);

    expect(onTurnAnimationEnd).not.toHaveBeenCalled();
    expect(screen.queryByTestId('auth-success-banner')).toBeNull();
    unmount();

    // Fresh AuthDevHarness render (simulating /?devAuth=1&cover=tokyo&headline=painted)
    const originalUrl = window.location.href;
    window.history.replaceState({}, '', '/?devAuth=1&cover=tokyo&headline=painted');
    try {
      render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(AuthDevHarness),
        ),
      );
      expect(screen.getByTestId('auth-cover-image').getAttribute('data-cover-id')).toBe('tokyo');
      expect(screen.queryByTestId('auth-success-banner')).toBeNull();

      // Even if a stray child animationEnd bubbles up, no false success banner appears
      fireEvent.animationEnd(screen.getByTestId('auth-cover-image'));
      expect(screen.queryByTestId('auth-success-banner')).toBeNull();
    } finally {
      window.history.replaceState({}, '', originalUrl);
    }
  });
});

describe('authErrors helpers', () => {
  it('enforces strict session confirmation without user-only fallback', () => {
    expect(hasConfirmedSession({})).toBe(false);
    expect(hasConfirmedSession({ user: { id: 'u1', email: 'a@b.com' } })).toBe(false);
    expect(
      hasConfirmedSession({
        signInResult: { data: { user: { id: 'u1' }, session: null }, error: null },
      }),
    ).toBe(false);
    expect(
      hasConfirmedSession({
        signInResult: {
          data: {
            session: { access_token: '', user: { id: 'u1' } },
          },
          error: null,
        },
      }),
    ).toBe(false);

    const validSession = makeConfirmedSession();
    expect(hasConfirmedSession({ session: validSession, user: validSession.user })).toBe(true);
    expect(isSessionExpired(validSession)).toBe(false);
    expect(
      isSessionExpired({ expires_at: Math.floor(Date.now() / 1000) - 10 }),
    ).toBe(true);
  });

  it('maps unknown server errors to generic localized message without leaking internal text', async () => {
    await i18n.changeLanguage('en');
    const t = i18n.getFixedT('en');
    expect(
      formatAuthError({ code: 'unexpected_db_failure', message: 'SELECT * FROM auth.users failed' }, t),
    ).toBe('Something went wrong. Try again.');
  });
});
