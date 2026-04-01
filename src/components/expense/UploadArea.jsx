import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../store/AppContext';
import { parseReceipt, buildExpenseFromAI } from '../../services/AIService';
import { buildAllowedExpenseCategories } from '../../utils/expenseCategories';
import { getExchangeRate, resolveReceiptCurrency } from '../../utils/currency';
import { ImageIcon, RefreshCw } from '../ui/Icons';

export default function UploadArea() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const {
    exchangeRates,
    addExpenses,
    notify,
    tripCurrency,
    defaultAssignee,
    homeCurrencyCode,
    settings,
    billing,
    applyBillingSnapshot,
    refreshBilling,
  } = useApp();
  const customCats = settings?.customExpenseCategories || [];
  const allowedCategories = buildAllowedExpenseCategories(settings);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const ref = useRef(null);
  const uploadBlocked = !loading && !billing.hasUnlimitedScans && (billing.remainingFreeScans ?? 0) <= 0;

  const handleOpenPicker = (e) => {
    if (!uploadBlocked) return;
    e.preventDefault();
    notify(t('settings.billingUpgradePrompt'), 'warning');
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setLoading(true);
    setProgress({ current: 0, total: files.length });
    const results = [];
    let lastError = '';

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      setStep(t('upload.processing', { current: i + 1, total: files.length }));
      try {
        const parsed = await parseReceipt(files[i], customCats, session?.access_token || '');
        if (parsed?._billing) applyBillingSnapshot(parsed._billing);
        const currency = resolveReceiptCurrency(parsed, homeCurrencyCode, tripCurrency);
        const rate = getExchangeRate(currency, exchangeRates);
        results.push(
          buildExpenseFromAI(
            parsed,
            i,
            currency,
            rate,
            tripCurrency,
            defaultAssignee,
            allowedCategories,
          ),
        );
      } catch (err) {
        console.error(`第 ${i + 1} 張處理失敗:`, err);
        if (err?.billing) applyBillingSnapshot(err.billing);
        if (err?.code === 'quota_exceeded') {
          await refreshBilling().catch(() => {});
        }
        lastError = err?.message || String(err);
      }
    }

    if (results.length > 0) {
      addExpenses(results);
      setStep(t('upload.success', { ok: results.length, total: files.length }));
      setTimeout(() => { setLoading(false); setStep(''); }, 1500);
    } else {
      notify(lastError || t('upload.allFailed'), 'error');
      setLoading(false);
      setStep('');
    }
    setProgress({ current: 0, total: 0 });
    if (ref.current) ref.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="rounded-[28px] border border-[var(--paper-border)] bg-[var(--paper-soft)] px-4 py-3 shadow-[0_8px_24px_rgba(114,90,56,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{t('upload.noteLabel')}</p>
            <p className="mt-1 text-sm text-[color:var(--ink-soft)]">
              {billing.hasUnlimitedScans
                ? t('upload.proQuotaReady')
                : t('upload.freeQuota', {
                  remaining: billing.remainingFreeScans ?? 0,
                  limit: billing.freeScanLimit,
                })}
            </p>
          </div>
          <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            billing.hasUnlimitedScans
              ? 'bg-[var(--accent-strong)] text-white'
              : 'bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--paper-border)]'
          }`}>
            {billing.hasUnlimitedScans ? t('settings.planPro') : t('settings.planFree')}
          </div>
        </div>
      </div>
      <input type="file" accept="image/*" multiple ref={ref} onChange={handleFiles} className="hidden" id="receipt-upload" />
      <label
        htmlFor="receipt-upload"
        onClick={handleOpenPicker}
        className={`paper-panel relative flex flex-col items-center justify-center gap-3 p-7 text-center cursor-pointer transition-all
          ${loading ? 'opacity-90' : uploadBlocked ? 'opacity-70 border-dashed' : 'hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(114,90,56,0.14)]'}`}
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--paper-border),transparent)]" />
        {loading ? (
          <div className="text-center">
            <RefreshCw className="animate-spin-slow text-[color:var(--accent-strong)] mx-auto mb-2" size={28} />
            <p className="text-[color:var(--accent-strong)] font-medium text-sm">{step}</p>
            {progress.total > 0 && (
              <div className="mt-3 w-48 mx-auto">
                <div className="bg-[var(--paper-border)] rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[var(--accent-strong)] h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <p className="text-[10px] text-[color:var(--ink-muted)] mt-1">{progress.current} / {progress.total}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-[var(--accent-soft)] p-3 rounded-full text-[var(--accent-strong)] inline-block mb-2">
              <ImageIcon size={28} />
            </div>
            <p className="font-semibold tracking-[-0.01em] text-[color:var(--ink)] text-base">
              {uploadBlocked ? t('settings.billingUpgradePrompt') : t('upload.batch')}
            </p>
            <p className="text-[color:var(--ink-muted)] text-xs max-w-[18rem]">{t('upload.hint')}</p>
          </div>
        )}
      </label>
    </div>
  );
}
