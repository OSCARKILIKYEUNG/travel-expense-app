import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MagazineCoverView from './MagazineCoverView';
import {
  PAGE_TURN_ABORT_DURATION_MS,
  PAGE_TURN_DURATION_MS,
} from './foldGeometry';
import {
  DEFAULT_LOGIN_COVER_HEADLINE,
  LOGIN_COVER_HEADLINE_MODES,
  findLoginCover,
  pickLoginCover,
} from './loginCovers';

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
  const coverParam = (params.get('cover') || 'random').trim().toLowerCase();
  const headlineParam = (params.get('headline') || '').trim().toLowerCase();
  const coverHeadline = LOGIN_COVER_HEADLINE_MODES.includes(headlineParam)
    ? headlineParam
    : DEFAULT_LOGIN_COVER_HEADLINE;
  const [coverImage] = useState(() => {
    if (coverParam === 'none') return null;
    if (coverParam === 'random') return pickLoginCover();
    return findLoginCover(coverParam) || pickLoginCover();
  });

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
  const [turnAborting, setTurnAborting] = useState(false);
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
  const submitLockRef = useRef(initialState === 'submitting');
  const interactiveTurnRef = useRef(
    initialState === 'turning' || initialState === 'success',
  );
  const optimisticTurnRef = useRef(false);
  const authSucceededRef = useRef(
    initialState === 'turning' ||
      initialState === 'success' ||
      initialState === 'reduced-motion' ||
      initialState === 'success-complete',
  );
  const turnFinishedRef = useRef(
    initialState === 'reduced-motion' || initialState === 'success-complete',
  );
  const pendingTimerRef = useRef(null);
  const turnTimerRef = useRef(null);
  const abortTimerRef = useRef(null);
  const lateTimersRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestIdRef.current = null;
      submitLockRef.current = false;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      if (abortTimerRef.current) clearTimeout(abortTimerRef.current);
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

  const clearTurnTimer = () => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  };

  const clearAbortTimer = () => {
    if (abortTimerRef.current) {
      clearTimeout(abortTimerRef.current);
      abortTimerRef.current = null;
    }
  };

  const maybeCompleteMockTurn = () => {
    if (!mountedRef.current || !authSucceededRef.current || !turnFinishedRef.current) {
      return;
    }
    clearTurnTimer();
    setMockTurnCompleted(true);
  };

  const startMockTurn = ({ optimistic = false } = {}) => {
    if (!mountedRef.current) return;
    clearTurnTimer();
    clearAbortTimer();
    setTurnAborting(false);
    interactiveTurnRef.current = true;
    optimisticTurnRef.current = optimistic;
    authSucceededRef.current = !optimistic;
    turnFinishedRef.current = false;
    setTurningPage(true);
    turnTimerRef.current = setTimeout(() => {
      turnTimerRef.current = null;
      if (!mountedRef.current || !interactiveTurnRef.current) return;
      turnFinishedRef.current = true;
      maybeCompleteMockTurn();
    }, PAGE_TURN_DURATION_MS);
  };

  const abortMockTurn = () => {
    clearTurnTimer();
    clearAbortTimer();
    interactiveTurnRef.current = false;
    optimisticTurnRef.current = false;
    authSucceededRef.current = false;
    turnFinishedRef.current = false;
    if (!mountedRef.current) return;
    setTurningPage(false);
    setTurnAborting(true);
    abortTimerRef.current = setTimeout(() => {
      abortTimerRef.current = null;
      if (!mountedRef.current) return;
      setTurnAborting(false);
    }, PAGE_TURN_ABORT_DURATION_MS);
  };

  const handleCancelPending = () => {
    if (
      activeRequestIdRef.current === null &&
      !submitting &&
      !oauthGoogleLoading &&
      !optimisticTurnRef.current
    ) {
      return;
    }
    clearPendingTimer();
    activeRequestIdRef.current = null;
    submitLockRef.current = false;
    if (optimisticTurnRef.current || interactiveTurnRef.current) {
      abortMockTurn();
    }
    setSubmitting(false);
    setOauthGoogleLoading(false);
    setInlineError('');
    setInlineSuccess(t('auth.cancelPendingNotice'));
  };

  const handleDragThresholdCommit = () => {
    if (
      submitLockRef.current ||
      activeRequestIdRef.current !== null ||
      submitting ||
      turningPage ||
      interactiveTurnRef.current ||
      oauthGoogleLoading
    ) {
      return false;
    }
    setInlineError('');
    setInlineSuccess('');
    if (!email.trim() || !password) {
      setInlineError(t('auth.errorEmpty'));
      return false;
    }
    startMockTurn({ optimistic: true });
    return true;
  };

  const handleFakeSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const isGestureCommit = Boolean(e && e.gestureCommit);
    const alreadyOptimistic = isGestureCommit && optimisticTurnRef.current;
    if (
      submitLockRef.current ||
      activeRequestIdRef.current !== null ||
      submitting ||
      (!alreadyOptimistic && (turningPage || interactiveTurnRef.current)) ||
      oauthGoogleLoading
    ) {
      return false;
    }
    setInlineError('');
    setInlineSuccess('');
    if (!email.trim() || !password) {
      if (optimisticTurnRef.current || interactiveTurnRef.current) {
        abortMockTurn();
      }
      setInlineError(t('auth.errorEmpty'));
      return false;
    }

    if (isGestureCommit && !alreadyOptimistic) {
      startMockTurn({ optimistic: true });
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
      submitLockRef.current = true;
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
          submitLockRef.current = false;
          pendingTimerRef.current = null;
          if (optimisticTurnRef.current || interactiveTurnRef.current) {
            abortMockTurn();
          }
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
                submitLockRef.current = false;
                if (optimisticTurnRef.current || interactiveTurnRef.current) {
                  abortMockTurn();
                }
                setInlineError(t('auth.errorInvalidCredentials'));
                resolve(false);
                return;
              }
              authSucceededRef.current = true;
              if (interactiveTurnRef.current) {
                maybeCompleteMockTurn();
              } else {
                startMockTurn({ optimistic: false });
              }
              resolve(true);
              return;
            }
            resolve(false);
          }, delayMs);
          lateTimersRef.current.add(timerId);
        });
      }

      return new Promise(() => {});
    }

    const abortIfOptimistic = () => {
      if (optimisticTurnRef.current || interactiveTurnRef.current) {
        abortMockTurn();
      }
    };

    if (outcomeParam === 'error') {
      abortIfOptimistic();
      setInlineError(t('auth.errorInvalidCredentials'));
      return false;
    }
    if (outcomeParam === 'offline') {
      abortIfOptimistic();
      setInlineError(t('auth.errorOffline'));
      return false;
    }
    if (outcomeParam === 'rate-limit') {
      abortIfOptimistic();
      setInlineError(t('auth.errorRateLimit'));
      return false;
    }
    if (outcomeParam === 'no-session') {
      abortIfOptimistic();
      setInlineError(t('auth.errorNoSession'));
      return false;
    }

    authSucceededRef.current = true;
    if (interactiveTurnRef.current) {
      maybeCompleteMockTurn();
    } else {
      startMockTurn({ optimistic: false });
    }
    return true;
  };

  return (
    <MagazineCoverView
      coverImage={coverImage}
      coverHeadline={coverHeadline}
      supabaseConfigured={initialState !== 'config-missing'}
      authLoading={initialState === 'loading'}
      mode={mode}
      email={email}
      password={password}
      submitting={submitting}
      turningPage={turningPage}
      turnAborting={turnAborting}
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
      onDragThresholdCommit={handleDragThresholdCommit}
      onCancelPending={handleCancelPending}
      onTurnAnimationEnd={(e) => {
        if (e && e.target !== e.currentTarget) return;
        if (!interactiveTurnRef.current) {
          if (turnAborting) {
            clearAbortTimer();
            setTurnAborting(false);
          }
          return;
        }
        turnFinishedRef.current = true;
        maybeCompleteMockTurn();
      }}
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
