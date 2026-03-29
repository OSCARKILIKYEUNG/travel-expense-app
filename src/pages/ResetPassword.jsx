import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

/** 信內連結導回後，Supabase 觸發 PASSWORD_RECOVERY；見 `detectSessionInUrl` + PKCE。 */
export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { supabaseConfigured, updatePassword } = useAuth();

  const [phase, setPhase] = useState('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setPhase('invalid');
      return;
    }

    timerRef.current = setTimeout(() => {
      setPhase((p) => (p === 'checking' ? 'invalid' : p));
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setPhase('form');
      }
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
        <div className="card max-w-md w-full p-6 shadow-xl border-slate-200">
          <p className="text-sm text-slate-600">{t('auth.configMissingBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="card max-w-md w-full p-6 shadow-xl border-slate-200">
        <div className="flex items-center gap-2 mb-6 text-indigo-600">
          <MapPin size={22} className="text-pink-500" />
          <span className="font-bold text-lg">{t('app.brand')}</span>
        </div>

        {phase === 'checking' && (
          <p className="text-sm text-slate-600">{t('auth.resetPasswordVerifying')}</p>
        )}

        {phase === 'invalid' && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-800">{t('auth.resetPasswordInvalidTitle')}</h1>
            <p className="text-sm text-slate-600">{t('auth.resetPasswordInvalidBody')}</p>
            <button type="button" className="btn-primary w-full" onClick={() => navigate('/login', { replace: true })}>
              {t('auth.resetPasswordGoLogin')}
            </button>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-800">{t('auth.resetPasswordTitle')}</h1>
            {inlineError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{inlineError}</p>
            )}
            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-medium text-slate-600 mb-1">
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
              <label htmlFor="reset-confirm-password" className="block text-xs font-medium text-slate-600 mb-1">
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
    </div>
  );
}
