import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const { supabaseConfigured, user, loading: authLoading, signIn, signUp, resendSignUpEmail } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (authLoading || !user) return;
    navigate(from, { replace: true });
  }, [authLoading, user, from, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInlineError('');
    setInlineSuccess('');
    if (!email.trim() || !password) {
      setInlineError(t('auth.errorEmpty'));
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setInlineError(error.message || t('auth.errorGeneric'));
          return;
        }
        navigate(from, { replace: true });
        return;
      }

      const { data, error } = await signUp(email.trim(), password);
      if (error) {
        setInlineError(error.message || t('auth.errorGeneric'));
        return;
      }
      if (data.session) {
        navigate(from, { replace: true });
        return;
      }
      setPendingEmail(email.trim());
      setInlineSuccess(t('auth.verifyEmailSent'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0) return;
    setInlineError('');
    setInlineSuccess('');
    const { error } = await resendSignUpEmail(pendingEmail);
    if (error) {
      setInlineError(error.message || t('auth.errorGeneric'));
      return;
    }
    setInlineSuccess(t('auth.resendOk'));
    setResendCooldown(60);
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  if (supabaseConfigured && authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <p className="text-slate-400 text-sm">{t('auth.loading')}</p>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
        <div className="card max-w-md w-full p-6 shadow-xl border-slate-200">
          <div className="flex items-center gap-2 mb-4 text-indigo-600">
            <MapPin size={22} className="text-pink-500" />
            <span className="font-bold text-lg">{t('app.brand')}</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-800 mb-2">{t('auth.configMissingTitle')}</h1>
          <p className="text-sm text-slate-600 mb-4">{t('auth.configMissingBody')}</p>
          <pre className="text-xs bg-slate-100 rounded-lg p-3 overflow-x-auto text-slate-700">
            VITE_SUPABASE_URL=…{'\n'}
            VITE_SUPABASE_ANON_KEY=…
          </pre>
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

        {pendingEmail ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-800">{t('auth.checkInboxTitle')}</h1>
            <p className="text-sm text-slate-600">{t('auth.checkInboxBody', { email: pendingEmail })}</p>
            {inlineSuccess && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                {inlineSuccess}
              </p>
            )}
            {inlineError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{inlineError}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={handleResend}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? t('auth.resendWait', { seconds: resendCooldown }) : t('auth.resend')}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setPendingEmail('');
                  setInlineSuccess('');
                  setInlineError('');
                }}
              >
                {t('auth.back')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === 'signin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => {
                  setMode('signin');
                  setInlineError('');
                }}
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === 'signup' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => {
                  setMode('signup');
                  setInlineError('');
                }}
              >
                {t('auth.signUp')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-600 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-slate-600 mb-1">
                  {t('auth.password')}
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {inlineError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{inlineError}</p>
              )}
              {mode === 'signup' && (
                <p className="text-xs text-slate-500">{t('auth.verifyHint')}</p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? t('auth.submitting') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
