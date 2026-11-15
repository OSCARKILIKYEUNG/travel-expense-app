import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MagazineCoverView from '../components/auth/MagazineCoverView';
import {
  DEFAULT_LOGIN_COVER_HEADLINE,
  pickLoginCover,
} from '../components/auth/loginCovers';
import { useAuth } from '../context/AuthContext';
import { formatAuthError, hasConfirmedSession } from '../lib/authErrors';
import {
  getPrefersReducedMotion,
  usePrefersReducedMotion,
} from '../motion/usePrefersReducedMotion';
import {
  ACCESSIBLE_CROSSFADE_MS,
  PAGE_TURN_ABORT_DURATION_MS,
  PAGE_TURN_DURATION_MS,
} from '../components/auth/foldGeometry';

export { ACCESSIBLE_CROSSFADE_MS, PAGE_TURN_ABORT_DURATION_MS, PAGE_TURN_DURATION_MS };
export const AUTH_PENDING_TIMEOUT_MS = 12000;

export default function Auth({ pendingTimeoutMs = AUTH_PENDING_TIMEOUT_MS } = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location?.state?.from?.pathname || '/';
  const reducedMotion = usePrefersReducedMotion();

  const {
    supabaseConfigured,
    session,
    user,
    loading: authLoading,
    signIn,
    signUp,
    resendSignUpEmail,
    signInWithGoogle,
    resetPasswordForEmail,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [coverImage] = useState(() => pickLoginCover());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turningPage, setTurningPage] = useState(false);
  const [turnAborting, setTurnAborting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [oauthGoogleLoading, setOauthGoogleLoading] = useState(false);

  const mountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const activeRequestIdRef = useRef(null);
  const subViewEpochRef = useRef(0);
  const pendingTimerRef = useRef(null);
  const abandonedAttemptRef = useRef(false);
  const submitLockRef = useRef(false);
  const interactiveTurnRef = useRef(false);
  const optimisticTurnRef = useRef(false);
  const authSucceededRef = useRef(false);
  const turnFinishedRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const turnTimerRef = useRef(null);
  const abortTimerRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const errorRef = useRef(null);

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);

  const clearAbortTimer = useCallback(() => {
    if (abortTimerRef.current) {
      clearTimeout(abortTimerRef.current);
      abortTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRequestIdRef.current = null;
      subViewEpochRef.current += 1;
      submitLockRef.current = false;
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      if (turnTimerRef.current) clearTimeout(turnTimerRef.current);
      if (abortTimerRef.current) clearTimeout(abortTimerRef.current);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (inlineError && errorRef.current && typeof errorRef.current.focus === 'function') {
      errorRef.current.focus();
    }
  }, [inlineError]);

  const completeTurnNavigation = useCallback(() => {
    clearTurnTimer();
    if (!mountedRef.current || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    navigate(from, { replace: true });
  }, [clearTurnTimer, from, navigate]);

  const maybeNavigate = useCallback(() => {
    if (
      !mountedRef.current ||
      hasNavigatedRef.current ||
      abandonedAttemptRef.current ||
      !authSucceededRef.current ||
      !turnFinishedRef.current
    ) {
      return;
    }
    completeTurnNavigation();
  }, [completeTurnNavigation]);

  // Existing confirmed session (or OAuth return with confirmed session) skips repeat login & animation.
  // If a local client attempt was cancelled or timed out (abandonedAttemptRef.current === true),
  // a late provider session arriving in AuthContext must NOT auto-navigate unexpectedly;
  // the user remains on the cover until they take an explicit next action.
  useEffect(() => {
    if (
      authLoading ||
      submitting ||
      oauthGoogleLoading ||
      activeRequestIdRef.current !== null ||
      abandonedAttemptRef.current ||
      interactiveTurnRef.current ||
      optimisticTurnRef.current ||
      hasNavigatedRef.current
    ) {
      return;
    }
    if (hasConfirmedSession({ session, user })) {
      hasNavigatedRef.current = true;
      navigate(from, { replace: true });
    }
  }, [authLoading, submitting, oauthGoogleLoading, session, user, from, navigate]);

  const startOptimisticTurn = useCallback(() => {
    if (!mountedRef.current) return;
    clearTurnTimer();
    clearAbortTimer();
    setTurnAborting(false);
    interactiveTurnRef.current = true;
    optimisticTurnRef.current = true;
    authSucceededRef.current = false;
    // The finger already holds the real end pose. Do not wait out a peel.
    turnFinishedRef.current = true;
    setTurningPage(true);
  }, [clearAbortTimer, clearTurnTimer]);

  const startReducedManualTurn = useCallback(() => {
    if (!mountedRef.current) return;
    clearTurnTimer();
    clearAbortTimer();
    setTurnAborting(false);
    interactiveTurnRef.current = true;
    optimisticTurnRef.current = true;
    authSucceededRef.current = false;
    // Reduced motion keeps the leaf at rest and crossfades. A fast signIn
    // must not navigate until that 200ms finishes.
    turnFinishedRef.current = false;
    setTurningPage(true);
    turnTimerRef.current = setTimeout(() => {
      turnTimerRef.current = null;
      if (!mountedRef.current || !interactiveTurnRef.current) return;
      turnFinishedRef.current = true;
      maybeNavigate();
    }, ACCESSIBLE_CROSSFADE_MS);
  }, [clearAbortTimer, clearTurnTimer, maybeNavigate]);

  const beginGestureTurn = useCallback(
    (payload) => {
      const crossfade = Boolean(
        (payload && payload.reducedMotion) || reducedMotion || getPrefersReducedMotion(),
      );
      if (crossfade) startReducedManualTurn();
      else startOptimisticTurn();
    },
    [reducedMotion, startOptimisticTurn, startReducedManualTurn],
  );

  const startInteractiveSuccessTransition = useCallback(() => {
    if (!mountedRef.current) return;
    clearTurnTimer();
    clearAbortTimer();
    setTurnAborting(false);
    interactiveTurnRef.current = true;
    optimisticTurnRef.current = false;
    authSucceededRef.current = true;
    turnFinishedRef.current = false;
    setTurningPage(true);
    turnTimerRef.current = setTimeout(() => {
      turnTimerRef.current = null;
      if (!mountedRef.current || !interactiveTurnRef.current) return;
      turnFinishedRef.current = true;
      maybeNavigate();
    }, ACCESSIBLE_CROSSFADE_MS);
  }, [clearAbortTimer, clearTurnTimer, maybeNavigate]);

  const abortOptimisticTurn = useCallback(() => {
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
  }, [clearAbortTimer, clearTurnTimer]);

  const handleTurnAnimationEnd = useCallback(
    (e) => {
      if (e && e.target !== e.currentTarget) return;
      if (!interactiveTurnRef.current) {
        if (turnAborting) {
          clearAbortTimer();
          setTurnAborting(false);
        }
        return;
      }
      turnFinishedRef.current = true;
      maybeNavigate();
    },
    [clearAbortTimer, maybeNavigate, turnAborting],
  );

  const beginClientRequest = useCallback(
    (kind = 'submit') => {
      clearPendingTimer();
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      activeRequestIdRef.current = requestId;
      submitLockRef.current = true;
      if (kind === 'google') {
        setOauthGoogleLoading(true);
      } else {
        setSubmitting(true);
      }
      pendingTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
          return;
        }
        activeRequestIdRef.current = null;
        submitLockRef.current = false;
        abandonedAttemptRef.current = true;
        pendingTimerRef.current = null;
        if (optimisticTurnRef.current || interactiveTurnRef.current) {
          abortOptimisticTurn();
        }
        setSubmitting(false);
        setOauthGoogleLoading(false);
        setInlineSuccess('');
        setInlineError(t('auth.errorTimeout'));
      }, pendingTimeoutMs);
      return requestId;
    },
    [abortOptimisticTurn, clearPendingTimer, pendingTimeoutMs, t],
  );

  const handleCancelPendingAuth = useCallback(() => {
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
    abandonedAttemptRef.current = true;
    if (optimisticTurnRef.current || interactiveTurnRef.current) {
      abortOptimisticTurn();
    }
    if (!mountedRef.current) return;
    setSubmitting(false);
    setOauthGoogleLoading(false);
    setInlineError('');
    setInlineSuccess(t('auth.cancelPendingNotice'));
  }, [abortOptimisticTurn, clearPendingTimer, submitting, oauthGoogleLoading, t]);

  const handleDragThresholdCommit = (payload) => {
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
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setInlineError(t('auth.errorEmpty'));
      return false;
    }
    beginGestureTurn(payload);
    return true;
  };

  // Single guarded submit shared by form Enter, explicit submit button, and >=44px corner page-curl button
  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
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
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      if (optimisticTurnRef.current || interactiveTurnRef.current) {
        abortOptimisticTurn();
      }
      setInlineError(t('auth.errorEmpty'));
      return false;
    }

    if (isGestureCommit && !alreadyOptimistic) {
      beginGestureTurn(e);
    }

    // Deliberate reconciliation: if a prior client attempt was cancelled/timed out locally
    // and the auth provider later established a confirmed session in AuthContext for this user,
    // the user's explicit next submit action uses that confirmed session without claiming server abort.
    if (
      mode === 'signin' &&
      abandonedAttemptRef.current &&
      hasConfirmedSession({ session, user }) &&
      (!session?.user?.email ||
        session.user.email.toLowerCase() === trimmedEmail.toLowerCase())
    ) {
      abandonedAttemptRef.current = false;
      submitLockRef.current = true;
      authSucceededRef.current = true;
      if (interactiveTurnRef.current) {
        maybeNavigate();
      } else {
        startInteractiveSuccessTransition();
      }
      return true;
    }

    const requestId = beginClientRequest('submit');
    try {
      if (mode === 'signin') {
        const signInResult = await signIn(trimmedEmail, password);
        if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
          return false;
        }
        clearPendingTimer();
        if (signInResult?.error) {
          if (optimisticTurnRef.current || interactiveTurnRef.current) {
            abortOptimisticTurn();
          }
          setInlineError(formatAuthError(signInResult.error, t));
          return false;
        }
        if (!hasConfirmedSession({ session, user, signInResult })) {
          if (optimisticTurnRef.current || interactiveTurnRef.current) {
            abortOptimisticTurn();
          }
          setInlineError(t('auth.errorNoSession'));
          return false;
        }
        abandonedAttemptRef.current = false;
        authSucceededRef.current = true;
        if (interactiveTurnRef.current) {
          maybeNavigate();
        } else {
          startInteractiveSuccessTransition();
        }
        return true;
      }

      const signUpResult = await signUp(trimmedEmail, password);
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return false;
      }
      clearPendingTimer();
      if (signUpResult?.error) {
        if (optimisticTurnRef.current || interactiveTurnRef.current) {
          abortOptimisticTurn();
        }
        setInlineError(formatAuthError(signUpResult.error, t));
        return false;
      }
      if (hasConfirmedSession({ session, user, signInResult: signUpResult })) {
        abandonedAttemptRef.current = false;
        authSucceededRef.current = true;
        if (interactiveTurnRef.current) {
          maybeNavigate();
        } else {
          startInteractiveSuccessTransition();
        }
        return true;
      }
      if (optimisticTurnRef.current || interactiveTurnRef.current) {
        abortOptimisticTurn();
      }
      abandonedAttemptRef.current = false;
      setPendingEmail(trimmedEmail);
      setInlineSuccess(t('auth.verifyEmailSent'));
      return false;
    } catch (err) {
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return false;
      }
      clearPendingTimer();
      if (optimisticTurnRef.current || interactiveTurnRef.current) {
        abortOptimisticTurn();
      }
      setInlineError(formatAuthError(err, t));
      return false;
    } finally {
      if (mountedRef.current && activeRequestIdRef.current === requestId) {
        clearPendingTimer();
        activeRequestIdRef.current = null;
        setSubmitting(false);
        if (!interactiveTurnRef.current && !hasNavigatedRef.current) {
          submitLockRef.current = false;
        }
      }
    }
  };

  // Google OAuth: keep standard redirect flow; no optimistic drag turn applies here.
  const handleGoogleSignIn = async () => {
    if (
      submitLockRef.current ||
      activeRequestIdRef.current !== null ||
      submitting ||
      turningPage ||
      interactiveTurnRef.current ||
      oauthGoogleLoading
    ) {
      return;
    }
    setInlineError('');
    setInlineSuccess('');
    const requestId = beginClientRequest('google');
    try {
      const result = await signInWithGoogle();
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return;
      }
      clearPendingTimer();
      if (result?.error) {
        setInlineError(formatAuthError(result.error, t));
        setOauthGoogleLoading(false);
        activeRequestIdRef.current = null;
        submitLockRef.current = false;
      }
    } catch (err) {
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return;
      }
      clearPendingTimer();
      setInlineError(formatAuthError(err, t));
      setOauthGoogleLoading(false);
      activeRequestIdRef.current = null;
      submitLockRef.current = false;
    }
  };

  const startResendCooldown = (subViewEpoch = subViewEpochRef.current) => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    setResendCooldown(60);
    cooldownTimerRef.current = setInterval(() => {
      if (!mountedRef.current || subViewEpochRef.current !== subViewEpoch) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
        return;
      }
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const handleForgotSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (
      submitLockRef.current ||
      activeRequestIdRef.current !== null ||
      submitting ||
      turningPage ||
      oauthGoogleLoading
    ) {
      return;
    }
    setInlineError('');
    setInlineSuccess('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setInlineError(t('auth.errorEmptyEmail'));
      return;
    }
    const requestId = beginClientRequest('forgot');
    try {
      const result = await resetPasswordForEmail(trimmedEmail);
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return;
      }
      clearPendingTimer();
      if (result?.error) {
        setInlineError(formatAuthError(result.error, t));
        return;
      }
      abandonedAttemptRef.current = false;
      subViewEpochRef.current += 1;
      setForgotPasswordEmail(trimmedEmail);
      setPendingPasswordReset(true);
      setShowForgotPassword(false);
    } catch (err) {
      if (!mountedRef.current || activeRequestIdRef.current !== requestId) {
        return;
      }
      clearPendingTimer();
      setInlineError(formatAuthError(err, t));
    } finally {
      if (mountedRef.current && activeRequestIdRef.current === requestId) {
        clearPendingTimer();
        activeRequestIdRef.current = null;
        setSubmitting(false);
        submitLockRef.current = false;
      }
    }
  };

  const handleResendReset = async () => {
    if (!forgotPasswordEmail || resendCooldown > 0) return;
    const subViewEpoch = subViewEpochRef.current;
    setInlineError('');
    setInlineSuccess('');
    try {
      const result = await resetPasswordForEmail(forgotPasswordEmail);
      if (!mountedRef.current || subViewEpochRef.current !== subViewEpoch) {
        return;
      }
      if (result?.error) {
        setInlineError(formatAuthError(result.error, t));
        return;
      }
      setInlineSuccess(t('auth.forgotPasswordResendOk'));
      startResendCooldown(subViewEpoch);
    } catch (err) {
      if (!mountedRef.current || subViewEpochRef.current !== subViewEpoch) {
        return;
      }
      setInlineError(formatAuthError(err, t));
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0) return;
    const subViewEpoch = subViewEpochRef.current;
    setInlineError('');
    setInlineSuccess('');
    try {
      const result = await resendSignUpEmail(pendingEmail);
      if (!mountedRef.current || subViewEpochRef.current !== subViewEpoch) {
        return;
      }
      if (result?.error) {
        setInlineError(formatAuthError(result.error, t));
        return;
      }
      setInlineSuccess(t('auth.resendOk'));
      startResendCooldown(subViewEpoch);
    } catch (err) {
      if (!mountedRef.current || subViewEpochRef.current !== subViewEpoch) {
        return;
      }
      setInlineError(formatAuthError(err, t));
    }
  };

  return (
    <MagazineCoverView
      coverImage={coverImage}
      coverHeadline={DEFAULT_LOGIN_COVER_HEADLINE}
      supabaseConfigured={supabaseConfigured}
      authLoading={authLoading}
      mode={mode}
      email={email}
      password={password}
      submitting={submitting}
      turningPage={turningPage}
      turnAborting={turnAborting}
      reducedMotion={Boolean(reducedMotion || getPrefersReducedMotion())}
      inlineError={inlineError}
      inlineSuccess={inlineSuccess}
      pendingEmail={pendingEmail}
      pendingPasswordReset={pendingPasswordReset}
      showForgotPassword={showForgotPassword}
      resendCooldown={resendCooldown}
      oauthGoogleLoading={oauthGoogleLoading}
      errorRef={errorRef}
      onModeChange={(nextMode) => {
        subViewEpochRef.current += 1;
        setMode(nextMode);
        setShowForgotPassword(false);
        setInlineError('');
        setInlineSuccess('');
      }}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={handleSubmit}
      onPageCurlSubmit={handleSubmit}
      onDragThresholdCommit={handleDragThresholdCommit}
      onCancelPending={handleCancelPendingAuth}
      onTurnAnimationEnd={handleTurnAnimationEnd}
      onGoogleSignIn={handleGoogleSignIn}
      onForgotSubmit={handleForgotSubmit}
      onShowForgotPassword={() => {
        subViewEpochRef.current += 1;
        setShowForgotPassword(true);
        setInlineError('');
        setInlineSuccess('');
      }}
      onBackFromForgot={() => {
        subViewEpochRef.current += 1;
        setShowForgotPassword(false);
        setInlineError('');
      }}
      onResend={handleResend}
      onBackFromPendingEmail={() => {
        subViewEpochRef.current += 1;
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
        setPendingEmail('');
        setInlineSuccess('');
        setInlineError('');
        setResendCooldown(0);
      }}
      onResendReset={handleResendReset}
      onBackFromReset={() => {
        subViewEpochRef.current += 1;
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
        setPendingPasswordReset(false);
        setForgotPasswordEmail('');
        setInlineSuccess('');
        setInlineError('');
        setResendCooldown(0);
      }}
    />
  );
}
