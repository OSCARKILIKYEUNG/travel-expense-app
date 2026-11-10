import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MagazineCoverView from './MagazineCoverView';

/**
 * Isolated DEV-only presentation/mock visual harness around `MagazineCoverView`.
 * - Gated by `import.meta.env.DEV` in `src/main.jsx` (`/?devAuth=1`).
 * - Never mounts `App`, `AuthProvider`, `RequireAuth`, `AppProvider`, or `supabaseClient`.
 * - Pure presentation/mock harness only (NOT real `Auth` controller E2E; real controller
 *   lifecycle is unit-tested separately in `src/pages/Auth.test.js`).
 */
export default function AuthDevHarness() {
  const { t, i18n } = useTranslation();
  const params = new URLSearchParams(window.location.search);
  const initialLang = params.get('lang') === 'en' ? 'en' : 'zh-TW';
  const initialState = params.get('state') || 'ready';
  const outcomeParam = params.get('outcome') || 'success';
  const timeoutMsParam = Number(params.get('timeoutMs') || 0);
  const lateMsParam = Number(params.get('lateMs') || 0);
  const initialCurlParam = Number(params.get('curl') || 0);
  const initialReducedMotion =
    params.get('motion') === 'reduce' || initialState === 'reduced-motion';

  const [mode, setMode] = useState(initialState === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState(
    params.get('email') ??
      (initialState === 'ready' ? '' : 'kamakura.reader@example.com'),
  );
  const [password, setPassword] = useState(
    initialState === 'ready' ? '' : 'mock-password-only',
  );
  const [submitting, setSubmitting] = useState(initialState === 'submitting');
  const [turningPage, setTurningPage] = useState(
    initialState === 'turning' || initialState === 'success',
  );
  const [reducedMotion] = useState(initialReducedMotion);
  const [pendingEmail, setPendingEmail] = useState(
    initialState === 'verify-email' ? 'kamakura.reader@example.com' : '',
  );
  const [pendingPasswordReset, setPendingPasswordReset] = useState(
    initialState === 'reset-sent',
  );
  const [showForgotPassword, setShowForgotPassword] = useState(
    initialState === 'forgot',
  );
  const [resendCooldown, setResendCooldown] = useState(0);
  const [oauthGoogleLoading, setOauthGoogleLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [mockTurnCompleted, setMockTurnCompleted] = useState(
    initialState === 'reduced-motion' || initialState === 'success-complete',
  );
  const errorRef = useRef(null);
  const mountedRef = useRef(true);
  const requestSeqRef = useRef(initialState === 'submitting' ? 1 : 0);
  const activeRequestIdRef = useRef(initialState === 'submitting' ? 1 : null);
  const pendingTimerRef = useRef(null);
  const lateTimersRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestIdRef.current = null;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      lateTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      lateTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (i18n.language !== initialLang) {
      i18n.changeLanguage(initialLang);
    }
  }, [i18n, initialLang]);

  useEffect(() => {
    if (initialState === 'error') {
      setInlineError(t('auth.errorInvalidCredentials'));
    } else if (initialState === 'offline') {
      setInlineError(t('auth.errorOffline'));
    } else if (initialState === 'rate-limit') {
      setInlineError(t('auth.errorRateLimit'));
    } else if (initialState === 'no-session') {
      setInlineError(t('auth.errorNoSession'));
    } else if (initialState === 'timeout') {
      setInlineError(t('auth.errorTimeout'));
    } else if (initialState === 'verify-email') {
      setInlineSuccess(t('auth.verifyEmailSent'));
    } else {
      setInlineError('');
      setInlineSuccess('');
    }
  }, [initialState, initialLang, t]);

  useEffect(() => {
    if (inlineError && errorRef.current && typeof errorRef.current.focus === 'function') {
      errorRef.current.focus();
    }
  }, [inlineError]);

  const bannerText =
    String(i18n.language || '').startsWith('en')
      ? `DEV MOCK HARNESS (state: ${initialState}) — PURE PRESENTATION MOCK / NO REAL AUTH`
      : `DEV MOCK 視覺測試模式（狀態：${initialState}）— 純展示模擬／無真實登入連線`;

  const clearPendingTimer = () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  };

  const handleCancelPending = () => {
    if (activeRequestIdRef.current === null && !submitting && !oauthGoogleLoading) {
      return;
    }
    clearPendingTimer();
    activeRequestIdRef.current = null;
    setSubmitting(false);
    setOauthGoogleLoading(false);
    setInlineError('');
    setInlineSuccess(t('auth.cancelPendingNotice'));
  };

  const handleFakeSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (submitting || turningPage || oauthGoogleLoading) return;
    setInlineError('');
    setInlineSuccess('');
    if (!email.trim() || !password) {
      setInlineError(t('auth.errorEmpty'));
      return;
    }
    if (
      outcomeParam === 'pending' ||
      outcomeParam === 'timeout' ||
      outcomeParam === 'late-success' ||
      outcomeParam === 'late-error'
    ) {
      clearPendingTimer();
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      activeRequestIdRef.current = requestId;
      setSubmitting(true);

      const effectiveTimeoutMs =
        timeoutMsParam > 0
          ? timeoutMsParam
          : outcomeParam === 'timeout'
            ? 200
            : 0;
      if (effectiveTimeoutMs > 0) {
        pendingTimerRef.current = setTimeout(() => {
          if (!mountedRef.current || activeRequestIdRef.current !== requestId) return;
          activeRequestIdRef.current = null;
          pendingTimerRef.current = null;
          setSubmitting(false);
          setInlineSuccess('');
          setInlineError(t('auth.errorTimeout'));
        }, effectiveTimeoutMs);
      }

      if (outcomeParam === 'late-success' || outcomeParam === 'late-error') {
        const delayMs = lateMsParam > 0 ? lateMsParam : 350;
        return new Promise((resolve) => {
          const timerId = setTimeout(() => {
            lateTimersRef.current.delete(timerId);
            if (mountedRef.current && activeRequestIdRef.current === requestId) {
              clearPendingTimer();
              activeRequestIdRef.current = null;
              setSubmitting(false);
              if (outcomeParam === 'late-error') {
                setInlineError(t('auth.errorInvalidCredentials'));
              } else if (reducedMotion) {
                setMockTurnCompleted(true);
                setInlineSuccess(t('auth.turningPage'));
              } else {
                setTurningPage(true);
              }
            }
            resolve();
          }, delayMs);
          lateTimersRef.current.add(timerId);
        });
      }

      return new Promise(() => {});
    }
    if (outcomeParam === 'error') {
      setInlineError(t('auth.errorInvalidCredentials'));
      return;
    }
    if (outcomeParam === 'offline') {
      setInlineError(t('auth.errorOffline'));
      return;
    }
    if (outcomeParam === 'rate-limit') {
      setInlineError(t('auth.errorRateLimit'));
      return;
    }
    if (outcomeParam === 'no-session') {
      setInlineError(t('auth.errorNoSession'));
      return;
    }
    if (reducedMotion) {
      setMockTurnCompleted(true);
      setInlineSuccess(t('auth.turningPage'));
      return;
    }
    setTurningPage(true);
  };

  return (
    <MagazineCoverView
      supabaseConfigured={initialState !== 'config-missing'}
      authLoading={initialState === 'loading'}
      mode={mode}
      email={email}
      password={password}
      submitting={submitting}
      turningPage={turningPage}
      reducedMotion={reducedMotion}
      inlineError={inlineError}
      inlineSuccess={
        mockTurnCompleted && !inlineSuccess ? t('auth.turningPage') : inlineSuccess
      }
      pendingEmail={pendingEmail}
      pendingPasswordReset={pendingPasswordReset}
      showForgotPassword={showForgotPassword}
      resendCooldown={resendCooldown}
      oauthGoogleLoading={oauthGoogleLoading}
      errorRef={errorRef}
      mockBanner={bannerText}
      initialCurlProgress={Number.isFinite(initialCurlParam) ? initialCurlParam : 0}
      onModeChange={(next) => {
        setMode(next);
        setShowForgotPassword(false);
        setInlineError('');
      }}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleFakeSubmit}
      onPageCurlSubmit={handleFakeSubmit}
      onCancelPending={handleCancelPending}
      onTurnAnimationEnd={() => setMockTurnCompleted(true)}
      onGoogleSignIn={() => {
        if (submitting || turningPage || oauthGoogleLoading) return;
        clearPendingTimer();
        const requestId = requestSeqRef.current + 1;
        requestSeqRef.current = requestId;
        activeRequestIdRef.current = requestId;
        setOauthGoogleLoading(true);
        const timerId = setTimeout(() => {
          lateTimersRef.current.delete(timerId);
          if (!mountedRef.current || activeRequestIdRef.current !== requestId) return;
          activeRequestIdRef.current = null;
          setOauthGoogleLoading(false);
        }, 300);
        lateTimersRef.current.add(timerId);
      }}
      onForgotSubmit={(e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!email.trim()) {
          setInlineError(t('auth.errorEmptyEmail'));
          return;
        }
        setPendingPasswordReset(true);
        setShowForgotPassword(false);
      }}
      onShowForgotPassword={() => {
        setShowForgotPassword(true);
        setInlineError('');
      }}
      onBackFromForgot={() => {
        setShowForgotPassword(false);
        setInlineError('');
      }}
      onResend={() => {
        setInlineSuccess(t('auth.resendOk'));
        setResendCooldown(60);
      }}
      onBackFromPendingEmail={() => {
        setPendingEmail('');
        setInlineSuccess('');
        setInlineError('');
        setResendCooldown(0);
      }}
      onResendReset={() => {
        setInlineSuccess(t('auth.forgotPasswordResendOk'));
        setResendCooldown(60);
      }}
      onBackFromReset={() => {
        setPendingPasswordReset(false);
        setInlineSuccess('');
        setInlineError('');
        setResendCooldown(0);
      }}
    />
  );
}
