/**
 * Map Supabase Auth errors to localized messages.
 * @param {import('@supabase/supabase-js').AuthError | null | undefined} error
 * @param {import('i18next').TFunction} t - useTranslation `t`
 */
export function formatAuthError(error, t) {
  if (!error) return t('auth.errorGeneric');
  if (error.code === 'over_email_send_rate_limit') {
    return t('auth.errorEmailRateLimit');
  }
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('email rate limit') || msg.includes('rate limit exceeded')) {
    return t('auth.errorEmailRateLimit');
  }
  return error.message || t('auth.errorGeneric');
}
