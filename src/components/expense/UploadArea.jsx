import { useState, useRef } from 'react';
import { STRIPE_UI_ENABLED } from '../../config/features';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../store/AppContext';
import { buildAllowedExpenseCategories } from '../../utils/expenseCategories';
import { splitBatchByDuplicates } from '../../utils/duplicates';
import { resolveParseQueue } from '../../utils/sourceHash';
import DuplicateReviewDialog from './DuplicateReviewDialog';
import HashDuplicateDialog from './HashDuplicateDialog';
import { gateFilesBySourceHash, parseQueuedReceipts } from './uploadBatch';
import { isUploadBlocked } from '../../utils/planView';
import PlanStatus from '../billing/PlanStatus';
import { ImageIcon, RefreshCw } from '../ui/Icons';

export default function UploadArea() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const {
    exchangeRates,
    addExpenses,
    expenses,
    resolveDuplicateConflicts,
    notify,
    tripCurrency,
    defaultAssignee,
    homeCurrencyCode,
    settings,
    planView,
    applyBillingSnapshot,
    refreshBilling,
  } = useApp();
  const customCats = settings?.customExpenseCategories || [];
  const allowedCategories = buildAllowedExpenseCategories(settings);

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const ref = useRef(null);
  const [conflicts, setConflicts] = useState([]);
  const [hashConflicts, setHashConflicts] = useState([]);
  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;
  const pendingParseRef = useRef([]);
  const reviewingRef = useRef(false);
  const uploadBlocked = !loading && isUploadBlocked(planView);

  const handleOpenPicker = (e) => {
    if (!uploadBlocked) return;
    e.preventDefault();
    notify(STRIPE_UI_ENABLED ? t('settings.billingUpgradePrompt') : t('upload.scanLimitReached'), 'warning');
  };

  const parseDeps = () => ({
    customCats,
    accessToken: session?.access_token || '',
    homeCurrencyCode,
    tripCurrency,
    exchangeRates,
    defaultAssignee,
    allowedCategories,
    applyBillingSnapshot,
    refreshBilling,
  });

  const commitParsed = (results, lastError, totalLabel) => {
    if (results.length > 0) {
      // Compare against the current trip (and earlier receipts in this batch). Non-duplicates are added now.
      const { clean, conflicts: found } = splitBatchByDuplicates(results, expensesRef.current);
      if (clean.length > 0) addExpenses(clean);
      if (found.length > 0) setConflicts(found);
      setStep(t('upload.success', { ok: results.length, total: totalLabel }));
      setTimeout(() => { setLoading(false); setStep(''); }, 1500);
    } else if (lastError) {
      notify(lastError, 'error');
      setLoading(false);
      setStep('');
    } else {
      // Every file was skipped at the hash gate, or nothing was selected to scan. No quota used.
      setLoading(false);
      setStep('');
    }
    setProgress({ current: 0, total: 0 });
    if (ref.current) ref.current.value = '';
  };

  const runParse = async (queue) => {
    setLoading(true);
    setProgress({ current: 0, total: queue.length });
    const { results, lastError } = await parseQueuedReceipts(queue, parseDeps(), (current, total) => {
      setProgress({ current, total });
      setStep(t('upload.processing', { current, total }));
    });
    commitParsed(results, lastError, queue.length);
  };

  const finishHashReview = async (decisions) => {
    const queue = resolveParseQueue(pendingParseRef.current, hashConflicts, decisions);
    pendingParseRef.current = [];
    reviewingRef.current = false;
    setHashConflicts([]);
    if (!queue.length) {
      setLoading(false);
      setStep('');
      setProgress({ current: 0, total: 0 });
      if (ref.current) ref.current.value = '';
      return;
    }
    await runParse(queue);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || reviewingRef.current) {
      if (ref.current) ref.current.value = '';
      return;
    }
    setLoading(true);
    setProgress({ current: 0, total: 0 });
    setStep('');
    try {
      const { toParse, conflicts: found } = await gateFilesBySourceHash(files, expensesRef.current);
      if (found.length > 0) {
        pendingParseRef.current = toParse;
        reviewingRef.current = true;
        setHashConflicts(found);
        setLoading(false);
        setStep('');
        if (ref.current) ref.current.value = '';
        return;
      }
      await runParse(toParse);
    } catch (err) {
      reviewingRef.current = false;
      notify(err?.message || String(err), 'error');
      setLoading(false);
      setStep('');
      setProgress({ current: 0, total: 0 });
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <HashDuplicateDialog
        open={hashConflicts.length > 0}
        conflicts={hashConflicts}
        onConfirm={(decisions) => { void finishHashReview(decisions); }}
        onClose={() => { void finishHashReview({}); }}
      />
      <DuplicateReviewDialog
        open={conflicts.length > 0}
        conflicts={conflicts}
        existing={expenses}
        onConfirm={(decisions) => { resolveDuplicateConflicts(conflicts, decisions); setConflicts([]); }}
        onClose={() => { resolveDuplicateConflicts(conflicts, {}); setConflicts([]); }}
      />
      <PlanStatus variant="compact" />
      <input type="file" accept="image/*" multiple ref={ref} onChange={handleFiles} className="hidden" id="receipt-upload" />
      <label
        htmlFor="receipt-upload"
        onClick={(e) => {
          if (reviewingRef.current || hashConflicts.length > 0) {
            e.preventDefault();
            return;
          }
          handleOpenPicker(e);
        }}
        className={`paper-panel relative flex flex-col items-center justify-center gap-3 p-7 text-center cursor-pointer transition-all
          ${loading ? 'opacity-90' : uploadBlocked ? 'opacity-70 border-dashed' : 'hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(114,90,56,0.14)]'}`}
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--c-line)),transparent)]" />
        {loading ? (
          <div className="text-center">
            <RefreshCw className="animate-spin-slow text-teal-strong mx-auto mb-2" size={28} />
            <p className="text-teal-strong font-medium text-sm">{step}</p>
            {progress.total > 0 && (
              <div className="mt-3 w-48 mx-auto">
                <div className="bg-line rounded-full h-1.5 overflow-hidden">
                  <div className="bg-teal-strong h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <p className="text-meta text-ink-muted mt-1">{progress.current} / {progress.total}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-teal-soft p-3 rounded-full text-teal-strong inline-block mb-2">
              <ImageIcon size={28} />
            </div>
            <p className="font-semibold tracking-[-0.01em] text-ink text-base">
              {uploadBlocked ? (STRIPE_UI_ENABLED ? t('settings.billingUpgradePrompt') : t('upload.scanLimitReached')) : t('upload.batch')}
            </p>
            <p className="text-ink-muted text-sm max-w-[18rem]">{t('upload.hint')}</p>
          </div>
        )}
      </label>
    </div>
  );
}
