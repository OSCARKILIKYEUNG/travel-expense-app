// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import AuthDevHarness from '../components/auth/AuthDevHarness';
import MagazineCoverView, {
  CURL_REST_AMOUNT,
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
import {
  FINGER_GAIN_X,
  FINGER_GAIN_Y,
  FOLD_CLOSE_MS,
  FOLD_COMMIT_CLIENT_X,
  FOLD_COMMIT_T,
  FOLD_DRAG_START_X,
  FOLD_FLING_T,
  FOLD_FLING_VX,
  FOLD_OPEN_BUTTON_MS,
  FOLD_OPEN_COMMIT_MS,
  FOLD_SPRING_MS,
  clientXForFoldProgress,
  fingerToFold,
  progress as foldProgress,
  restFoldPoint,
} from '../components/auth/foldGeometry';
import Auth, {
  AUTH_PENDING_TIMEOUT_MS,
  PAGE_TURN_ABORT_DURATION_MS,
  PAGE_TURN_DURATION_MS,
} from './Auth';

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
    await act(async () => {
      fireEvent.animationEnd(screen.getByTestId('auth-cover-leaf'));
    });
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
    await act(async () => {
      fireEvent.animationEnd(screen.getByTestId('auth-cover-leaf'));
    });
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

  it('completes navigation on leaf animationend (ignoring child animationend) and does not double-navigate when fallback timer expires', async () => {
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
    const leaf = screen.getByTestId('auth-cover-leaf');
    expect(sheet.className).toContain('mc-cover-sheet--turning');

    // Child animations (shade, back face, cover image) must NOT trigger navigation
    await act(async () => {
      fireEvent.animationEnd(screen.getByTestId('auth-leaf-shade'));
      fireEvent.animationEnd(screen.getByTestId('auth-leaf-back'));
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.animationEnd(leaf);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS * 2);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('uses mc-cover-sheet--fade opacity crossfade (no rotation) and turningPage timer/animationend when prefers-reduced-motion is enabled', async () => {
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

    const sheet = screen.getByTestId('auth-magazine-sheet');
    expect(sheet.className).toContain('mc-cover-sheet--fade');
    expect(sheet.className).not.toContain('mc-cover-sheet--turning');
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
  });

  it('holds the current rest or drag corner curl when turningPage starts (no 0.88 jump) and renders the 3D leaf structure', async () => {
    // 1) Pure geometry helper: turningPage must NOT jump visualCurl to 0.88
    const restIdle = computeCurlGeometry(0, { turningPage: false, phase: 'idle' });
    const restTurning = computeCurlGeometry(0, { turningPage: true, phase: 'turning' });
    expect(restIdle.visualCurl).toBe(CURL_REST_AMOUNT);
    expect(restTurning.visualCurl).toBe(CURL_REST_AMOUNT);
    expect(restTurning.cutX).toBe(restIdle.cutX);
    expect(restTurning.cutY).toBe(restIdle.cutY);

    const dragActive = computeCurlGeometry(0.68, { turningPage: false, phase: 'dragging' });
    const dragTurning = computeCurlGeometry(0.68, { turningPage: true, phase: 'turning' });
    expect(dragTurning.visualCurl).toBe(dragActive.visualCurl);
    expect(dragTurning.cutX).toBe(dragActive.cutX);
    expect(dragTurning.cutY).toBe(dragActive.cutY);

    // 2) Flat click submit: corner curl remains at rest (progress 0) when turningPage activates
    const session = makeConfirmedSession();
    authState.signIn.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    });

    renderAuth();
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const preview = screen.getByTestId('auth-next-page-preview');
    const castShadow = screen.getByTestId('auth-turn-cast-shadow');
    const leaf = screen.getByTestId('auth-cover-leaf');
    const leafFront = screen.getByTestId('auth-leaf-front');
    const leafShade = screen.getByTestId('auth-leaf-shade');
    const leafBack = screen.getByTestId('auth-leaf-back');

    expect(sheet.className).not.toContain('overflow-hidden');
    expect(Array.from(sheet.children)).toEqual([preview, castShadow, leaf]);
    expect(Array.from(leaf.children)).toEqual([leafFront, leafBack]);
    expect(leafFront.contains(screen.getByTestId('auth-cover-surface'))).toBe(true);
    expect(leafFront.contains(screen.getByTestId('auth-curl-geometry-svg'))).toBe(true);
    expect(leafFront.contains(screen.getByTestId('auth-login-overlay'))).toBe(true);
    expect(leafFront.contains(leafShade)).toBe(true);
    expect(screen.getByTestId('auth-curl-shadow').getAttribute('fill')).toBe(
      'url(#mc-curl-shadow-grad)',
    );
    expect(screen.getByTestId('auth-curl-backface').getAttribute('fill')).toBe(
      'url(#mc-curl-flap-grad)',
    );

    const initialCutX = sheet.getAttribute('data-cut-x-pct');
    const initialCutY = sheet.getAttribute('data-cut-y-pct');

    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'nojump@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('auth-primary-surface'));
    });

    expect(sheet.className).toContain('mc-cover-sheet--turning');
    // Button path opens from the rest dog-ear (F0), whose fold progress is a small t, not a jumped curl.
    const restPose = restFoldPoint(480, 656);
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeCloseTo(
      foldProgress(480, restPose.x),
      2,
    );
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeLessThan(0.08);
    expect(sheet.getAttribute('data-cut-x-pct')).toBe(initialCutX);
    expect(sheet.getAttribute('data-cut-y-pct')).toBe(initialCutY);
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
    expect(midProgress).toBeLessThan(FOLD_COMMIT_T);
    expect(midCutX).toBeGreaterThan(restCutX);
    const leafFront = screen.getByTestId('auth-leaf-front');
    expect(leafFront.style.clipPath).toContain('polygon(');
    expect(surface.style.clipPath).toBe('none');

    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 300,
      clientY: 610,
    });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThan(0);
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeLessThan(FOLD_COMMIT_T);
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    act(() => {
      vi.advanceTimersByTime(FOLD_SPRING_MS);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');

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
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 500,
    });
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(
      FOLD_COMMIT_T,
    );

    fireEvent.pointerCancel(curlBtn, { pointerId: 2 });
    expect(authState.signIn).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(FOLD_COMMIT_T);
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
        touches: [{ identifier: 0, clientX: FOLD_COMMIT_CLIENT_X, clientY: 490 }],
      });
      fireEvent.touchEnd(curlBtn, {
        changedTouches: [{ identifier: 0, clientX: FOLD_COMMIT_CLIENT_X, clientY: 490 }],
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
    expect(sheet.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(FOLD_COMMIT_T);
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

    // Simultaneous keyboard focus-visible + pointer hover/active must preserve painted 2px solid outline,
    // while pointer modality drops the focus outline during mouse/touch press/drag
    expect(css).toContain('.mc-primary-corner-surface:focus-visible:hover:not(:disabled)');
    expect(css).toContain('.mc-primary-corner-surface:focus-visible:active:not(:disabled)');
    expect(css).toContain('.mc-primary-corner-surface[data-focus-modality="pointer"]:focus-visible');
    expect(css).toContain('@media (forced-colors: active)');

    // Leaf stays opaque: the finger fold has no rotateY / opacity keyframes. Reduced-motion fade remains.
    expect(css).not.toContain('mc-leaf-back-turn');
    expect(css).not.toContain('mc-leaf-back-turn-abort');
    expect(css).not.toContain('@keyframes mc-paper-curl-turn');
    expect(css).not.toContain('@keyframes mc-paper-curl-turn-abort');
    expect(css).not.toContain('rotateY(-180deg)');
    expect(css).toContain('@keyframes mc-leaf-fade-out');
    expect(css).toContain('@keyframes mc-leaf-fade-in');
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
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThan(0);
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
      vi.advanceTimersByTime(FOLD_SPRING_MS);
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
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThan(0);
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
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
    const sheet = screen.getByTestId('auth-magazine-sheet');
    // A grab during close/spring starts at the live pose. clientX is chosen from
    // that pose so "below" stays under t=0.46 and "commit" still crosses it.
    const clientXFromCurrentPose = (targetT) => {
      const poseX = Number(sheet.getAttribute('data-fold-x'));
      const targetFx = 480 * (1 - 2 * targetT);
      return Math.round(FOLD_DRAG_START_X + (targetFx - poseX) / FINGER_GAIN_X);
    };
    const capturedIds = new Set();
    curlBtn.setPointerCapture = vi.fn((id) => capturedIds.add(id));
    curlBtn.releasePointerCapture = vi.fn((id) => capturedIds.delete(id));
    curlBtn.hasPointerCapture = vi.fn((id) => capturedIds.has(id));

    // 1) Pointer threshold drag 1 -> optimistic turning -> cancel via Escape -> new held pointer drag -> old Promise 1 resolves
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
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 510,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 510,
    });

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(
      FOLD_COMMIT_T,
    );

    // Start new held pointer drag (pointerId 2) below the fold commit line.
    // From the still-open pose, the old rest-relative clientX 295 is already past t=0.46.
    const belowX = clientXFromCurrentPose(0.3);
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
      clientX: belowX,
      clientY: 640,
    });

    const heldProgress1 = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(heldProgress1).toBeGreaterThan(0);
    expect(heldProgress1).toBeLessThan(FOLD_COMMIT_T);
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
      clientX: belowX,
      clientY: 640,
    });
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(curlBtn.hasPointerCapture(2)).toBe(false);

    // 2) Pointer threshold drag 2 -> optimistic turning -> cancel via Escape -> new held pointer drag -> old Promise 2 rejects
    const commitFromSpringX = clientXFromCurrentPose(0.5);
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
      clientX: commitFromSpringX,
      clientY: 640,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: commitFromSpringX,
      clientY: 640,
    });

    expect(authState.signIn).toHaveBeenCalledTimes(2);
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');

    const belowX2 = clientXFromCurrentPose(0.3);
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
      clientX: belowX2,
      clientY: 640,
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
      clientX: belowX2,
      clientY: 640,
    });
    expect(authState.signIn).toHaveBeenCalledTimes(2);

    // 3) Touch threshold drag 3 -> cancel -> new held touch drag -> old Promise 3 resolves & Touch threshold drag 4 -> cancel -> new held touch drag -> old Promise 4 rejects
    const touchCommitX = clientXFromCurrentPose(0.5);
    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 0, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 0, clientX: touchCommitX, clientY: 640 }],
    });
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 0, clientX: touchCommitX, clientY: 640 }],
    });

    expect(authState.signIn).toHaveBeenCalledTimes(3);
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');

    fireEvent.click(screen.getByTestId('auth-pending-cancel-btn'));
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');

    const touchBelowX = clientXFromCurrentPose(0.3);
    const touchCommitAgainX = clientXFromCurrentPose(0.6);
    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 1, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 1, clientX: touchBelowX, clientY: 640 }],
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
      touches: [{ identifier: 1, clientX: touchCommitAgainX, clientY: 640 }],
    });
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 1, clientX: touchCommitAgainX, clientY: 640 }],
    });
    expect(authState.signIn).toHaveBeenCalledTimes(4);
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');

    fireEvent.keyDown(window, { key: 'Escape' });
    const touchBelowFinalX = clientXFromCurrentPose(0.3);
    fireEvent.touchStart(curlBtn, {
      touches: [{ identifier: 2, clientX: 360, clientY: 640 }],
    });
    fireEvent.touchMove(curlBtn, {
      touches: [{ identifier: 2, clientX: touchBelowFinalX, clientY: 640 }],
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');

    await act(async () => {
      rejectAttempt4(new Error('late network failure'));
    });

    expect(backdrop.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(touchHeldProgress);
    fireEvent.touchEnd(curlBtn, {
      changedTouches: [{ identifier: 2, clientX: touchBelowFinalX, clientY: 640 }],
    });
    expect(authState.signIn).toHaveBeenCalledTimes(4);
  });

  it('preserves a newer threshold optimistic turning state when an older canceled or timed-out Promise settles (both resolve and reject)', async () => {
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

    // Attempt 1 via threshold drag -> starts optimistic turn -> cancel via Escape
    fireEvent.pointerDown(curlBtn, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');

    // Attempt 2 via threshold drag -> let 12s timeout expire
    fireEvent.pointerDown(curlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');

    await act(async () => {
      vi.advanceTimersByTime(AUTH_PENDING_TIMEOUT_MS);
    });
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(0.99);

    // Attempt 3 via threshold drag -> now actively turning + pending auth
    fireEvent.pointerDown(curlBtn, { pointerId: 3, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });

    const pendingProgress = Number(backdrop.getAttribute('data-curl-progress'));
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');
    expect(pendingProgress).toBeGreaterThanOrEqual(FOLD_COMMIT_T);
    expect(screen.getByTestId('auth-turning-status')).toBeTruthy();
    expect(screen.getByTestId('auth-pending-cancel-btn')).toBeTruthy();

    // Settle both old Attempt 1 (reject) and old Attempt 2 (resolve) while Attempt 3 is pending
    await act(async () => {
      rejectOldAttempt1(new Error('stale attempt 1 rejection'));
      resolveOldAttempt2({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid' },
      });
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turning');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBe(pendingProgress);
    expect(screen.getByTestId('auth-turning-status')).toBeTruthy();
    expect(screen.queryByTestId('auth-error-alert')).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();

    // Now resolve active Attempt 3 with confirmed session and finish turn -> navigates once
    const confirmed = makeConfirmedSession();
    await act(async () => {
      resolveActiveAttempt3({
        data: { session: confirmed, user: confirmed.user },
        error: null,
      });
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
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
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
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
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 510 });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('awaiting-auth');

    // 3) Commit threshold drag 3 -> awaiting-auth (third deferred promise)
    fireEvent.pointerDown(curlBtn, { pointerId: 3, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 505 });
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 505 });
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

  it('starts the leaf turn immediately on a threshold drag with filled fields, joins with auth settlement in either order, and navigates only once after both complete', async () => {
    vi.useFakeTimers();

    // Case A: Auth resolves first, then PAGE_TURN_DURATION_MS elapses -> navigate once
    let resolveAuthA;
    authState.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAuthA = resolve;
        }),
    );

    const { unmount } = renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'optimistic-a@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });

    const curlBtnA = screen.getByTestId('auth-primary-surface');
    const backdropA = screen.getByTestId('auth-magazine-backdrop');
    const sheetA = screen.getByTestId('auth-magazine-sheet');

    fireEvent.pointerDown(curlBtnA, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtnA, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    const dragCutX = sheetA.getAttribute('data-cut-x-pct');
    const dragCutY = sheetA.getAttribute('data-cut-y-pct');
    const dragProgress = sheetA.getAttribute('data-curl-progress');

    fireEvent.pointerUp(curlBtnA, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });

    // Immediate optimistic turn on release, follow-through preserves curl geometry, signIn called once, no navigation yet
    expect(backdropA.getAttribute('data-turning-page')).toBe('true');
    expect(backdropA.getAttribute('data-curl-phase')).toBe('turning');
    expect(sheetA.className).toContain('mc-cover-sheet--turning');
    expect(sheetA.getAttribute('data-curl-progress')).toBe(dragProgress);
    expect(sheetA.getAttribute('data-cut-x-pct')).toBe(dragCutX);
    expect(sheetA.getAttribute('data-cut-y-pct')).toBe(dragCutY);
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(authState.signIn).toHaveBeenCalledWith('optimistic-a@example.com', 'secret123');
    expect(mockNavigate).not.toHaveBeenCalled();

    // Additional clicks or Enter while turning+submitting are rejected
    fireEvent.click(curlBtnA);
    fireEvent.submit(screen.getByTestId('auth-credentials-form'));
    expect(authState.signIn).toHaveBeenCalledTimes(1);

    // Auth resolves first while turn animation is still in flight -> still no navigation until turn finishes
    const sessionA = makeConfirmedSession();
    await act(async () => {
      resolveAuthA({
        data: { session: sessionA, user: sessionA.user },
        error: null,
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(backdropA.getAttribute('data-turning-page')).toBe('true');

    // Turn timer finishes -> navigates once
    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
    unmount();

    // Case B: Turn timer / animationend finishes first while auth is still pending, then auth resolves -> navigate once
    mockNavigate.mockClear();
    authState.signIn.mockClear();
    let resolveAuthB;
    authState.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAuthB = resolve;
        }),
    );

    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'optimistic-b@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret456' },
    });

    const curlBtnB = screen.getByTestId('auth-primary-surface');
    const backdropB = screen.getByTestId('auth-magazine-backdrop');
    fireEvent.pointerDown(curlBtnB, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtnB, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtnB, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });

    expect(backdropB.getAttribute('data-turning-page')).toBe('true');
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Leaf animationend and PAGE_TURN_DURATION_MS elapse while auth is still pending -> holds on static next page, no navigation yet
    await act(async () => {
      fireEvent.animationEnd(screen.getByTestId('auth-cover-leaf'));
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(backdropB.getAttribute('data-turning-page')).toBe('true');

    // Now auth resolves -> navigates immediately once
    const sessionB = makeConfirmedSession();
    await act(async () => {
      resolveAuthB({
        data: { session: sessionB, user: sessionB.user },
        error: null,
      });
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/charts', { replace: true });
  });

  it('aborts the optimistic drag turn and springs the leaf back when auth fails, times out, is cancelled, or sign-up requires email verification', async () => {
    vi.useFakeTimers();
    let rejectSignIn;
    let resolveTimedOutSignIn;
    let resolveVerifySignUp;

    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectSignIn = reject;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveTimedOutSignIn = resolve;
          }),
      )
      .mockImplementationOnce(() => new Promise(() => {}));

    authState.signUp.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveVerifySignUp = resolve;
        }),
    );

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const leaf = screen.getByTestId('auth-cover-leaf');

    fireEvent.change(emailInput, { target: { value: 'abort-cases@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // 1) Auth rejects while optimistic turn is in flight -> aborts turn, plays turn-abort springback, shows inline error, no navigation
    fireEvent.pointerDown(curlBtn, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    const foldXBeforeAbort = sheet.getAttribute('data-fold-x');
    const foldYBeforeAbort = sheet.getAttribute('data-fold-y');
    expect(foldXBeforeAbort).toBeTruthy();

    await act(async () => {
      rejectSignIn({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(sheet.className).toContain('mc-cover-sheet--turn-abort');
    expect(sheet.getAttribute('data-fold-x')).toBe(foldXBeforeAbort);
    expect(sheet.getAttribute('data-fold-y')).toBe(foldYBeforeAbort);
    expect(leaf.style.getPropertyValue('--mc-leaf-abort-from')).toBe('');
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('電子郵件或密碼不正確');
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_ABORT_DURATION_MS);
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');

    // 2) 12 s timeout while optimistic turn is in flight -> timeout error, abort, late resolve ignored
    fireEvent.pointerDown(curlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(AUTH_PENDING_TIMEOUT_MS);
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('登入等待逾時');
    expect(mockNavigate).not.toHaveBeenCalled();

    const lateSession = makeConfirmedSession();
    await act(async () => {
      resolveTimedOutSignIn({
        data: { session: lateSession, user: lateSession.user },
        error: null,
      });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');

    // 3) Static auth-pending-cancel-btn outside rotating leaf during optimistic turn -> cancels, aborts turn, shows cancel notice
    fireEvent.pointerDown(curlBtn, { pointerId: 3, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 3, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');

    const cancelBtns = screen.getAllByTestId('auth-pending-cancel-btn');
    expect(cancelBtns).toHaveLength(1);
    const staticCancelBtn = cancelBtns[0];
    expect(leaf.contains(staticCancelBtn)).toBe(false);
    expect(staticCancelBtn.disabled).toBe(false);
    expect(staticCancelBtn.inert).toBe(false);

    fireEvent.click(staticCancelBtn);
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(screen.getByTestId('auth-success-banner').textContent).toContain('已取消等待');
    expect(mockNavigate).not.toHaveBeenCalled();

    // 4) Sign-up via threshold drag without confirmed session (verify-email path) -> aborts turn and shows verify-email UI
    fireEvent.click(screen.getByTestId('auth-mode-switch-btn'));
    fireEvent.pointerDown(curlBtn, { pointerId: 4, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 4, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 4, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(authState.signUp).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVerifySignUp({
        data: { user: { id: 'u-verify', email: 'abort-cases@example.com' }, session: null },
        error: null,
      });
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(screen.getByTestId('auth-verify-email-panel').textContent).toContain(
      'abort-cases@example.com',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not start an optimistic turn on threshold drag when email or password is empty, snapping back and showing errorEmpty', () => {
    vi.useFakeTimers();
    renderAuth();

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');

    // 1) Both empty -> threshold drag snaps back without turning or calling signIn
    fireEvent.pointerDown(curlBtn, { pointerId: 1, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('springback');
    expect(Number(backdrop.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(
      FOLD_COMMIT_T,
    );
    expect(screen.getByTestId('auth-error-alert').textContent).toBe(
      i18n.t('auth.errorEmpty'),
    );

    act(() => {
      vi.advanceTimersByTime(FOLD_SPRING_MS);
    });
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');

    // 2) Email filled, password empty -> still snaps back without turning or calling signIn
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'only-email@example.com' },
    });
    fireEvent.pointerDown(curlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: FOLD_COMMIT_CLIENT_X, clientY: 500 });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('springback');
    expect(screen.getByTestId('auth-error-alert').textContent).toBe(
      i18n.t('auth.errorEmpty'),
    );
  });

  it('keeps button/Enter path as success -> turn -> enter without flashing an optimistic turn while pending or on wrong password', async () => {
    vi.useFakeTimers();
    let resolveWrongPass;
    let resolveSuccess;
    authState.signIn
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveWrongPass = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSuccess = resolve;
          }),
      );

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const primarySurface = screen.getByTestId('auth-primary-surface');
    const backdrop = screen.getByTestId('auth-magazine-backdrop');

    fireEvent.change(emailInput, { target: { value: 'btn-path@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrong-pass' } });

    // 1) Click primary surface (non-drag): stays in pending state (no optimistic turn), then shows error with no turn
    fireEvent.click(primarySurface);
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(screen.getByTestId('auth-submitting-status')).toBeTruthy();

    await act(async () => {
      resolveWrongPass({
        data: { session: null, user: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('false');
    expect(backdrop.getAttribute('data-curl-phase')).toBe('idle');
    expect(screen.getByTestId('auth-error-alert').textContent).toContain('電子郵件或密碼不正確');
    expect(mockNavigate).not.toHaveBeenCalled();

    // 2) Submit via Enter with valid password: no turn while pending, starts turn only after success, then navigates after turn
    fireEvent.change(passwordInput, { target: { value: 'correct-pass' } });
    fireEvent.keyDown(passwordInput, { key: 'Enter' });
    expect(backdrop.getAttribute('data-turning-page')).toBe('false');

    const session = makeConfirmedSession();
    await act(async () => {
      resolveSuccess({
        data: { session, user: session.user },
        error: null,
      });
    });

    expect(backdrop.getAttribute('data-turning-page')).toBe('true');
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows plain opaque paper-back texture on the curled flap (no mirrored UI stickers/frames), clips front overlay along the crease, and tracks pointer vs keyboard focus modality', async () => {
    vi.useFakeTimers();
    let resolveSignIn;
    authState.signIn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    renderAuth();
    const emailInput = screen.getByTestId('auth-email-input');
    const passwordInput = screen.getByTestId('auth-password-input');
    const forgotBtn = screen.getByTestId('auth-forgot-password-link');
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const loginOverlay = screen.getByTestId('auth-login-overlay');
    const sheet = screen.getByTestId('auth-magazine-sheet');

    fireEvent.change(emailInput, { target: { value: 'flap-type@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    // 1) At idle rest: no flap-type layer, no curl-clipping class, keyboard Tab sets keyboard focus modality
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(screen.queryByTestId('auth-flap-type')).toBeNull();
    expect(loginOverlay.getAttribute('data-curl-clipping')).toBe('false');
    expect(loginOverlay.className).not.toContain('mc-login-overlay--curl-clipping');
    expect(forgotBtn.disabled).toBe(false);
    expect(curlBtn.style.clipPath).toBe('');

    fireEvent.keyDown(curlBtn, { key: 'Tab' });
    expect(curlBtn.getAttribute('data-focus-modality')).toBe('keyboard');

    // 2) Drag corner open past threshold: pointerDown sets data-focus-modality="pointer",
    //    flap-type layer mounts as plain paper back (no mirrored button/label/frame copy),
    //    and clips front overlay rows while keeping curlBtn unclipped
    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      clientX: 360,
      clientY: 640,
    });
    expect(curlBtn.getAttribute('data-focus-modality')).toBe('pointer');

    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 500,
    });

    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    const flapType = screen.getByTestId('auth-flap-type');
    expect(flapType.getAttribute('aria-hidden')).toBe('true');
    expect(flapType.className).toContain('pointer-events-none');
    expect(flapType.style.clipPath).toContain('polygon(');
    expect(flapType.children).toHaveLength(0);
    expect(flapType.textContent).toBe('');
    expect(screen.queryByTestId('auth-flap-type-reflect')).toBeNull();
    expect(screen.queryByTestId('auth-flap-forgot-password')).toBeNull();
    expect(screen.queryByTestId('auth-flap-corner-cue')).toBeNull();
    expect(loginOverlay.getAttribute('data-curl-clipping')).toBe('true');
    expect(loginOverlay.className).toContain('mc-login-overlay--curl-clipping');
    expect(curlBtn.style.clipPath).toBe('');

    // 3) Release past threshold -> follow-through leaf turn keeps flap-type layer mounted
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 500,
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('turning');
    expect(screen.getByTestId('auth-flap-type')).toBeTruthy();

    // Cancel pending turn -> returns to idle after abort -> flap-type unmounts cleanly
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sheet.getAttribute('data-curl-phase')).toBe('turn-abort');
    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_ABORT_DURATION_MS);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(screen.queryByTestId('auth-flap-type')).toBeNull();
    expect(loginOverlay.getAttribute('data-curl-clipping')).toBe('false');

    // Blur clears focus modality attribute
    fireEvent.blur(curlBtn);
    expect(curlBtn.getAttribute('data-focus-modality')).toBeNull();

    // Clean up pending mock promise
    await act(async () => {
      resolveSignIn({ data: { session: null, user: null }, error: null });
    });

    // 4) Under prefers-reduced-motion: visual curl stays at rest -> no flap-type motion during drag
    cleanup();
    setReducedMotion(true);
    renderAuth();
    const rmCurlBtn = screen.getByTestId('auth-primary-surface');
    fireEvent.pointerDown(rmCurlBtn, { pointerId: 2, clientX: 360, clientY: 640 });
    fireEvent.pointerMove(rmCurlBtn, { pointerId: 2, clientX: 150, clientY: 500 });
    expect(screen.queryByTestId('auth-flap-type')).toBeNull();
    expect(screen.getByTestId('auth-login-overlay').getAttribute('data-curl-clipping')).toBe(
      'false',
    );
    fireEvent.pointerCancel(rmCurlBtn, { pointerId: 2 });

    // 5) CSS contract: no 3D hinge keyframes; reduced-motion fade remains; pointer modality hides the focus ring
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/theme/journal.css'),
      'utf8',
    );
    expect(css).not.toContain('mc-leaf-back-turn');
    expect(css).not.toContain('mc-leaf-back-turn-abort');
    expect(css).not.toContain('rotateY(-180deg)');
    expect(css).not.toContain('cubic-bezier(0.37, 0.08, 0.32, 0.96)');
    expect(css).not.toContain('translateX(100%) rotateY(-180deg)');
    expect(css).toContain('@keyframes mc-leaf-fade-out');
    expect(css).toContain('.mc-cover-sheet--fade .mc-cover-leaf');
    expect(css).toContain('.mc-primary-corner-surface[data-focus-modality="pointer"]:focus-visible');
    expect(css).toContain('.mc-cover-leaf--held-open');
    expect(css).toContain('pointer-events: none');
  });

  it('springs back without submit when a finger fold is released below t=0.46', () => {
    vi.useFakeTimers();
    renderAuth();
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const belowX = Math.round(clientXForFoldProgress(0.3));
    const pose = fingerToFold({
      W: 480,
      H: 656,
      dx: belowX - FOLD_DRAG_START_X,
      dy: 0,
    });
    expect(foldProgress(480, pose.x)).toBeLessThan(FOLD_COMMIT_T);

    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: belowX, clientY: 640 });
    fireEvent.pointerUp(curlBtn, { pointerId: 1, clientX: belowX, clientY: 640 });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeLessThan(FOLD_COMMIT_T);
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThan(0.2);

    act(() => {
      vi.advanceTimersByTime(FOLD_SPRING_MS);
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
  });

  it('does not submit while the finger drags back and forth, and commits once on release past t=0.46', () => {
    vi.useFakeTimers();
    let resolveSignIn;
    authState.signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'forth@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const retreatX = Math.round(clientXForFoldProgress(0.25));

    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 640,
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(FOLD_COMMIT_T);
    expect(authState.signIn).not.toHaveBeenCalled();

    fireEvent.pointerMove(curlBtn, { pointerId: 1, clientX: retreatX, clientY: 640 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeLessThan(FOLD_COMMIT_T);
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(FOLD_FLING_T);
    expect(authState.signIn).not.toHaveBeenCalled();

    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 640,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 640,
    });
    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(sheet.getAttribute('data-curl-phase')).toBe('turning');

    resolveSignIn({ data: { session: null, user: null }, error: null });
  });

  it('commits a leftward fling once t is at least 0.2 even when t is still below 0.46', () => {
    vi.useFakeTimers();
    let resolveSignIn;
    authState.signIn.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'fling@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const flingX = Math.round(clientXForFoldProgress(0.28));
    const pose = fingerToFold({
      W: 480,
      H: 656,
      dx: flingX - FOLD_DRAG_START_X,
      dy: 0,
    });
    expect(foldProgress(480, pose.x)).toBeGreaterThanOrEqual(FOLD_FLING_T);
    expect(foldProgress(480, pose.x)).toBeLessThan(FOLD_COMMIT_T);
    const vx = (flingX - (FOLD_DRAG_START_X - 20)) / 40;
    expect(vx).toBeLessThanOrEqual(FOLD_FLING_VX);

    let now = 5000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    fireEvent.pointerDown(curlBtn, {
      pointerId: 4,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    now = 5000;
    fireEvent.pointerMove(curlBtn, {
      pointerId: 4,
      clientX: FOLD_DRAG_START_X - 20,
      clientY: 640,
    });
    now = 5040;
    fireEvent.pointerMove(curlBtn, { pointerId: 4, clientX: flingX, clientY: 640 });
    fireEvent.pointerUp(curlBtn, { pointerId: 4, clientX: flingX, clientY: 640 });
    spy.mockRestore();

    expect(authState.signIn).toHaveBeenCalledTimes(1);
    expect(sheet.getAttribute('data-curl-phase')).toBe('turning');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeLessThan(FOLD_COMMIT_T);

    resolveSignIn({ data: { session: null, user: null }, error: null });
  });

  it('holds the opened page without navigating while auth is pending, and a later failure closes from that pose', async () => {
    vi.useFakeTimers();
    let rejectSignIn;
    authState.signIn.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectSignIn = reject;
        }),
    );
    renderAuth();
    fireEvent.change(screen.getByTestId('auth-email-input'), {
      target: { value: 'held@example.com' },
    });
    fireEvent.change(screen.getByTestId('auth-password-input'), {
      target: { value: 'secret123' },
    });
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const leaf = screen.getByTestId('auth-cover-leaf');

    fireEvent.pointerDown(curlBtn, {
      pointerId: 1,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, {
      pointerId: 1,
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 640,
    });
    fireEvent.pointerUp(curlBtn, {
      pointerId: 1,
      clientX: FOLD_COMMIT_CLIENT_X,
      clientY: 640,
    });

    await act(async () => {
      vi.advanceTimersByTime(FOLD_OPEN_COMMIT_MS);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('turning');
    expect(Number(sheet.getAttribute('data-curl-progress'))).toBeGreaterThanOrEqual(0.99);
    expect(leaf.className).toContain('mc-cover-leaf--held-open');
    const cancel = screen.getByTestId('auth-pending-cancel-btn');
    expect(cancel.className).toContain('pointer-events-auto');
    const openX = sheet.getAttribute('data-fold-x');

    fireEvent.click(cancel);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('turn-abort');
    expect(sheet.getAttribute('data-fold-x')).toBe(openX);

    await act(async () => {
      vi.advanceTimersByTime(Math.max(FOLD_CLOSE_MS, PAGE_TURN_ABORT_DURATION_MS));
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      rejectSignIn({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    });
  });

  it('fires onTurnAnimationEnd once when a button-path fold reaches the open end', async () => {
    vi.useFakeTimers();
    const onTurnAnimationEnd = vi.fn();
    const viewProps = {
      email: 'once@example.com',
      password: 'secret123',
      onTurnAnimationEnd,
    };
    const { rerender } = render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, viewProps),
      ),
    );
    rerender(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MagazineCoverView, { ...viewProps, turningPage: true }),
      ),
    );

    await act(async () => {
      vi.advanceTimersByTime(FOLD_OPEN_BUTTON_MS + 40);
    });
    expect(onTurnAnimationEnd).toHaveBeenCalledTimes(1);
    const leaf = screen.getByTestId('auth-cover-leaf');
    expect(onTurnAnimationEnd.mock.calls[0][0].target).toBe(leaf);
    expect(onTurnAnimationEnd.mock.calls[0][0].currentTarget).toBe(leaf);

    await act(async () => {
      vi.advanceTimersByTime(PAGE_TURN_DURATION_MS);
    });
    expect(onTurnAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it('keeps a finite decreasing curl and the flap polygon while a below-threshold fold springs closed', async () => {
    vi.useFakeTimers();
    renderAuth();
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const belowX = Math.round(clientXForFoldProgress(0.32));
    expect(screen.queryByTestId('auth-fold-paint')).toBeNull();

    fireEvent.pointerDown(curlBtn, {
      pointerId: 7,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, { pointerId: 7, clientX: belowX, clientY: 620 });
    fireEvent.pointerUp(curlBtn, { pointerId: 7, clientX: belowX, clientY: 620 });

    expect(authState.signIn).not.toHaveBeenCalled();
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    const paint = screen.getByTestId('auth-fold-paint');
    expect(paint.className).toContain('mc-fold-paint');
    const clip = screen.getByTestId('auth-fold-sheet-clip');
    expect(clip.getAttribute('x')).toBe('0');
    expect(clip.getAttribute('y')).toBe('0');
    expect(Number(clip.getAttribute('width'))).toBeGreaterThan(40);
    expect(Number(clip.getAttribute('height'))).toBeGreaterThan(40);
    const svg = screen.getByTestId('auth-curl-geometry-svg');
    expect(paint.contains(svg)).toBe(true);
    expect(svg.getAttribute('overflow')).toBe('hidden');
    expect(svg.querySelector('g').getAttribute('clip-path')).toBe('url(#mc-fold-sheet-clip)');

    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/theme/journal.css'),
      'utf8',
    );
    const paintRule = css.match(/(?:^|\n)\.mc-fold-paint\s*\{([^}]*)\}/);
    expect(paintRule).toBeTruthy();
    expect(paintRule[1]).toContain('overflow: hidden');
    expect(paintRule[1]).toContain('border-radius: inherit');
    expect(paintRule[1]).toContain('clip-path: inset(0 round 4px 10px 14px 4px)');
    expect(css).toMatch(/\.mc-fold-svg\s*\{[^}]*overflow:\s*hidden/);

    const fullSheetClip = 'polygon(0.00px 0.00px, 480.00px 0.00px, 480.00px 656.00px, 0.00px 656.00px)';
    const samples = [];
    for (let i = 0; i < 40; i += 1) {
      const phase = sheet.getAttribute('data-curl-phase');
      const raw = sheet.getAttribute('data-curl-progress');
      expect(raw).not.toBe('NaN');
      expect(raw.includes('NaN')).toBe(false);
      const value = Number(raw);
      expect(Number.isFinite(value)).toBe(true);
      samples.push({ phase, value });
      if (phase === 'springback') {
        const points = screen.getByTestId('auth-curl-backface').getAttribute('points');
        expect(points.split(/[ ,]/).filter(Boolean).length).toBeGreaterThanOrEqual(6);
        const frontClip = screen.getByTestId('auth-leaf-front').style.clipPath;
        expect(frontClip.startsWith('polygon(')).toBe(true);
        expect(frontClip.includes('NaN')).toBe(false);
        expect(frontClip).not.toBe(fullSheetClip);
        expect(paint.contains(screen.getByTestId('auth-curl-backface'))).toBe(true);
      }
      if (phase === 'idle') break;
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }

    const springSamples = samples.filter((sample) => sample.phase === 'springback');
    expect(springSamples.length).toBeGreaterThanOrEqual(3);
    expect(samples[samples.length - 1].phase).toBe('idle');
    expect(samples[samples.length - 1].value).toBe(0);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i].value).toBeLessThanOrEqual(samples[i - 1].value + 1e-9);
    }
    expect(springSamples[springSamples.length - 1].value).toBeLessThan(springSamples[0].value);
    expect(screen.queryByTestId('auth-fold-paint')).toBeNull();
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
  });

  it('re-grabs a mid-spring pose without jumping back to the rest corner', () => {
    vi.useFakeTimers();
    renderAuth();
    const curlBtn = screen.getByTestId('auth-primary-surface');
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const belowX = Math.round(clientXForFoldProgress(0.34));

    fireEvent.pointerDown(curlBtn, {
      pointerId: 8,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, { pointerId: 8, clientX: belowX, clientY: 640 });
    fireEvent.pointerUp(curlBtn, { pointerId: 8, clientX: belowX, clientY: 640 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    const releaseX = Number(sheet.getAttribute('data-fold-x'));

    act(() => {
      vi.advanceTimersByTime(96);
    });

    const midX = Number(sheet.getAttribute('data-fold-x'));
    const midY = Number(sheet.getAttribute('data-fold-y'));
    const rest = restFoldPoint(480, 656);
    expect(Number.isFinite(midX)).toBe(true);
    expect(Number.isFinite(midY)).toBe(true);
    expect(midX).toBeGreaterThan(releaseX + 30);
    expect(midX).toBeLessThan(rest.x - 20);
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    const grabX = 180;
    const grabY = 640;
    fireEvent.pointerDown(curlBtn, { pointerId: 9, clientX: grabX, clientY: grabY });
    expect(sheet.getAttribute('data-fold-x')).toBe(midX.toFixed(2));
    expect(sheet.getAttribute('data-fold-y')).toBe(midY.toFixed(2));

    fireEvent.pointerMove(curlBtn, {
      pointerId: 9,
      clientX: grabX - 7,
      clientY: grabY,
    });

    const nextX = Number(sheet.getAttribute('data-fold-x'));
    const nextY = Number(sheet.getAttribute('data-fold-y'));
    expect(Number.isFinite(nextX)).toBe(true);
    expect(Number.isFinite(nextY)).toBe(true);
    expect(nextX).toBeCloseTo(midX + FINGER_GAIN_X * -7, 1);
    expect(nextY).toBeCloseTo(midY + FINGER_GAIN_Y * 0, 1);
    expect(Math.abs(nextX - (rest.x + FINGER_GAIN_X * -7))).toBeGreaterThan(30);
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(sheet.getAttribute('data-curl-progress')).not.toBe('NaN');
    expect(Number.isFinite(Number(sheet.getAttribute('data-curl-progress')))).toBe(true);
  });

  it('re-grabs a mid-spring pose from the fold grab layer and ignores the leaf at rest', () => {
    vi.useFakeTimers();
    renderAuth();
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const leaf = screen.getByTestId('auth-cover-leaf');
    expect(screen.queryByTestId('auth-fold-grab')).toBeNull();

    fireEvent.pointerDown(leaf, { pointerId: 1, button: 0, clientX: 28, clientY: 36 });
    fireEvent.pointerMove(leaf, { pointerId: 1, clientX: 12, clientY: 36 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(sheet.getAttribute('data-curl-progress')).toBe('0');
    expect(screen.queryByTestId('auth-fold-grab')).toBeNull();

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const belowX = Math.round(clientXForFoldProgress(0.34));
    fireEvent.pointerDown(curlBtn, {
      pointerId: 2,
      button: 0,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: belowX, clientY: 640 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: belowX, clientY: 640 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    const releaseX = Number(sheet.getAttribute('data-fold-x'));

    act(() => {
      vi.advanceTimersByTime(96);
    });
    const midX = Number(sheet.getAttribute('data-fold-x'));
    const midY = Number(sheet.getAttribute('data-fold-y'));
    const rest = restFoldPoint(480, 656);
    expect(midX).toBeGreaterThan(releaseX + 30);
    expect(midX).toBeLessThan(rest.x - 20);
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    fireEvent.pointerDown(screen.getByTestId('auth-email-input'), {
      pointerId: 3,
      button: 0,
      clientX: 80,
      clientY: 420,
    });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(sheet.getAttribute('data-fold-x')).toBe(midX.toFixed(2));

    expect(screen.getByTestId('auth-fold-grab')).toBeTruthy();
    const grab = screen.getByTestId('auth-fold-grab-flap');
    expect(screen.getByTestId('auth-fold-grab-handle')).toBeTruthy();
    const grabX = 170;
    const grabY = 520;
    fireEvent.pointerDown(grab, { pointerId: 4, button: 0, clientX: grabX, clientY: grabY });
    expect(sheet.getAttribute('data-fold-x')).toBe(midX.toFixed(2));
    expect(sheet.getAttribute('data-fold-y')).toBe(midY.toFixed(2));
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    fireEvent.pointerMove(grab, {
      pointerId: 4,
      clientX: grabX - 7,
      clientY: grabY,
    });
    const nextX = Number(sheet.getAttribute('data-fold-x'));
    const nextY = Number(sheet.getAttribute('data-fold-y'));
    expect(nextX).toBeCloseTo(midX + FINGER_GAIN_X * -7, 1);
    expect(nextY).toBeCloseTo(midY + FINGER_GAIN_Y * 0, 1);
    expect(Math.abs(nextX - (rest.x + FINGER_GAIN_X * -7))).toBeGreaterThan(30);
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');

    fireEvent.pointerUp(grab, { pointerId: 4, clientX: grabX - 7, clientY: grabY });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');

    act(() => {
      vi.advanceTimersByTime(48);
    });
    const againX = Number(sheet.getAttribute('data-fold-x'));
    const againY = Number(sheet.getAttribute('data-fold-y'));
    // The bound left spine / remaining front is not a handle mid-close.
    fireEvent.pointerDown(leaf, { pointerId: 5, button: 0, clientX: 48, clientY: 64 });
    expect(sheet.getAttribute('data-fold-x')).toBe(againX.toFixed(2));
    fireEvent.pointerMove(leaf, { pointerId: 5, clientX: 12, clientY: 64 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(sheet.getAttribute('data-fold-x')).toBe(againX.toFixed(2));
    expect(sheet.getAttribute('data-fold-y')).toBe(againY.toFixed(2));
  });

  it('cannot begin a drag from the left spine at rest or mid-turn', () => {
    vi.useFakeTimers();
    renderAuth();
    const sheet = screen.getByTestId('auth-magazine-sheet');
    const leaf = screen.getByTestId('auth-cover-leaf');
    const restProgress = sheet.getAttribute('data-curl-progress');

    fireEvent.pointerDown(leaf, { pointerId: 1, button: 0, clientX: 8, clientY: 320 });
    fireEvent.pointerMove(leaf, { pointerId: 1, clientX: 80, clientY: 280 });
    fireEvent.pointerUp(leaf, { pointerId: 1, clientX: 80, clientY: 280 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('idle');
    expect(sheet.getAttribute('data-curl-progress')).toBe(restProgress);

    const curlBtn = screen.getByTestId('auth-primary-surface');
    const belowX = Math.round(clientXForFoldProgress(0.34));
    fireEvent.pointerDown(curlBtn, {
      pointerId: 2,
      button: 0,
      clientX: FOLD_DRAG_START_X,
      clientY: 640,
    });
    fireEvent.pointerMove(curlBtn, { pointerId: 2, clientX: belowX, clientY: 640 });
    fireEvent.pointerUp(curlBtn, { pointerId: 2, clientX: belowX, clientY: 640 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    const midX = sheet.getAttribute('data-fold-x');
    const midY = sheet.getAttribute('data-fold-y');

    fireEvent.pointerDown(leaf, { pointerId: 3, button: 0, clientX: 10, clientY: 400 });
    fireEvent.pointerMove(leaf, { pointerId: 3, clientX: 90, clientY: 300 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('springback');
    expect(sheet.getAttribute('data-fold-x')).toBe(midX);
    expect(sheet.getAttribute('data-fold-y')).toBe(midY);

    const grab = screen.getByTestId('auth-fold-grab-flap');
    fireEvent.pointerDown(grab, { pointerId: 4, button: 0, clientX: 180, clientY: 520 });
    fireEvent.pointerMove(grab, { pointerId: 4, clientX: 173, clientY: 520 });
    expect(sheet.getAttribute('data-curl-phase')).toBe('dragging');
    expect(Number(sheet.getAttribute('data-fold-x'))).toBeLessThan(Number(midX) - 5);
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
