import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';

function PlanPill({ view, showLoading = true }) {
  const { t } = useTranslation();
  const label = view.state === 'pro'
    ? t('settings.planPro')
    : view.state === 'free'
      ? t('settings.planFree')
      : view.state === 'loading' && showLoading
        ? t('auth.loading')
        : '';
  if (!label) return null;
  const pro = view.state === 'pro';
  return (
    <div className={`rounded-full px-3 py-1 text-meta font-semibold shrink-0 ${
      pro
        ? 'bg-teal-strong text-white'
        : 'bg-cream text-ink-soft border border-line'
    }`}>
      {label}
    </div>
  );
}

function quotaText(view, t) {
  if (view.state === 'pro') return t('upload.proQuotaReadyShort');
  if (view.state === 'free') {
    return t('upload.freeQuota', {
      remaining: view.remainingFreeScans,
      limit: view.freeScanLimit,
    });
  }
  if (view.state === 'error') return t('settings.billingLoadWarning');
  return t('auth.loading');
}

function StaleNote({ view }) {
  const { t } = useTranslation();
  const { billing } = useApp();
  if ((view.state !== 'pro' && view.state !== 'free') || !view.stale) return null;
  const text = billing.error ? t('settings.billingLoadWarning') : t('settings.billingRefreshing');
  return <p className="mt-1 text-sm text-ink-muted">{text}</p>;
}

function SkeletonCard() {
  return (
    <div className="rounded-[22px] bg-cream-soft border border-line p-4 space-y-3" aria-hidden="true">
      <div className="h-3 w-20 rounded-full bg-line animate-pulse" />
      <div className="h-7 w-28 rounded-full bg-line animate-pulse" />
      <div className="h-3 w-40 rounded-full bg-line animate-pulse" />
    </div>
  );
}

function CompactStatus() {
  const { t } = useTranslation();
  const { planView } = useApp();
  const loading = planView.state === 'loading';
  const error = planView.state === 'error';
  return (
    <div className="rounded-[28px] border border-line bg-cream-soft px-4 py-3 shadow-[0_8px_24px_rgba(114,90,56,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {loading ? (
            <div className="flex items-center gap-2 min-h-5" aria-busy="true">
              <span className="inline-block h-3 w-36 rounded-full bg-line animate-pulse" />
              <span className="text-sm text-ink-muted">{t('auth.loading')}</span>
            </div>
          ) : (
            <p className={`text-sm ${error ? 'text-mustard-ink' : 'text-ink-soft'}`}>
              {quotaText(planView, t)}
            </p>
          )}
          <StaleNote view={planView} />
        </div>
        {/* Loading copy already sits on the left; a second 載入中… pill would repeat it. */}
        <PlanPill view={planView} showLoading={false} />
      </div>
    </div>
  );
}

function planMeta(view, t) {
  if (view.state === 'free') return t('settings.billingStatusFree');
  if (view.state === 'pro' && view.subscriptionStatus) {
    return t('settings.billingStatusValue', { status: view.subscriptionStatus });
  }
  return '';
}

function PanelStatus({ extra, onRetry, children }) {
  const { t } = useTranslation();
  const { planView, billing, refreshBilling } = useApp();
  const retry = onRetry || refreshBilling;
  const settled = planView.state === 'pro' || planView.state === 'free';
  const cols = extra ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">{children}</div>
        <PlanPill view={planView} />
      </div>

      {planView.state === 'loading' && (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {planView.state === 'error' && (
        <div className="space-y-3">
          <p className="text-sm text-mustard-ink">{t('settings.billingLoadWarning')}</p>
          <button
            type="button"
            className="btn-secondary text-sm !py-2"
            onClick={() => { void retry(); }}
            disabled={billing.refreshing}
          >
            {billing.refreshing ? t('settings.billingRefreshing') : t('settings.billingRefresh')}
          </button>
        </div>
      )}

      {settled && (
        <>
          <StaleNote view={planView} />
          <div className={`grid gap-3 ${cols}`}>
            <div className="rounded-[22px] bg-cream-soft border border-line p-4">
              <p className="eyebrow">{t('settings.billingPlanLabel')}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {planView.state === 'pro' ? t('settings.planPro') : t('settings.planFree')}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{planMeta(planView, t)}</p>
            </div>

            <div className="rounded-[22px] bg-cream-soft border border-line p-4">
              <p className="eyebrow">{t('settings.billingUsageLabel')}</p>
              {planView.state === 'pro' ? (
                <>
                  <p className="mt-2 text-2xl font-semibold text-ink">{t('settings.billingUnlimited')}</p>
                  <p className="mt-1 text-sm text-ink-muted">{t('settings.billingUnlimitedHint')}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {t('settings.billingRemainingValue', { count: planView.remainingFreeScans })}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('settings.billingUsedValue', {
                      used: planView.usedReceiptScans,
                      limit: planView.freeScanLimit,
                    })}
                  </p>
                </>
              )}
            </div>

            {extra}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The only plan-status renderer. `compact` is the home quota line;
 * `panel` is the Settings plan and usage cards.
 */
export default function PlanStatus({ variant = 'compact', extra = null, onRetry, children }) {
  if (variant === 'panel') {
    return <PanelStatus extra={extra} onRetry={onRetry}>{children}</PanelStatus>;
  }
  return <CompactStatus />;
}
