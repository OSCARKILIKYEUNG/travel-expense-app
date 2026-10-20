import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandRibbon, NotebookBackdrop } from '../components/ui/Doodles';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

/**
 * 重設密碼落地頁。
 * PKCE 信內連結多為 `?code=`，交換後常觸發 **SIGNED_IN**／**INITIAL_SESSION**，不一定有 **PASSWORD_RECOVERY**；
 * 且事件可能在掛載前已發過，僅訂閱 PASSWORD_RECOVERY 會漏接 → 誤判「連結無效」。
 */
export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { supabaseConfigured, updatePassword } = useAuth();

  const [phase, setPhase] = useState('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const failTimerRef = useRef(null);
  const retryTimersRef = useRef([]);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setPhase('invalid');
      return;
    }

    let cancelled = false;

    const clearFailTimer = () => {
      if (failTimerRef.current) {
        clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
    };

    const clearRetryTimers = () => {
      retryTimersRef.current.forEach(clearTimeout);
      retryTimersRef.current = [];
    };

    const promoteToForm = () => {
      if (cancelled) return;
      clearFailTimer();
      clearRetryTimers();
      setPhase('form');
    };

    const trySession = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session?.user) promoteToForm();
    };

    const loc = `${window.location.search}${window.location.hash}`;
    const expectExchange =
      /[?&#]code=/.test(loc) || /type=recovery/i.test(loc);

    void trySession();
    [50, 150, 400, 1000, 2200, 4500].forEach((ms) => {
      retryTimersRef.current.push(setTimeout(() => void trySession(), ms));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        promoteToForm();
        return;
      }
      if (event === 'INITIAL_SESSION' && session?.user) {
        promoteToForm();
        return;
      }
      if (event === 'SIGNED_IN' && session?.user) {
        promoteToForm();
      }
    });

    const failMs = expectExchange ? 25000 : 8000;
    failTimerRef.current = setTimeout(() => {
      setPhase((p) => (p === 'checking' ? 'invalid' : p));
    }, failMs);

    return () => {
      cancelled = true;
      clearFailTimer();
      clearRetryTimers();
      subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInlineError('');
    const p = password.trim();
    const c = confirm.trim();
    if (!p || !c) {
      setInlineError(t('auth.errorEmptyPasswordReset'));
      return;
    }
    if (p !== c) {
      setInlineError(t('auth.errorPasswordMismatch'));
      return;
    }
    if (p.length < 6) {
      setInlineError(t('auth.errorPasswordTooShort'));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await updatePassword(p);
      if (error) {
        setInlineError(error.message || t('auth.errorGeneric'));
        return;
      }
      navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (!supabaseConfigured) {
    return (
      <NotebookBackdrop>
        <div className="card max-w-md w-full p-6">
          <p className="text-sm text-ink-soft">{t('auth.configMissingBody')}</p>
        </div>
      </NotebookBackdrop>
    );
  }

  return (
    <NotebookBackdrop>
      <div className="card max-w-md w-full p-6">
        <BrandRibbon name={t('app.brand')} />

        {phase === 'checking' && (
          <p className="text-sm text-ink-soft">{t('auth.resetPasswordVerifying')}</p>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4">
            <h1 className="font-display text-2xl font-normal text-ink">{t('auth.resetPasswordInvalidTitle')}</h1>
            <p className="text-sm text-ink-soft">{t('auth.resetPasswordInvalidBody')}</p>
            <button type="button" className="btn-primary w-full" onClick={() => navigate('/login', { replace: true })}>
              {t('auth.resetPasswordGoLogin')}
            </button>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="font-display text-2xl font-normal text-ink">{t('auth.resetPasswordTitle')}</h1>
            {inlineError && (
              <p className="text-sm text-coral-ink bg-coral-soft border border-coral-ink/30 rounded-xl px-3 py-2">{inlineError}</p>
            )}
            <div>
              <label htmlFor="reset-new-password" className="block text-sm font-medium text-ink-soft mb-1">
                {t('auth.newPassword')}
              </label>
              <input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-ink-soft mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                className="input-field"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? t('auth.submitting') : t('auth.resetPasswordSubmit')}
            </button>
          </form>
        )}
      </div>
    </NotebookBackdrop>
  );
}
