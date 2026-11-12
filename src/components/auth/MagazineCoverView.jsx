import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';
import { DEFAULT_LOGIN_COVER_HEADLINE } from './loginCovers';

export const CURL_COMMIT_THRESHOLD = 0.55;
export const CURL_REST_AMOUNT = 0.12;
export const DRAG_INTENT_DEADZONE_PX = 6;

/**
 * Pure geometric helper computing the continuous bottom-right paper corner fold
 * from gesture progress (0..1).
 * - At rest (progress = 0), keeps a natural curled-corner cue (CURL_REST_AMOUNT).
 * - Under prefers-reduced-motion, skips interpolated fold movement while
 *   preserving logical progress for threshold evaluation.
 */
export function computeCurlGeometry(
  progress = 0,
  { turningPage = false, reducedMotion = false, phase = 'idle' } = {},
) {
  const clampedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  let visualCurl = CURL_REST_AMOUNT;

  if (reducedMotion) {
    visualCurl = CURL_REST_AMOUNT;
  } else if (phase === 'awaiting-auth' && !turningPage) {
    visualCurl = Math.max(
      0.56,
      CURL_REST_AMOUNT + clampedProgress * (1 - CURL_REST_AMOUNT),
    );
  } else {
    visualCurl = CURL_REST_AMOUNT + clampedProgress * (1 - CURL_REST_AMOUNT);
  }

  const cutX = Number((7.5 + visualCurl * 58).toFixed(2));
  const cutY = Number((1.8 + visualCurl * 42).toFixed(2));
  const foldBottomX = Number((100 - cutX).toFixed(2));
  const foldRightY = Number((100 - cutY).toFixed(2));
  const apexX = Number((100 - cutX * 0.92).toFixed(2));
  const apexY = Number((100 - cutY * 0.92).toFixed(2));
  const shadowApexX = Number(Math.max(0, apexX - 2.4 - visualCurl * 4.5).toFixed(2));
  const shadowApexY = Number(Math.max(0, apexY - 1.2 - visualCurl * 3.8).toFixed(2));

  return {
    progress: Number(clampedProgress.toFixed(3)),
    visualCurl: Number(visualCurl.toFixed(3)),
    thresholdMet: clampedProgress >= CURL_COMMIT_THRESHOLD,
    cutX,
    cutY,
    foldBottomX,
    foldRightY,
    apexX,
    apexY,
    coverClipPath: `polygon(0% 0%, 100% 0%, 100% ${foldRightY}%, ${foldBottomX}% 100%, 0% 100%)`,
    flapPoints: `${apexX},${apexY} 100,${foldRightY} ${foldBottomX},100`,
    shadowPoints: `${shadowApexX},${shadowApexY} 100,${foldRightY} 100,100 ${foldBottomX},100`,
  };
}

/**
 * Pure presentational Full-Bleed Magazine-Cover Login view (Phase 1, Round 3).
 * - One full-bleed scenic cover with editorial login controls directly over
 *   scenic negative space (no separate beige bottom form card).
 * - Bottom-right paper corner supports real continuous pointer + touch drag
 *   curl geometry, below-threshold springback, safe pointercancel/lostcapture,
 *   and an accessible non-gesture keyboard/AT equivalent.
 * - Zero imports of AuthContext or supabaseClient.
 */
export default function MagazineCoverView({
  supabaseConfigured = true,
  authLoading = false,
  mode = 'signin',
  email = '',
  password = '',
  submitting = false,
  turningPage = false,
  reducedMotion = false,
  inlineError = '',
  inlineSuccess = '',
  pendingEmail = '',
  pendingPasswordReset = false,
  showForgotPassword = false,
  resendCooldown = 0,
  oauthGoogleLoading = false,
  errorRef = null,
  mockBanner = null,
  initialCurlProgress = 0,
  coverImage = null,
  coverHeadline = DEFAULT_LOGIN_COVER_HEADLINE,
  onModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onPageCurlSubmit,
  onCancelPending,
  onTurnAnimationEnd,
  onGoogleSignIn,
  onForgotSubmit,
  onShowForgotPassword,
  onBackFromForgot,
  onResend,
  onBackFromPendingEmail,
  onResendReset,
  onBackFromReset,
}) {
  const { t, i18n } = useTranslation();
  const isBusy = submitting || turningPage || oauthGoogleLoading;
  const isPendingAuth = (submitting || oauthGoogleLoading) && !turningPage;
  const currentSubView = pendingPasswordReset
    ? 'reset-sent'
    : pendingEmail
      ? 'verify-email'
      : showForgotPassword
        ? 'forgot'
        : 'credentials';
  const currentLang = String(i18n?.language || 'zh-TW');
  const bilingualPlaceholderLabel = currentLang.startsWith('zh')
    ? `${t('auth.sceneryPlaceholderBadge')} · Placeholder — not final artwork`
    : `${t('auth.sceneryPlaceholderBadge')} · 暫代示範插畫（非最終完成圖）`;
  const hasCoverImage = Boolean(coverImage && coverImage.src);
  const effectiveHeadlineMode =
    hasCoverImage && coverHeadline === 'painted' ? 'painted' : 'html';
  const activeCityHeadline =
    hasCoverImage && coverImage.city
      ? String(coverImage.city).toUpperCase()
      : 'KAMAKURA';
  const activeStampLabel = hasCoverImage
    ? `${activeCityHeadline} · 01`
    : '鎌倉印 · 01';
  const activeLeftVerticalCaption = hasCoverImage
    ? '日本・旅途手札'
    : '鎌倉・湘南海岸線';

  const clampedInitialCurl = Math.max(0, Math.min(1, Number(initialCurlProgress) || 0));
  const [curlProgress, setCurlProgress] = useState(clampedInitialCurl);
  const [curlPhase, setCurlPhase] = useState(
    clampedInitialCurl > 0 ? 'dragging' : 'idle',
  );
  const [lastPointerType, setLastPointerType] = useState('');
  const [submitCount, setSubmitCount] = useState(0);
  const [lastSubmitSource, setLastSubmitSource] = useState('');

  const sheetRef = useRef(null);
  const overlayRef = useRef(null);
  const primarySurfaceRef = useRef(null);
  const turningStatusRef = useRef(null);
  const submittingStatusRef = useRef(null);
  const pendingCancelBtnRef = useRef(null);
  const internalErrorRef = useRef(null);
  const lastInteractiveControlRef = useRef(null);
  const wasBusyRef = useRef(isBusy);
  const prevSubViewRef = useRef(currentSubView);
  const wasSubmittingRef = useRef(submitting);
  const prevInlineErrorRef = useRef(inlineError);
  const mountedRef = useRef(true);
  const interactionEpochRef = useRef(0);
  const suppressClickSeqRef = useRef(0);
  const formEnterSeqRef = useRef(0);
  const springTimerRef = useRef(null);
  const suppressClickTimerRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const cancelledPointerIdRef = useRef(null);
  const formEnterHandledRef = useRef(false);
  const liveStateRef = useRef({ turningPage, submitting, oauthGoogleLoading });
  liveStateRef.current = { turningPage, submitting, oauthGoogleLoading };

  const advanceInteractionEpoch = () => {
    const nextEpoch = interactionEpochRef.current + 1;
    interactionEpochRef.current = nextEpoch;
    return nextEpoch;
  };

  const setErrorAlertNode = (node) => {
    internalErrorRef.current = node;
    if (typeof errorRef === 'function') {
      errorRef(node);
    } else if (errorRef && typeof errorRef === 'object') {
      errorRef.current = node;
    }
  };

  const dragSessionRef = useRef({
    active: false,
    epoch: 0,
    source: '',
    pointerId: null,
    pointerType: '',
    startX: 0,
    startY: 0,
    hasDragIntent: false,
    progress: clampedInitialCurl,
  });

  const releaseCornerPointerCapture = (
    pointerId = null,
    source = dragSessionRef.current.source,
  ) => {
    if (source && source !== 'pointer') return;
    const btn = primarySurfaceRef.current;
    const targetId = pointerId ?? dragSessionRef.current.pointerId;
    if (!btn || targetId === null || targetId === undefined) return;
    if (typeof btn.releasePointerCapture === 'function') {
      try {
        if (typeof btn.hasPointerCapture !== 'function' || btn.hasPointerCapture(targetId)) {
          btn.releasePointerCapture(targetId);
        }
      } catch {
        // Safe ignore in environments without active pointer capture
      }
    }
  };

  const getEnabledOverlayControls = () => {
    if (!overlayRef.current) return [];
    return Array.from(
      overlayRef.current.querySelectorAll('input:not(:disabled), button:not(:disabled)'),
    ).filter((el) => !el.inert && !el.closest('[inert]') && el.tabIndex >= 0);
  };

  const moveFocusFromAbandonedDrag = (shiftKey = false) => {
    const controls = getEnabledOverlayControls();
    if (controls.length === 0) return;
    const currentIdx = controls.indexOf(primarySurfaceRef.current);
    let nextTarget = controls[0];
    if (currentIdx !== -1) {
      const nextIdx = shiftKey
        ? (currentIdx - 1 + controls.length) % controls.length
        : (currentIdx + 1) % controls.length;
      nextTarget = controls[nextIdx];
    }
    if (nextTarget && typeof nextTarget.focus === 'function') {
      nextTarget.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      interactionEpochRef.current += 1;
      suppressClickSeqRef.current += 1;
      formEnterSeqRef.current += 1;
      dragSessionRef.current.active = false;
      dragSessionRef.current.hasDragIntent = false;
      dragSessionRef.current.pointerId = null;
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      if (suppressClickTimerRef.current) {
        clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
      suppressNextClickRef.current = false;
      formEnterHandledRef.current = false;
    };
  }, []);

  const clearSuppressNextClick = () => {
    suppressClickSeqRef.current += 1;
    suppressNextClickRef.current = false;
    if (suppressClickTimerRef.current) {
      clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
  };

  const armSuppressNextClick = (windowMs = 320) => {
    const token = suppressClickSeqRef.current + 1;
    suppressClickSeqRef.current = token;
    suppressNextClickRef.current = true;
    if (suppressClickTimerRef.current) {
      clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || suppressClickSeqRef.current !== token) {
        return;
      }
      suppressNextClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, windowMs);
  };

  const invokeSubmit = (payloadOrEvent, sourceLabel = 'tap') => {
    const submitFn = onPageCurlSubmit || onSubmit;
    setLastSubmitSource(sourceLabel);
    setSubmitCount((c) => c + 1);
    if (!submitFn) return undefined;
    return submitFn(payloadOrEvent);
  };

  const handleCancelPending = () => {
    if (!isPendingAuth) return;
    advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    dragSessionRef.current.active = false;
    dragSessionRef.current.hasDragIntent = false;
    dragSessionRef.current.pointerId = null;
    dragSessionRef.current.progress = 0;
    setCurlProgress(0);
    setCurlPhase('idle');
    if (typeof onCancelPending === 'function') {
      onCancelPending();
    }
  };

  // Sync when initialCurlProgress prop changes (e.g. DEV harness inspection)
  useEffect(() => {
    const epoch = advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    const next = Math.max(0, Math.min(1, Number(initialCurlProgress) || 0));
    dragSessionRef.current.epoch = epoch;
    dragSessionRef.current.progress = next;
    setCurlProgress(next);
    setCurlPhase(next > 0 ? 'dragging' : 'idle');
  }, [initialCurlProgress]);

  // Synchronize DOM .inert property + attribute across form/panels and their descendant controls
  // while keeping the pending cancel/recovery action OUTSIDE the inert form interactive.
  useEffect(() => {
    if (isBusy && dragSessionRef.current.active) {
      advanceInteractionEpoch();
      releaseCornerPointerCapture(
        dragSessionRef.current.pointerId,
        dragSessionRef.current.source,
      );
      dragSessionRef.current.active = false;
      dragSessionRef.current.hasDragIntent = false;
      dragSessionRef.current.pointerId = null;
      dragSessionRef.current.progress = 0;
    }
    const root = overlayRef.current;
    if (!root) return;
    const containers = root.querySelectorAll(
      '[data-testid="auth-credentials-form"], [data-testid="auth-forgot-form"], [data-testid="auth-verify-email-panel"], [data-testid="auth-reset-sent-panel"]',
    );
    containers.forEach((node) => {
      node.inert = Boolean(isBusy);
      if (isBusy) {
        node.setAttribute('inert', '');
      } else {
        node.removeAttribute('inert');
      }
      const controls = node.querySelectorAll('input, button');
      controls.forEach((ctrl) => {
        ctrl.inert = Boolean(isBusy);
        if (isBusy) {
          ctrl.setAttribute('inert', '');
        } else {
          ctrl.removeAttribute('inert');
        }
      });
    });
    if (pendingCancelBtnRef.current) {
      pendingCancelBtnRef.current.inert = false;
      pendingCancelBtnRef.current.removeAttribute('inert');
    }
  }, [isBusy, isPendingAuth, mode, showForgotPassword, pendingEmail, pendingPasswordReset]);

  // When turningPage activates or auth finishes with error/idle, sync curl phase & deliberate focus handoff
  useEffect(() => {
    const wasSubmitting = wasSubmittingRef.current;
    const prevInlineError = prevInlineErrorRef.current;
    wasSubmittingRef.current = submitting;
    prevInlineErrorRef.current = inlineError;

    if (turningPage) {
      advanceInteractionEpoch();
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }
      setCurlPhase('turning');
    } else if (
      curlPhase === 'awaiting-auth' &&
      ((inlineError && inlineError !== prevInlineError) || (wasSubmitting && !submitting))
    ) {
      advanceInteractionEpoch();
      setCurlProgress(0);
      setCurlPhase('idle');
    }
  }, [turningPage, submitting, inlineError, curlPhase]);

  useEffect(() => {
    const wasBusy = wasBusyRef.current;
    const prevSubView = prevSubViewRef.current;
    wasBusyRef.current = isBusy;
    prevSubViewRef.current = currentSubView;

    if (turningPage) {
      if (turningStatusRef.current && typeof turningStatusRef.current.focus === 'function') {
        turningStatusRef.current.focus({ preventScroll: true });
      }
      return;
    }

    if (isPendingAuth) {
      if (submittingStatusRef.current && typeof submittingStatusRef.current.focus === 'function') {
        submittingStatusRef.current.focus({ preventScroll: true });
      }
      return;
    }

    if (inlineError) {
      if (internalErrorRef.current && typeof internalErrorRef.current.focus === 'function') {
        internalErrorRef.current.focus({ preventScroll: true });
      }
      return;
    }

    if (wasBusy || prevSubView !== currentSubView) {
      if (dragSessionRef.current.active) return;
      const root = overlayRef.current;
      if (!root) return;
      if (currentSubView === 'forgot') {
        const forgotInput = root.querySelector('[data-testid="auth-forgot-email-input"]');
        if (forgotInput && typeof forgotInput.focus === 'function') {
          forgotInput.focus({ preventScroll: true });
          return;
        }
      }
      if (currentSubView === 'verify-email') {
        const verifyTarget =
          root.querySelector('[data-testid="auth-resend-signup-btn"]:not(:disabled)') ||
          root.querySelector('[data-testid="auth-back-from-verify-btn"]:not(:disabled)');
        if (verifyTarget && typeof verifyTarget.focus === 'function') {
          verifyTarget.focus({ preventScroll: true });
          return;
        }
      }
      if (currentSubView === 'reset-sent') {
        const resetTarget =
          root.querySelector('[data-testid="auth-resend-reset-btn"]:not(:disabled)') ||
          root.querySelector('[data-testid="auth-back-from-reset-btn"]:not(:disabled)');
        if (resetTarget && typeof resetTarget.focus === 'function') {
          resetTarget.focus({ preventScroll: true });
          return;
        }
      }
      const preferred =
        prevSubView !== currentSubView
          ? root.querySelector('[data-testid="auth-email-input"]:not(:disabled)')
          : lastInteractiveControlRef.current &&
              root.contains(lastInteractiveControlRef.current) &&
              !lastInteractiveControlRef.current.disabled
            ? lastInteractiveControlRef.current
            : primarySurfaceRef.current;
      if (preferred && typeof preferred.focus === 'function') {
        preferred.focus({ preventScroll: true });
      }
    }
  }, [turningPage, isPendingAuth, isBusy, inlineError, currentSubView]);

  const computeDistanceFromStart = (clientX, clientY) => {
    if (clientX === undefined || clientY === undefined) return 0;
    const dx = Number(clientX) - dragSessionRef.current.startX;
    const dy = Number(clientY) - dragSessionRef.current.startY;
    return Math.hypot(dx, dy);
  };

  const computeProgressFromPoint = (clientX, clientY) => {
    const startX = dragSessionRef.current.startX;
    const startY = dragSessionRef.current.startY;
    const rect =
      sheetRef.current && typeof sheetRef.current.getBoundingClientRect === 'function'
        ? sheetRef.current.getBoundingClientRect()
        : { width: 0, height: 0 };

    const spanX = rect.width > 40 ? Math.max(140, rect.width * 0.56) : 220;
    const spanY = rect.height > 40 ? Math.max(120, rect.height * 0.36) : 180;

    const dx = Math.max(0, startX - Number(clientX || 0));
    const dy = Math.max(0, startY - Number(clientY || 0));
    const normX = dx / spanX;
    const normY = dy / spanY;
    const combined = Math.max(normX, normX * 0.78 + normY * 0.42);
    return Math.max(0, Math.min(1, Number(combined.toFixed(3))));
  };

  const triggerSpringback = ({ restoreFocus = true } = {}) => {
    const springEpoch = advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    releaseCornerPointerCapture(
      dragSessionRef.current.pointerId,
      dragSessionRef.current.source,
    );
    dragSessionRef.current.active = false;
    dragSessionRef.current.hasDragIntent = false;
    dragSessionRef.current.pointerId = null;
    dragSessionRef.current.progress = 0;
    setCurlProgress(0);
    if (
      restoreFocus &&
      !liveStateRef.current.turningPage &&
      !liveStateRef.current.submitting &&
      !liveStateRef.current.oauthGoogleLoading &&
      primarySurfaceRef.current &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      primarySurfaceRef.current.focus({ preventScroll: true });
    }
    if (reducedMotion) {
      setCurlPhase('idle');
      return;
    }
    setCurlPhase('springback');
    springTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || interactionEpochRef.current !== springEpoch) {
        return;
      }
      springTimerRef.current = null;
      setCurlPhase('idle');
      if (
        restoreFocus &&
        !liveStateRef.current.turningPage &&
        !liveStateRef.current.submitting &&
        !liveStateRef.current.oauthGoogleLoading &&
        primarySurfaceRef.current &&
        (!document.activeElement || document.activeElement === document.body)
      ) {
        primarySurfaceRef.current.focus({ preventScroll: true });
      }
    }, 220);
  };

  const startCornerDrag = ({ source, pointerId, pointerType, clientX, clientY }) => {
    if (isBusy) return;
    const epoch = advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    clearSuppressNextClick();
    cancelledPointerIdRef.current = null;
    lastInteractiveControlRef.current = primarySurfaceRef.current;
    dragSessionRef.current = {
      active: true,
      epoch,
      source,
      pointerId,
      pointerType: pointerType || 'mouse',
      startX: Number(clientX || 0),
      startY: Number(clientY || 0),
      hasDragIntent: false,
      progress: 0,
    };
    setLastPointerType(pointerType || 'mouse');
    setCurlProgress(0);
    setCurlPhase('idle');
  };

  const moveCornerDrag = (clientX, clientY) => {
    if (!dragSessionRef.current.active) return;
    const sessionEpoch = dragSessionRef.current.epoch;
    if (interactionEpochRef.current !== sessionEpoch) return;
    const dist = computeDistanceFromStart(clientX, clientY);
    if (!dragSessionRef.current.hasDragIntent && dist < DRAG_INTENT_DEADZONE_PX) {
      return;
    }
    dragSessionRef.current.hasDragIntent = true;
    const nextProgress = computeProgressFromPoint(clientX, clientY);
    dragSessionRef.current.progress = nextProgress;
    setCurlPhase('dragging');
    setCurlProgress(nextProgress);
  };

  const finishCornerDrag = (clientX, clientY) => {
    if (!dragSessionRef.current.active) return;
    const sessionEpoch = dragSessionRef.current.epoch;
    if (interactionEpochRef.current !== sessionEpoch) return;
    const dist = computeDistanceFromStart(clientX, clientY);
    const hasDragIntent =
      dragSessionRef.current.hasDragIntent || dist >= DRAG_INTENT_DEADZONE_PX;
    const pType = dragSessionRef.current.pointerType || 'mouse';
    const activePointerId = dragSessionRef.current.pointerId;
    const activeSource = dragSessionRef.current.source;
    releaseCornerPointerCapture(activePointerId, activeSource);

    // Ordinary physical tap / click on the integrated surface (no meaningful drag intent)
    if (!hasDragIntent) {
      const tapEpoch = advanceInteractionEpoch();
      dragSessionRef.current.active = false;
      dragSessionRef.current.hasDragIntent = false;
      dragSessionRef.current.pointerId = null;
      dragSessionRef.current.progress = 0;
      setCurlProgress(0);
      setCurlPhase('idle');
      // Suppress the browser's trailing synthetic click from this same tap release
      armSuppressNextClick();
      if (!isBusy) {
        Promise.resolve(
          invokeSubmit(
            {
              preventDefault() {},
              tapCommit: true,
              pointerType: pType,
              progress: 0,
              interactionEpoch: tapEpoch,
            },
            'tap',
          ),
        ).then(
          () => {},
          () => {},
        );
      }
      return;
    }

    // Genuine drag: evaluate threshold, and suppress trailing synthetic click
    const finalProgress =
      clientX !== undefined && clientY !== undefined
        ? Math.max(dragSessionRef.current.progress, computeProgressFromPoint(clientX, clientY))
        : dragSessionRef.current.progress;

    dragSessionRef.current.active = false;
    dragSessionRef.current.hasDragIntent = false;
    dragSessionRef.current.pointerId = null;
    armSuppressNextClick();

    if (finalProgress >= CURL_COMMIT_THRESHOLD) {
      const submitEpoch = advanceInteractionEpoch();
      setCurlProgress(finalProgress);
      setCurlPhase('awaiting-auth');
      const onSettled = () => {
        if (!mountedRef.current || interactionEpochRef.current !== submitEpoch) {
          return;
        }
        // If auth did not enter turningPage and is not still submitting, spring back to cover
        if (
          !liveStateRef.current.turningPage &&
          !liveStateRef.current.submitting &&
          !liveStateRef.current.oauthGoogleLoading
        ) {
          advanceInteractionEpoch();
          setCurlProgress(0);
          setCurlPhase('idle');
        }
      };
      Promise.resolve(
        invokeSubmit(
          {
            preventDefault() {},
            gestureCommit: true,
            pointerType: pType,
            progress: finalProgress,
            interactionEpoch: submitEpoch,
          },
          'drag',
        ),
      ).then(onSettled, onSettled);
      return;
    }

    triggerSpringback({ restoreFocus: true });
  };

  const cancelCornerDrag = (pointerId = null, { restoreFocus = true } = {}) => {
    if (!dragSessionRef.current.active) return;
    if (
      pointerId !== null &&
      pointerId !== undefined &&
      dragSessionRef.current.pointerId !== null &&
      pointerId !== dragSessionRef.current.pointerId
    ) {
      return;
    }
    const activeId = pointerId ?? dragSessionRef.current.pointerId;
    const activeSource = dragSessionRef.current.source;
    releaseCornerPointerCapture(activeId, activeSource);
    cancelledPointerIdRef.current = activeSource === 'pointer' ? activeId : null;
    armSuppressNextClick();
    triggerSpringback({ restoreFocus });
  };

  // Global keyboard & window-blur guard for active pointer drag abandonment,
  // Escape cancellation of pending client auth, and turning-page status focus retention.
  useEffect(() => {
    const handleWindowKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (dragSessionRef.current.active) {
        if (e.key === 'Tab') {
          e.preventDefault();
          cancelCornerDrag(null, { restoreFocus: false });
          moveFocusFromAbandonedDrag(Boolean(e.shiftKey));
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelCornerDrag(null, { restoreFocus: true });
          return;
        }
      }
      if (isPendingAuth && e.key === 'Escape') {
        e.preventDefault();
        handleCancelPending();
        return;
      }
      if (turningPage && e.key === 'Tab') {
        e.preventDefault();
        if (turningStatusRef.current && typeof turningStatusRef.current.focus === 'function') {
          turningStatusRef.current.focus({ preventScroll: true });
        }
      }
    };

    const handleWindowBlur = () => {
      if (dragSessionRef.current.active) {
        cancelCornerDrag(null, { restoreFocus: false });
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  });

  const handleCornerPointerDown = (e) => {
    if (isBusy) return;
    if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return;
    const nextPointerId = e.pointerId ?? 1;
    if (
      dragSessionRef.current.active &&
      dragSessionRef.current.source === 'pointer' &&
      dragSessionRef.current.pointerId !== null &&
      dragSessionRef.current.pointerId !== nextPointerId
    ) {
      releaseCornerPointerCapture(dragSessionRef.current.pointerId, 'pointer');
    }
    if (e.currentTarget && typeof e.currentTarget.focus === 'function') {
      try {
        e.currentTarget.focus({ preventScroll: true });
      } catch {
        // Safe ignore
      }
    }
    if (e.currentTarget && typeof e.currentTarget.setPointerCapture === 'function' && e.pointerId !== undefined) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Safe ignore in synthetic environments without pointer capture table
      }
    }
    startCornerDrag({
      source: 'pointer',
      pointerId: nextPointerId,
      pointerType: e.pointerType || 'mouse',
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const handleCornerPointerMove = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'pointer') return;
    if (
      e.pointerId !== undefined &&
      dragSessionRef.current.pointerId !== null &&
      e.pointerId !== dragSessionRef.current.pointerId
    ) {
      return;
    }
    moveCornerDrag(e.clientX, e.clientY);
  };

  const handleCornerPointerUp = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'pointer') {
      if (
        cancelledPointerIdRef.current !== null &&
        (e.pointerId === undefined || e.pointerId === cancelledPointerIdRef.current)
      ) {
        cancelledPointerIdRef.current = null;
        armSuppressNextClick();
      }
      return;
    }
    if (
      e.pointerId !== undefined &&
      dragSessionRef.current.pointerId !== null &&
      e.pointerId !== dragSessionRef.current.pointerId
    ) {
      return;
    }
    releaseCornerPointerCapture(e.pointerId, 'pointer');
    finishCornerDrag(e.clientX, e.clientY);
  };

  const handleCornerPointerCancel = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'pointer') return;
    if (
      e?.pointerId !== undefined &&
      dragSessionRef.current.pointerId !== null &&
      e.pointerId !== dragSessionRef.current.pointerId
    ) {
      return;
    }
    cancelCornerDrag(e?.pointerId ?? null, { restoreFocus: true });
  };

  const handleCornerLostPointerCapture = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'pointer') return;
    if (
      e?.pointerId !== undefined &&
      dragSessionRef.current.pointerId !== null &&
      e.pointerId !== dragSessionRef.current.pointerId
    ) {
      return;
    }
    cancelCornerDrag(e?.pointerId ?? null, { restoreFocus: true });
  };

  const handleCornerBlur = (e) => {
    if (!dragSessionRef.current.active) return;
    const nextFocused = e?.relatedTarget;
    cancelCornerDrag(null, { restoreFocus: !nextFocused });
  };

  const handleCornerTouchStart = (e) => {
    if (isBusy || dragSessionRef.current.active) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    startCornerDrag({
      source: 'touch',
      pointerId: touch.identifier ?? 0,
      pointerType: 'touch',
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
  };

  const handleCornerTouchMove = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'touch') return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    moveCornerDrag(touch.clientX, touch.clientY);
  };

  const handleCornerTouchEnd = (e) => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'touch') return;
    const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    finishCornerDrag(touch?.clientX, touch?.clientY);
  };

  const handleCornerTouchCancel = () => {
    if (!dragSessionRef.current.active || dragSessionRef.current.source !== 'touch') return;
    cancelCornerDrag(null, { restoreFocus: true });
  };

  // Accessible non-gesture keyboard / AT equivalent (Enter / Space or synthetic AT click)
  // plus safe drag abandonment when Tab or Escape is pressed while pointer drag is held
  const handleCornerKeyDown = (e) => {
    if (dragSessionRef.current.active) {
      if (e.key === 'Tab') {
        e.preventDefault();
        cancelCornerDrag(null, { restoreFocus: false });
        moveFocusFromAbandonedDrag(Boolean(e.shiftKey));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelCornerDrag(null, { restoreFocus: true });
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cancelCornerDrag(null, { restoreFocus: true });
        if (!isBusy) {
          advanceInteractionEpoch();
          if (springTimerRef.current) {
            clearTimeout(springTimerRef.current);
            springTimerRef.current = null;
          }
          setCurlPhase('idle');
          lastInteractiveControlRef.current = primarySurfaceRef.current;
          setLastPointerType('keyboard');
          Promise.resolve(invokeSubmit(e, 'keyboard')).then(
            () => {},
            () => {},
          );
        }
        return;
      }
    }
    if (isBusy) {
      if (turningPage && e.key === 'Tab') {
        e.preventDefault();
        if (turningStatusRef.current && typeof turningStatusRef.current.focus === 'function') {
          turningStatusRef.current.focus({ preventScroll: true });
        }
      }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      advanceInteractionEpoch();
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
        setCurlPhase('idle');
      }
      armSuppressNextClick();
      lastInteractiveControlRef.current = primarySurfaceRef.current;
      setLastPointerType('keyboard');
      Promise.resolve(invokeSubmit(e, 'keyboard')).then(
        () => {},
        () => {},
      );
    }
  };

  const handleCornerClick = (e) => {
    if (suppressNextClickRef.current) {
      clearSuppressNextClick();
      return;
    }
    if (isBusy) return;
    advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
      setCurlPhase('idle');
    }
    // Non-pointer activation (keyboard / screen reader / assistive technology / direct click)
    lastInteractiveControlRef.current = primarySurfaceRef.current;
    setLastPointerType('keyboard');
    Promise.resolve(invokeSubmit(e, 'click')).then(
      () => {},
      () => {},
    );
  };

  const handleFormKeyDown = (e) => {
    if (
      e.key === 'Enter' &&
      e.target &&
      e.target.tagName === 'INPUT' &&
      !e.nativeEvent?.isComposing
    ) {
      e.preventDefault();
      if (isBusy) return;
      advanceInteractionEpoch();
      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
        setCurlPhase('idle');
      }
      lastInteractiveControlRef.current = e.target;
      const enterToken = formEnterSeqRef.current + 1;
      formEnterSeqRef.current = enterToken;
      formEnterHandledRef.current = true;
      queueMicrotask(() => {
        if (mountedRef.current && formEnterSeqRef.current === enterToken) {
          formEnterHandledRef.current = false;
        }
      });
      setLastPointerType('keyboard');
      Promise.resolve(invokeSubmit(e, 'form-enter')).then(
        () => {},
        () => {},
      );
    }
  };

  const handleStatusKeyDown = (e) => {
    if (isPendingAuth && e.key === 'Escape') {
      e.preventDefault();
      handleCancelPending();
      return;
    }
    if (turningPage && e.key === 'Tab') {
      e.preventDefault();
      if (turningStatusRef.current && typeof turningStatusRef.current.focus === 'function') {
        turningStatusRef.current.focus({ preventScroll: true });
      }
    }
  };

  const handleFormSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (formEnterHandledRef.current) {
      formEnterSeqRef.current += 1;
      formEnterHandledRef.current = false;
      return;
    }
    if (isBusy) return;
    advanceInteractionEpoch();
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
      setCurlPhase('idle');
    }
    Promise.resolve(invokeSubmit(e, 'form')).then(
      () => {},
      () => {},
    );
  };

  if (supabaseConfigured && authLoading) {
    return (
      <div
        data-testid="auth-loading-screen"
        className="min-h-screen w-full overflow-x-hidden jr-desk flex flex-col items-center justify-center px-4 py-8"
      >
        {mockBanner ? <DevMockBanner text={mockBanner} /> : null}
        <div className="mc-cover-sheet w-full max-w-md p-6 text-center">
          <p className="font-display text-lg text-ink mb-1">{t('app.brand')}</p>
          <p className="text-sm text-ink-soft" role="status" aria-live="polite">
            {t('auth.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div
        data-testid="auth-config-missing-screen"
        className="min-h-screen w-full overflow-x-hidden jr-desk flex flex-col items-center justify-center px-4 py-8"
      >
        {mockBanner ? <DevMockBanner text={mockBanner} /> : null}
        <div className="mc-cover-sheet w-full max-w-md p-6">
          <p className="text-xs font-bold tracking-widest text-route mb-1">
            {t('app.brand')} · {t('auth.magazineIssue')}
          </p>
          <h1 className="font-display text-2xl font-normal text-ink mb-2">
            {t('auth.configMissingTitle')}
          </h1>
          <p className="text-sm text-ink-soft mb-4">{t('auth.configMissingBody')}</p>
          <pre className="text-xs bg-beige rounded-lg p-3 overflow-x-auto text-ink-soft border border-line">
            VITE_SUPABASE_URL=…{'\n'}
            VITE_SUPABASE_ANON_KEY=…
          </pre>
        </div>
      </div>
    );
  }

  const effectivePhase = turningPage ? 'turning' : curlPhase;
  const geom = computeCurlGeometry(curlProgress, {
    turningPage,
    reducedMotion,
    phase: effectivePhase,
  });

  const sheetTurnClass = turningPage
    ? reducedMotion
      ? 'mc-cover-sheet mc-cover-sheet--fade'
      : 'mc-cover-sheet mc-cover-sheet--turning'
    : 'mc-cover-sheet';
  const surfaceSpringClass =
    effectivePhase === 'springback' && !reducedMotion
      ? 'mc-cover-surface mc-cover-surface--springback'
      : 'mc-cover-surface';
  const primaryCornerText =
    submitting || turningPage
      ? t('auth.submitting')
      : mode === 'signin'
        ? t('auth.pageCurlSignInAria')
        : t('auth.pageCurlSignUpAria');

  return (
    <div
      data-testid="auth-magazine-backdrop"
      data-reduced-motion={String(Boolean(reducedMotion))}
      data-turning-page={String(Boolean(turningPage))}
      data-curl-progress={String(geom.progress)}
      data-curl-phase={effectivePhase}
      data-curl-threshold-met={String(geom.thresholdMet)}
      data-curl-pointer-type={lastPointerType}
      data-submit-count={String(submitCount)}
      data-last-submit-source={lastSubmitSource}
      className="min-h-screen w-full overflow-x-hidden jr-desk flex flex-col items-center justify-start sm:justify-center px-2.5 py-3 sm:px-6 sm:py-8"
    >
      {mockBanner ? <DevMockBanner text={mockBanner} /> : null}

      <div className="mc-cover-perspective w-full max-w-[440px] sm:max-w-[480px]">
        <article
          ref={sheetRef}
          data-testid="auth-magazine-sheet"
          data-cover-layout="full-bleed-single-cover"
          data-curl-progress={String(geom.progress)}
          data-curl-phase={effectivePhase}
          data-cut-x-pct={String(geom.cutX)}
          data-cut-y-pct={String(geom.cutY)}
          className={`${sheetTurnClass} w-full flex flex-col justify-between`}
        >
          {/* Safe, unpersonalized inner notebook page revealed only under the curled cover corner */}
          <div
            data-testid="auth-next-page-preview"
            aria-hidden="true"
            className="mc-next-page-preview flex flex-col justify-between p-5"
          >
            <div className="flex items-center justify-between border-b border-ink-soft/25 pb-2 text-xs font-hand text-ink-muted">
              <span>{t('app.brand')}</span>
              <span>ISSUE 01 · p. 01</span>
            </div>
            <div className="my-auto pr-4 text-right font-hand text-xs text-ink-soft/75 space-y-1">
              <p>
                {hasCoverImage
                  ? `${activeCityHeadline} · JAPAN EDITION`
                  : 'KAMAKURA · SHONAN COASTLINE'}
              </p>
              <p>FIELD NOTES &amp; SKETCHBOOK</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-ink-soft/25 pt-2 text-xs font-serifDisplay tracking-widest text-route">
              <span>p. 01</span>
            </div>
          </div>

          <div
            data-testid="auth-turn-cast-shadow"
            aria-hidden="true"
            className="mc-turn-cast-shadow pointer-events-none"
          />

          <div
            data-testid="auth-cover-leaf"
            onAnimationEnd={(e) => {
              if (e && e.target !== e.currentTarget) return;
              if (typeof onTurnAnimationEnd === 'function') {
                onTurnAnimationEnd(e);
              }
            }}
            className="mc-cover-leaf"
          >
            <div
              data-testid="auth-leaf-front"
              className="mc-leaf-front"
            >
              {/* Front Full-Bleed Magazine Cover Surface (clipped continuously by corner-curl polygon) */}
              <div
                data-testid="auth-cover-surface"
                data-cut-x-pct={String(geom.cutX)}
                data-cut-y-pct={String(geom.cutY)}
                style={{ clipPath: geom.coverClipPath }}
                className={surfaceSpringClass}
              >
            {hasCoverImage ? (
              <>
                <img
                  data-testid="auth-cover-image-backdrop"
                  src={coverImage.src}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  draggable={false}
                  style={{ pointerEvents: 'none' }}
                  className="mc-cover-image-backdrop pointer-events-none select-none"
                />
                <img
                  data-testid="auth-cover-image"
                  data-cover-id={coverImage.id}
                  src={coverImage.src}
                  alt={coverImage.alt || ''}
                  decoding="async"
                  draggable={false}
                  style={{ pointerEvents: 'none' }}
                  className="mc-cover-image pointer-events-none select-none"
                />
                {effectiveHeadlineMode === 'html' ? (
                  <div
                    data-testid="auth-cover-sky-scrim"
                    aria-hidden="true"
                    className="mc-cover-sky-scrim pointer-events-none"
                  />
                ) : null}
              </>
            ) : null}
            <div aria-hidden="true" className="mc-cover-spine" />
          </div>

          {/* Upper ~75% of cover: magazine masthead, headline, and scenic stage */}
          <div className="mc-upper-scenic-stage flex-1 flex flex-col justify-between min-h-0">
            <header
              data-testid="auth-cover-hero"
              className="mc-sky-stage relative w-full pt-3.5 px-3.5 sm:px-5 pb-2 flex flex-col justify-between select-none"
            >
              {effectiveHeadlineMode === 'painted' ? (
                <h1 data-testid="auth-cover-sr-heading" className="sr-only">
                  {`${activeCityHeadline} · ${t('app.brand')}`}
                </h1>
              ) : (
                <>
                  {/* Top issue masthead bar */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 border-b border-paper/35 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-sm bg-paper text-route font-display text-xs font-bold tracking-wider">
                        {t('app.brand')}
                      </span>
                      <span
                        data-testid="auth-cover-issue"
                        className="text-xs font-semibold tracking-wider text-paper break-words"
                      >
                        {hasCoverImage ? 'ISSUE 01' : t('auth.magazineIssue')}
                      </span>
                    </div>
                    <span
                      data-testid="auth-cover-stamp"
                      className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-sm border border-paper/80 bg-route text-paper font-hand text-xs font-bold tracking-widest"
                    >
                      {activeStampLabel}
                    </span>
                  </div>

                  {/* Cover title block: White HTML city headline + Japan subtitle + side captions */}
                  <div className="relative z-10 pt-4 pb-2 sm:pt-5 sm:pb-3 flex items-start justify-between gap-1.5 sm:gap-2">
                    <div
                      data-testid="auth-cover-caption-left"
                      aria-hidden="true"
                      className="mc-vertical-caption hidden min-[360px]:block text-paper/90 font-hand pt-1 shrink-0"
                    >
                      {activeLeftVerticalCaption}
                    </div>

                    <div className="flex-1 min-w-0 text-center px-1">
                      <p
                        data-testid="auth-cover-country"
                        className="font-serifDisplay text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-paper mb-1 break-words"
                      >
                        JAPAN · 日本
                      </p>
                      <h1
                        data-testid="auth-cover-headline"
                        className="mc-cover-headline font-serifDisplay font-semibold uppercase text-paper"
                      >
                        {activeCityHeadline}
                      </h1>
                      <p
                        data-testid="auth-cover-subtitle"
                        className="mt-1.5 text-xs sm:text-sm font-medium tracking-wider text-paper break-words"
                      >
                        {hasCoverImage
                          ? `${t('app.brand')} · ${t('notebook.journal.countries.generic.subtitle')}`
                          : t('auth.coverSubtitle')}
                      </p>

                      {!hasCoverImage ? (
                        <div className="mt-2.5 flex justify-center">
                          <span
                            data-testid="auth-placeholder-artwork-badge"
                            className="inline-block max-w-full break-words rounded-sm border border-paper/75 bg-paper px-2.5 py-0.5 text-xs font-semibold text-ink shadow-sm"
                          >
                            {bilingualPlaceholderLabel}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div
                      data-testid="auth-cover-caption-right"
                      aria-hidden="true"
                      className="mc-vertical-caption hidden min-[360px]:block text-paper/90 font-hand pt-1 shrink-0"
                    >
                      旅の手帖・記録帳
                    </div>
                  </div>
                </>
              )}
            </header>

            {!hasCoverImage ? (
              <div data-testid="auth-cover-scenery-stage" className="relative z-10 w-full mt-auto pt-2">
                <KamakuraSceneryPlaceholder />
              </div>
            ) : null}
          </div>

          {/* Continuous SVG paper-curl back-flap & cast shadow layer */}
          <svg
            data-testid="auth-curl-geometry-svg"
            data-cut-x-pct={String(geom.cutX)}
            data-cut-y-pct={String(geom.cutY)}
            data-apex-x={String(geom.apexX)}
            data-apex-y={String(geom.apexY)}
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-30 w-full h-full select-none"
          >
            <defs>
              <linearGradient id="mc-curl-shadow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(var(--c-ink) / 0.05)" />
                <stop offset="55%" stopColor="rgb(var(--c-ink) / 0.14)" />
                <stop offset="100%" stopColor="rgb(var(--c-ink) / 0.22)" />
              </linearGradient>
              <linearGradient id="mc-curl-flap-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(var(--c-paper))" />
                <stop offset="58%" stopColor="rgb(var(--c-paper-shade))" />
                <stop offset="100%" stopColor="rgb(var(--c-kraft) / 0.55)" />
              </linearGradient>
            </defs>
            {/* Cast shadow beneath the lifted corner flap */}
            <polygon
              data-testid="auth-curl-shadow"
              points={geom.shadowPoints}
              fill="url(#mc-curl-shadow-grad)"
            />
            {/* Backside of the folded cover paper corner */}
            <polygon
              data-testid="auth-curl-backface"
              points={geom.flapPoints}
              fill="url(#mc-curl-flap-grad)"
              stroke="rgb(var(--c-ink-soft) / 0.75)"
              strokeWidth="0.45"
              strokeLinejoin="round"
            />
            {/* Fold crease highlight along the diagonal hinge */}
            <line
              data-testid="auth-curl-crease"
              x1={geom.foldBottomX}
              y1="100"
              x2="100"
              y2={geom.foldRightY}
              stroke="rgb(var(--c-route))"
              strokeWidth="0.55"
            />
          </svg>

          {/* Bottom ~25% compact editorial login overlay directly over lower coastal negative space */}
          <section
            ref={overlayRef}
            data-testid="auth-login-overlay"
            data-cover-layout="full-bleed-single-cover"
            aria-label={t('auth.coverPanelEyebrow')}
            onFocusCapture={(e) => {
              if (
                !isBusy &&
                e.target &&
                (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON')
              ) {
                lastInteractiveControlRef.current = e.target;
              }
            }}
            style={
              hasCoverImage
                ? {
                    '--mc-curl-fold-x': `${geom.foldBottomX}%`,
                    '--mc-curl-cut-y': `${Number((geom.cutY * 6.56).toFixed(2))}px`,
                  }
                : undefined
            }
            className={`mc-login-overlay${
              hasCoverImage ? ' mc-login-overlay--cover-wash' : ''
            } shrink-0 w-full px-3 pt-1.5 pb-1.5 sm:px-4 sm:py-2 text-ink`}
          >
            {turningPage ? (
              <p
                ref={turningStatusRef}
                data-testid="auth-turning-status"
                role="status"
                aria-live="polite"
                tabIndex={-1}
                onKeyDown={handleStatusKeyDown}
                className="text-xs font-semibold text-ink mb-1 focus:outline-none"
              >
                {t('auth.turningPage')}
              </p>
            ) : isPendingAuth ? (
              <div
                data-testid="auth-pending-bar"
                className="mc-corner-safe-row mc-pending-bar mb-1.5"
              >
                <p
                  ref={submittingStatusRef}
                  data-testid="auth-submitting-status"
                  role="status"
                  aria-live="polite"
                  tabIndex={-1}
                  onKeyDown={handleStatusKeyDown}
                  className="mc-pending-status text-xs font-semibold text-ink focus:outline-none"
                >
                  {t('auth.submitting')}
                </p>
                <button
                  ref={pendingCancelBtnRef}
                  type="button"
                  data-testid="auth-pending-cancel-btn"
                  aria-label={t('auth.cancelPendingAria')}
                  onClick={handleCancelPending}
                  className="mc-pending-cancel-btn min-h-[44px] min-w-[44px] text-sm font-semibold"
                >
                  {t('auth.cancelPending')}
                </button>
              </div>
            ) : null}

            {pendingPasswordReset ? (
              <div
                data-testid="auth-reset-sent-panel"
                inert={isBusy ? '' : undefined}
                aria-hidden={turningPage ? 'true' : undefined}
                aria-busy={isPendingAuth ? 'true' : undefined}
                className="space-y-1.5"
              >
                <h2 className="font-display text-sm font-bold text-ink">
                  {t('auth.forgotPasswordCheckTitle')}
                </h2>
                <p className="text-xs text-ink-soft">{t('auth.forgotPasswordSent')}</p>
                {inlineSuccess ? (
                  <p
                    data-testid="auth-success-banner"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-teal-strong bg-teal-soft border border-teal/40 rounded-lg px-2.5 py-1.5"
                  >
                    {inlineSuccess}
                  </p>
                ) : null}
                {inlineError ? (
                  <p
                    ref={setErrorAlertNode}
                    data-testid="auth-error-alert"
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                    className="text-xs text-coral-ink bg-coral-soft border border-coral-ink/40 rounded-lg px-2.5 py-1.5"
                  >
                    {inlineError}
                  </p>
                ) : null}
                <div className="mc-corner-safe-row mc-action-grid mc-action-grid--2">
                  <button
                    type="button"
                    data-testid="auth-resend-reset-btn"
                    className="mc-editorial-submit w-full min-h-[44px] min-w-[44px] text-sm"
                    onClick={onResendReset}
                    disabled={resendCooldown > 0 || isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={resendCooldown > 0 || isBusy ? -1 : 0}
                  >
                    {resendCooldown > 0
                      ? t('auth.resendWait', { seconds: resendCooldown })
                      : t('auth.forgotPasswordResend')}
                  </button>
                  <button
                    type="button"
                    data-testid="auth-back-from-reset-btn"
                    className="mc-editorial-google w-full min-h-[44px] min-w-[44px] text-sm"
                    disabled={isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={isBusy ? -1 : 0}
                    onClick={onBackFromReset}
                  >
                    {t('auth.back')}
                  </button>
                </div>
              </div>
            ) : pendingEmail ? (
              <div
                data-testid="auth-verify-email-panel"
                inert={isBusy ? '' : undefined}
                aria-hidden={turningPage ? 'true' : undefined}
                aria-busy={isPendingAuth ? 'true' : undefined}
                className="space-y-1.5"
              >
                <h2 className="font-display text-sm font-bold text-ink">
                  {t('auth.checkInboxTitle')}
                </h2>
                <p className="text-xs text-ink-soft">
                  {t('auth.checkInboxBody', { email: pendingEmail })}
                </p>
                {inlineSuccess ? (
                  <p
                    data-testid="auth-success-banner"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-teal-strong bg-teal-soft border border-teal/40 rounded-lg px-2.5 py-1.5"
                  >
                    {inlineSuccess}
                  </p>
                ) : null}
                {inlineError ? (
                  <p
                    ref={setErrorAlertNode}
                    data-testid="auth-error-alert"
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                    className="text-xs text-coral-ink bg-coral-soft border border-coral-ink/40 rounded-lg px-2.5 py-1.5"
                  >
                    {inlineError}
                  </p>
                ) : null}
                <div className="mc-corner-safe-row mc-action-grid mc-action-grid--2">
                  <button
                    type="button"
                    data-testid="auth-resend-signup-btn"
                    className="mc-editorial-submit w-full min-h-[44px] min-w-[44px] text-sm"
                    onClick={onResend}
                    disabled={resendCooldown > 0 || isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={resendCooldown > 0 || isBusy ? -1 : 0}
                  >
                    {resendCooldown > 0
                      ? t('auth.resendWait', { seconds: resendCooldown })
                      : t('auth.resend')}
                  </button>
                  <button
                    type="button"
                    data-testid="auth-back-from-verify-btn"
                    className="mc-editorial-google w-full min-h-[44px] min-w-[44px] text-sm"
                    disabled={isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={isBusy ? -1 : 0}
                    onClick={onBackFromPendingEmail}
                  >
                    {t('auth.back')}
                  </button>
                </div>
              </div>
            ) : showForgotPassword ? (
              <form
                data-testid="auth-forgot-form"
                inert={isBusy ? '' : undefined}
                aria-hidden={turningPage ? 'true' : undefined}
                aria-busy={isPendingAuth ? 'true' : undefined}
                onSubmit={onForgotSubmit}
                noValidate
                className="space-y-1.5"
              >
                {inlineError ? (
                  <p
                    ref={setErrorAlertNode}
                    data-testid="auth-error-alert"
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                    className="text-xs text-coral-ink bg-coral-soft border border-coral-ink/40 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-route"
                  >
                    {inlineError}
                  </p>
                ) : null}
                {inlineSuccess ? (
                  <p
                    data-testid="auth-success-banner"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-teal-strong bg-teal-soft border border-teal/40 rounded-lg px-2.5 py-1.5"
                  >
                    {inlineSuccess}
                  </p>
                ) : null}
                <p className="text-xs text-ink-soft">{t('auth.forgotPasswordHint')}</p>
                <div className="mc-corner-safe-row">
                  <label
                    htmlFor="auth-forgot-email"
                    className="mc-field-label block text-sm font-semibold leading-tight text-ink mb-1"
                  >
                    {t('auth.email')}
                  </label>
                  <input
                    id="auth-forgot-email"
                    data-testid="auth-forgot-email-input"
                    type="email"
                    autoComplete="email"
                    className="mc-editorial-input"
                    value={email}
                    disabled={isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={isBusy ? -1 : 0}
                    onChange={(e) => onEmailChange && onEmailChange(e.target.value)}
                  />
                </div>
                <div className="mc-corner-safe-row mc-action-grid mc-action-grid--2">
                  <button
                    type="submit"
                    data-testid="auth-forgot-submit-btn"
                    className="mc-editorial-submit w-full min-h-[44px] min-w-[44px] text-sm"
                    disabled={isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={isBusy ? -1 : 0}
                  >
                    {submitting ? t('auth.submitting') : t('auth.forgotPasswordSubmit')}
                  </button>
                  <button
                    type="button"
                    data-testid="auth-forgot-back-btn"
                    className="mc-editorial-google w-full min-h-[44px] min-w-[44px] text-sm"
                    disabled={isBusy}
                    inert={isBusy ? '' : undefined}
                    aria-hidden={turningPage ? 'true' : undefined}
                    tabIndex={isBusy ? -1 : 0}
                    onClick={onBackFromForgot}
                  >
                    {t('auth.backToSignIn')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {inlineError ? (
                  <p
                    ref={setErrorAlertNode}
                    data-testid="auth-error-alert"
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                    className="text-xs text-coral-ink bg-coral-soft border border-coral-ink/40 rounded-lg px-2.5 py-1.5 mb-1.5 focus:outline-none focus:ring-2 focus:ring-route"
                  >
                    {inlineError}
                  </p>
                ) : null}

                {inlineSuccess ? (
                  <p
                    data-testid="auth-success-banner"
                    role="status"
                    aria-live="polite"
                    className="text-xs text-teal-strong bg-teal-soft border border-teal/40 rounded-lg px-2.5 py-1.5 mb-1.5"
                  >
                    {inlineSuccess}
                  </p>
                ) : null}

                <form
                  data-testid="auth-credentials-form"
                  inert={isBusy ? '' : undefined}
                  aria-hidden={turningPage ? 'true' : undefined}
                  aria-busy={isPendingAuth ? 'true' : undefined}
                  onSubmit={handleFormSubmit}
                  onKeyDown={handleFormKeyDown}
                  noValidate
                  className="mc-credentials-form"
                >
                  {/* Row 1: Equal-column email (left) and password (right) inputs */}
                  <div
                    data-testid="auth-credentials-row"
                    className="mc-credentials-row"
                  >
                    <div className="min-w-0">
                      <label
                        htmlFor="auth-email"
                        className="mc-field-label block text-sm font-semibold leading-tight text-ink mb-1"
                      >
                        {t('auth.email')}
                      </label>
                      <input
                        id="auth-email"
                        data-testid="auth-email-input"
                        name="email"
                        type="email"
                        autoComplete="email"
                        className="mc-editorial-input"
                        value={email}
                        disabled={isBusy}
                        inert={isBusy ? '' : undefined}
                        aria-hidden={turningPage ? 'true' : undefined}
                        tabIndex={isBusy ? -1 : 0}
                        onChange={(e) => onEmailChange && onEmailChange(e.target.value)}
                      />
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor="auth-password"
                        className="mc-field-label block text-sm font-semibold leading-tight text-ink mb-1"
                      >
                        {t('auth.password')}
                      </label>
                      <input
                        id="auth-password"
                        data-testid="auth-password-input"
                        name="password"
                        type="password"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        className="mc-editorial-input"
                        value={password}
                        disabled={isBusy}
                        inert={isBusy ? '' : undefined}
                        aria-hidden={turningPage ? 'true' : undefined}
                        tabIndex={isBusy ? -1 : 0}
                        onChange={(e) => onPasswordChange && onPasswordChange(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 2: Equal-column Google (left) and forgot-password (right) */}
                  <div
                    data-testid="auth-action-grid"
                    className={`mc-action-grid ${
                      mode === 'signin' ? 'mc-action-grid--2' : 'mc-action-grid--1'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid="auth-google-btn"
                      aria-label={oauthGoogleLoading ? t('auth.submitting') : t('auth.googleSignIn')}
                      title={t('auth.googleSignIn')}
                      onClick={onGoogleSignIn}
                      disabled={isBusy}
                      inert={isBusy ? '' : undefined}
                      aria-hidden={turningPage ? 'true' : undefined}
                      tabIndex={isBusy ? -1 : 0}
                      className="mc-editorial-google w-full min-h-[44px] min-w-[44px] text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <GoogleIcon className="shrink-0" />
                      <span>{oauthGoogleLoading ? t('auth.submitting') : 'Google'}</span>
                    </button>

                    {mode === 'signin' ? (
                      <button
                        type="button"
                        data-testid="auth-forgot-password-link"
                        disabled={isBusy}
                        inert={isBusy ? '' : undefined}
                        aria-hidden={turningPage ? 'true' : undefined}
                        tabIndex={isBusy ? -1 : 0}
                        className="mc-editorial-secondary w-full min-h-[44px] min-w-[44px] text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
                        onClick={onShowForgotPassword}
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    ) : null}
                  </div>

                  {/* Row 3: Full-width REGISTER / mode switch spanning both columns */}
                  <div
                    data-testid="auth-register-row"
                    className="mc-register-row"
                  >
                    <button
                      type="button"
                      data-testid="auth-mode-switch-btn"
                      data-target-mode={mode === 'signin' ? 'signup' : 'signin'}
                      disabled={isBusy}
                      inert={isBusy ? '' : undefined}
                      aria-hidden={turningPage ? 'true' : undefined}
                      tabIndex={isBusy ? -1 : 0}
                      onClick={() =>
                        onModeChange && onModeChange(mode === 'signin' ? 'signup' : 'signin')
                      }
                      className="mc-contextual-mode-switch w-full min-h-[44px] min-w-[44px] text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {mode === 'signin'
                        ? t('auth.switchToSignUpPrompt')
                        : t('auth.switchToSignInPrompt')}
                    </button>
                  </div>

                  {/* Row 4: Separate bottom strip reserving clearance below REGISTER and hosting the natural lower-right paper corner */}
                  <div
                    data-testid="auth-corner-strip"
                    className="mc-corner-strip"
                  >
                    <button
                      ref={primarySurfaceRef}
                      type="button"
                      data-testid="auth-primary-surface"
                      data-curl-progress={String(geom.progress)}
                      data-curl-phase={effectivePhase}
                      data-submit-count={String(submitCount)}
                      data-last-submit-source={lastSubmitSource}
                      aria-label={primaryCornerText}
                      disabled={isBusy}
                      inert={isBusy ? '' : undefined}
                      aria-hidden={turningPage ? 'true' : undefined}
                      tabIndex={isBusy ? -1 : 0}
                      onPointerDown={handleCornerPointerDown}
                      onPointerMove={handleCornerPointerMove}
                      onPointerUp={handleCornerPointerUp}
                      onPointerCancel={handleCornerPointerCancel}
                      onLostPointerCapture={handleCornerLostPointerCapture}
                      onBlur={handleCornerBlur}
                      onTouchStart={handleCornerTouchStart}
                      onTouchMove={handleCornerTouchMove}
                      onTouchEnd={handleCornerTouchEnd}
                      onTouchCancel={handleCornerTouchCancel}
                      onKeyDown={handleCornerKeyDown}
                      onClick={handleCornerClick}
                      className="mc-primary-corner-surface disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span className="mc-primary-corner-content">
                        <span
                          data-testid="auth-primary-corner-label"
                          className="mc-primary-corner-label"
                        >
                          {primaryCornerText}
                        </span>
                        <span aria-hidden="true" className="mc-primary-corner-curl-icon">
                          ↗
                        </span>
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>

              <div
                data-testid="auth-leaf-shade"
                aria-hidden="true"
                style={{ clipPath: geom.coverClipPath }}
                className="mc-leaf-shade pointer-events-none"
              />
            </div>

            <div
              data-testid="auth-leaf-back"
              aria-hidden="true"
              className="mc-leaf-back pointer-events-none"
            />
          </div>
        </article>
      </div>
    </div>
  );
}

function DevMockBanner({ text }) {
  return (
    <div
      data-testid="auth-dev-mock-banner"
      role="note"
      className="w-full max-w-[480px] mb-3 rounded-lg border-2 border-stamp bg-paper px-3 py-2 text-center text-xs font-bold text-stamp shadow-sm"
    >
      {text}
    </div>
  );
}

/**
 * Original local vector placeholder landscape for the Kamakura coastal cover:
 * - Distant Shonan bay horizon & coastal slope
 * - Lower-left: unbranded green/cream coastal railway car + level crossing gate
 * - Lower-right: unbranded coastal convenience store + parked white mini-truck
 * - Zero raw hex literals (strictly `rgb(var(--c-*))`)
 */
export function KamakuraSceneryPlaceholder() {
  return (
    <svg
      data-testid="auth-kamakura-scenery"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 480 188"
      fill="none"
      className="pointer-events-none block w-full h-auto select-none"
    >
      {/* Soft clouds in lower sky */}
      <ellipse cx="96" cy="28" rx="46" ry="12" fill="rgb(var(--c-paper) / 0.32)" />
      <ellipse cx="132" cy="31" rx="32" ry="9" fill="rgb(var(--c-paper) / 0.25)" />
      <ellipse cx="372" cy="24" rx="52" ry="11" fill="rgb(var(--c-paper) / 0.28)" />

      {/* Distant coastal island & Shonan bay horizon */}
      <path
        d="M0 78 Q95 72 188 76 L210 62 Q226 52 244 64 L262 76 Q370 73 480 78 L480 118 L0 118 Z"
        fill="rgb(var(--c-route) / 0.55)"
      />
      {/* Ruled sea lines */}
      <line x1="16" y1="88" x2="464" y2="88" stroke="rgb(var(--c-paper) / 0.42)" strokeWidth="1.2" strokeDasharray="18 10" />
      <line x1="42" y1="98" x2="438" y2="98" stroke="rgb(var(--c-paper) / 0.34)" strokeWidth="1" strokeDasharray="12 14" />
      <line x1="20" y1="108" x2="450" y2="108" stroke="rgb(var(--c-paper) / 0.28)" strokeWidth="1" strokeDasharray="22 12" />

      {/* Coastal seawall & street base */}
      <rect x="0" y="114" width="480" height="74" fill="rgb(var(--c-paper-shade))" />
      <line x1="0" y1="114" x2="480" y2="114" stroke="rgb(var(--c-ink-soft))" strokeWidth="1.6" />
      <rect x="0" y="150" width="480" height="38" fill="rgb(var(--c-desk))" />
      <line x1="0" y1="150" x2="480" y2="150" stroke="rgb(var(--c-ink-soft))" strokeWidth="1.4" />

      {/* Overhead railway catenary wire & poles */}
      <line x1="0" y1="48" x2="256" y2="56" stroke="rgb(var(--c-ink-soft) / 0.65)" strokeWidth="1.2" />
      <line x1="212" y1="44" x2="212" y2="150" stroke="rgb(var(--c-ink-soft))" strokeWidth="2.4" />

      {/* LOWER-LEFT: Coastal green & cream unbranded train */}
      <g data-scenery-part="coastal-train">
        {/* Tracks / sleepers */}
        <line x1="0" y1="146" x2="245" y2="146" stroke="rgb(var(--c-ink))" strokeWidth="2" />
        <line x1="8" y1="149" x2="238" y2="149" stroke="rgb(var(--c-ink-soft))" strokeWidth="1.5" strokeDasharray="4 6" />

        {/* Pantograph */}
        <path
          d="M74 74 L86 58 L98 74"
          stroke="rgb(var(--c-ink-soft))"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* Train car body (classic coastal green + cream band) */}
        <rect
          x="12"
          y="74"
          width="168"
          height="64"
          rx="6"
          fill="rgb(var(--c-wash-leaf))"
          stroke="rgb(var(--c-ink))"
          strokeWidth="1.8"
        />
        {/* Upper cream window band */}
        <rect
          x="14"
          y="80"
          width="164"
          height="28"
          fill="rgb(var(--c-paper))"
        />
        {/* Accent mustard stripe */}
        <rect x="14" y="108" width="164" height="5" fill="rgb(var(--c-wash-wheat))" />

        {/* Train windows */}
        <rect x="22" y="84" width="22" height="19" rx="2" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="50" y="84" width="26" height="19" rx="2" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="82" y="84" width="26" height="19" rx="2" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="114" y="84" width="26" height="19" rx="2" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="146" y="84" width="24" height="19" rx="2" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />

        {/* Headlight & front destination box (unbranded) */}
        <circle cx="171" cy="124" r="3.5" fill="rgb(var(--c-wash-wheat))" stroke="rgb(var(--c-ink))" strokeWidth="1.2" />

        {/* Bogies / wheels */}
        <circle cx="42" cy="142" r="5" fill="rgb(var(--c-ink))" />
        <circle cx="64" cy="142" r="5" fill="rgb(var(--c-ink))" />
        <circle cx="132" cy="142" r="5" fill="rgb(var(--c-ink))" />
        <circle cx="154" cy="142" r="5" fill="rgb(var(--c-ink))" />
      </g>

      {/* Railway crossing gate (踏切) */}
      <g data-scenery-part="railway-crossing">
        <rect x="202" y="84" width="6" height="68" fill="rgb(var(--c-wash-wheat))" stroke="rgb(var(--c-ink))" strokeWidth="1.4" />
        <line x1="202" y1="94" x2="208" y2="94" stroke="rgb(var(--c-ink))" strokeWidth="3" />
        <line x1="202" y1="106" x2="208" y2="106" stroke="rgb(var(--c-ink))" strokeWidth="3" />
        <line x1="202" y1="118" x2="208" y2="118" stroke="rgb(var(--c-ink))" strokeWidth="3" />
        <line x1="202" y1="130" x2="208" y2="130" stroke="rgb(var(--c-ink))" strokeWidth="3" />
        {/* Crossing warning lights */}
        <rect x="196" y="76" width="18" height="9" rx="2" fill="rgb(var(--c-ink))" />
        <circle cx="201" cy="80.5" r="2.6" fill="rgb(var(--c-stamp))" />
        <circle cx="209" cy="80.5" r="2.6" fill="rgb(var(--c-stamp))" />
        {/* Crossing barrier arm */}
        <path
          d="M208 122 L254 120"
          stroke="rgb(var(--c-wash-wheat))"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M208 122 L254 120"
          stroke="rgb(var(--c-ink))"
          strokeWidth="4"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />
      </g>

      {/* LOWER-RIGHT: Unbranded local convenience store + parked white mini-truck */}
      <g data-scenery-part="coastal-store-and-van">
        {/* Store building body */}
        <rect
          x="278"
          y="78"
          width="184"
          height="72"
          rx="3"
          fill="rgb(var(--c-paper))"
          stroke="rgb(var(--c-ink))"
          strokeWidth="1.8"
        />
        {/* Unbranded striped coastal fascia */}
        <rect
          x="274"
          y="72"
          width="192"
          height="14"
          rx="2"
          fill="rgb(var(--c-paper))"
          stroke="rgb(var(--c-ink))"
          strokeWidth="1.5"
        />
        <rect x="276" y="74" width="188" height="4" fill="rgb(var(--c-route))" />
        <rect x="276" y="79" width="188" height="4" fill="rgb(var(--c-wash-leaf))" />

        {/* Storefront glass panes */}
        <rect x="290" y="94" width="38" height="42" fill="rgb(var(--c-wash-sky) / 0.65)" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="334" y="94" width="38" height="42" fill="rgb(var(--c-wash-wheat) / 0.48)" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="378" y="94" width="34" height="56" fill="rgb(var(--c-route-soft))" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />
        <rect x="418" y="94" width="32" height="42" fill="rgb(var(--c-wash-sky) / 0.65)" stroke="rgb(var(--c-ink))" strokeWidth="1.3" />

        {/* Parked white mini-truck / kei-van in front of store */}
        <g data-scenery-part="white-mini-truck">
          {/* Cargo bed & cab */}
          <path
            d="M294 134 H348 V116 C348 113 345 111 341 111 H322 L314 123 H294 Z"
            fill="rgb(var(--c-cream-soft))"
            stroke="rgb(var(--c-ink))"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {/* Windshield */}
          <path
            d="M316 122 L322 114 H334 V122 Z"
            fill="rgb(var(--c-route-soft))"
            stroke="rgb(var(--c-ink))"
            strokeWidth="1.2"
          />
          {/* Wheels */}
          <circle cx="307" cy="149" r="6" fill="rgb(var(--c-ink))" />
          <circle cx="307" cy="149" r="2.4" fill="rgb(var(--c-paper))" />
          <circle cx="337" cy="149" r="6" fill="rgb(var(--c-ink))" />
          <circle cx="337" cy="149" r="2.4" fill="rgb(var(--c-paper))" />
          <rect x="294" y="134" width="54" height="12" fill="rgb(var(--c-paper))" stroke="rgb(var(--c-ink))" strokeWidth="1.5" />
        </g>
      </g>

      {/* Road center dashed markings */}
      <line x1="18" y1="169" x2="462" y2="169" stroke="rgb(var(--c-paper))" strokeWidth="2" strokeDasharray="24 18" />
    </svg>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill={palette.mustard}
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill={palette.coral}
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill={palette.sage}
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill={palette['teal-strong']}
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
