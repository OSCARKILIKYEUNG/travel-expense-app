import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { parseReceipt, buildExpenseFromAI } from '../../services/AIService';
import { getExchangeRate, resolveReceiptCurrency } from '../../utils/currency';
import { ImageIcon, RefreshCw } from '../ui/Icons';

export default function UploadArea() {
  const { t } = useTranslation();
  const { settings, exchangeRates, addExpenses, notify } = useApp();
  const { customCurrencyCode, customCurrencyRate } = settings;

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const ref = useRef(null);

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
        const parsed = await parseReceipt(files[i]);
        const currency = resolveReceiptCurrency(parsed, settings);
        const rate =
          settings.defaultCurrency === 'OTHER' && currency === customCurrencyCode
            ? customCurrencyRate
            : getExchangeRate(currency, exchangeRates);
        results.push(buildExpenseFromAI(parsed, i, currency, rate));
      } catch (err) {
        console.error(`第 ${i + 1} 張處理失敗:`, err);
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
    <div>
      <input type="file" accept="image/*" multiple ref={ref} onChange={handleFiles} className="hidden" id="receipt-upload" />
      <label
        htmlFor="receipt-upload"
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all
          ${loading ? 'bg-slate-50 border-slate-300' : 'bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 shadow-sm'}`}
      >
        {loading ? (
          <div className="text-center">
            <RefreshCw className="animate-spin-slow text-indigo-600 mx-auto mb-2" size={28} />
            <p className="text-indigo-600 font-medium text-sm">{step}</p>
            {progress.total > 0 && (
              <div className="mt-3 w-48 mx-auto">
                <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{progress.current} / {progress.total}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 inline-block mb-2">
              <ImageIcon size={28} />
            </div>
            <p className="text-slate-800 font-bold text-sm">{t('upload.batch')}</p>
            <p className="text-slate-400 text-xs">{t('upload.hint')}</p>
          </div>
        )}
      </label>
    </div>
  );
}
