import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from '../components/ui/Icons';
import { useAuth } from '../context/AuthContext';
import { formatAuthError } from '../lib/authErrors';

export default function Auth() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const {
    supabaseConfigured,
    user,
    loading: authLoading,
    signIn,
    signUp,
    resendSignUpEmail,
    signInWithGoogle,
    resetPasswordForEmail,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [inlineSuccess, setInlineSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPasswordReset, setPendingPasswordReset] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [oauthGoogleLoading, setOauthGoogleLoading] = useState(false);

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
          setInlineError(formatAuthError(error, t));
          return;
        }
        navigate(from, { replace: true });
        return;
      }

      const { data, error } = await signUp(email.trim(), password);
      if (error) {
        setInlineError(formatAuthError(error, t));
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

  const handleGoogleSignIn = async () => {
    setInlineError('');
    setOauthGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setInlineError(formatAuthError(error, t));
        setOauthGoogleLoading(false);
      }
    } catch {
      setInlineError(t('auth.errorGeneric'));
      setOauthGoogleLoading(false);
    }
  };

  const startResendCooldown = () => {
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setInlineError('');
    setInlineSuccess('');
    if (!email.trim()) {
      setInlineError(t('auth.errorEmptyEmail'));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await resetPasswordForEmail(email.trim());
      if (error) {
        setInlineError(formatAuthError(error, t));
        return;
      }
      setForgotPasswordEmail(email.trim());
      setPendingPasswordReset(true);
      setShowForgotPassword(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendReset = async () => {
    if (!forgotPasswordEmail || resendCooldown > 0) return;
    setInlineError('');
    setInlineSuccess('');
    const { error } = await resetPasswordForEmail(forgotPasswordEmail);
    if (error) {
      setInlineError(formatAuthError(error, t));
      return;
    }
    setInlineSuccess(t('auth.forgotPasswordResendOk'));
    startResendCooldown();
  };

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0) return;
    setInlineError('');
    setInlineSuccess('');
    const { error } = await resendSignUpEmail(pendingEmail);
    if (error) {
      setInlineError(formatAuthError(error, t));
      return;
    }
    setInlineSuccess(t('auth.resendOk'));
    startResendCooldown();
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

        {pendingPasswordReset ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-800">{t('auth.forgotPasswordCheckTitle')}</h1>
            <p className="text-sm text-slate-600">{t('auth.forgotPasswordSent')}</p>
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
                onClick={handleResendReset}
                disabled={resendCooldown > 0}
              >
                {resendCooldown > 0 ? t('auth.resendWait', { seconds: resendCooldown }) : t('auth.forgotPasswordResend')}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setPendingPasswordReset(false);
                  setForgotPasswordEmail('');
                  setInlineSuccess('');
                  setInlineError('');
                  setResendCooldown(0);
                }}
              >
                {t('auth.back')}
              </button>
            </div>
          </div>
        ) : pendingEmail ? (
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
            {!showForgotPassword && (
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={oauthGoogleLoading || submitting}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <GoogleIcon className="shrink-0" />
                  {oauthGoogleLoading ? t('auth.submitting') : t('auth.googleSignIn')}
                </button>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-wider">
                  <span className="flex-1 h-px bg-slate-200" />
                  {t('auth.orDivider')}
                  <span className="flex-1 h-px bg-slate-200" />
                </div>
              </div>
            )}

            {inlineError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                {inlineError}
              </p>
            )}

            <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  mode === 'signin' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
                }`}
                onClick={() => {
                  setMode('signin');
                  setShowForgotPassword(false);
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
                  setShowForgotPassword(false);
                  setInlineError('');
                }}
              >
                {t('auth.signUp')}
              </button>
            </div>

            {showForgotPassword ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-sm text-slate-600">{t('auth.forgotPasswordHint')}</p>
                <p className="text-xs text-slate-500">{t('auth.forgotPasswordGoogleHint')}</p>
                <div>
                  <label htmlFor="auth-forgot-email" className="block text-xs font-medium text-slate-600 mb-1">
                    {t('auth.email')}
                  </label>
                  <input
                    id="auth-forgot-email"
                    type="email"
                    autoComplete="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={submitting}>
                  {submitting ? t('auth.submitting') : t('auth.forgotPasswordSubmit')}
                </button>
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setInlineError('');
                  }}
                >
                  {t('auth.backToSignIn')}
                </button>
              </form>
            ) : (
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
                  {mode === 'signin' && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setInlineError('');
                        }}
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    </div>
                  )}
                </div>

                {mode === 'signup' && (
                  <p className="text-xs text-slate-500">{t('auth.verifyHint')}</p>
                )}

                <button type="submit" className="btn-primary w-full" disabled={submitting}>
                  {submitting ? t('auth.submitting') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
                </button>
              </form>
            )}
          </>
        )}

      </div>
    </div>
  );
}

function GoogleIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
