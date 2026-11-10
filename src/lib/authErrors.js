/**
 * Map Supabase Auth errors to localized, non-enumerating messages.
 * @param {import('@supabase/supabase-js').AuthError | null | undefined} error
 * @param {import('i18next').TFunction} t - useTranslation `t`
 */
export function formatAuthError(error, t) {
  if (!error) return t('auth.errorGeneric');
  const code = String(error.code || '').toLowerCase();
  const status = Number(error.status);
  const name = String(error.name || '').toLowerCase();
  const msg = String(error.message || '').toLowerCase();

  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit') || msg.includes('rate limit exceeded')) {
    return t('auth.errorEmailRateLimit');
  }
  if (
    code === 'over_request_rate_limit' ||
    status === 429 ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  ) {
    return t('auth.errorRateLimit');
  }
  if (
    name.includes('retryablefetch') ||
    code === 'network_error' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('offline')
  ) {
    return t('auth.errorOffline');
  }
  if (
    code === 'invalid_credentials' ||
    code === 'user_not_found' ||
    code === 'invalid_grant' ||
    code === 'email_not_confirmed' ||
    code === 'user_already_exists' ||
    msg.includes('invalid login credentials') ||
    msg.includes('invalid email or password') ||
    msg.includes('user not found') ||
    msg.includes('wrong password') ||
    msg.includes('email not confirmed') ||
    msg.includes('already registered')
  ) {
    return t('auth.errorInvalidCredentials');
  }
  if (
    code === 'session_expired' ||
    msg.includes('session expired') ||
    msg.includes('jwt expired')
  ) {
    return t('auth.errorSessionExpired');
  }
  return t('auth.errorGeneric');
}

/**
 * Returns true if the given session object has an `expires_at` timestamp in the past.
 * @param {any} session
 */
export function isSessionExpired(session) {
  if (!session || typeof session !== 'object') return false;
  if (typeof session.expires_at === 'number' && Number.isFinite(session.expires_at)) {
    return session.expires_at * 1000 <= Date.now();
  }
  return false;
}

/**
 * Verifies whether a confirmed, non-expired authenticated session exists.
 * Never authorizes based solely on `signIn` returning `{ error: null }` without a session/user,
 * and never authorizes based on a `user` object alone without a confirmed `session`.
 * @param {{ session?: any, user?: any, signInResult?: any }} params
 */
export function hasConfirmedSession({ session, user, signInResult } = {}) {
  if (signInResult?.error) return false;

  const candidateSession = signInResult?.data?.session ?? session;
  if (!candidateSession || typeof candidateSession !== 'object') {
    return false;
  }
  if (isSessionExpired(candidateSession)) {
    return false;
  }
  if (
    candidateSession.access_token !== undefined &&
    (typeof candidateSession.access_token !== 'string' || !candidateSession.access_token.trim())
  ) {
    return false;
  }

  const effectiveUser =
    signInResult?.data?.user ??
    candidateSession.user ??
    user ??
    null;

  return Boolean(
    effectiveUser &&
      typeof effectiveUser === 'object' &&
      (effectiveUser.id || effectiveUser.email),
  );
}

