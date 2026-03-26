import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORIES, CURRENCY_NAMES } from '../utils/constants';
import { todayISO } from '../utils/date';
import { ArrowLeft, Check } from '../components/ui/Icons';

export default function AddExpense() {
  const { t } = useTranslation();
  const { people, exchangeRates, addExpense, tripCurrency } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: todayISO(),
    merchant: '',
    location: '',
    category: '飲食',
    assignedTo: '共同',
    currency: tripCurrency || 'JPY',
    amount: '',
    subtotal: '',
    tax: '',
    taxRefund: '',
    discount: '',
    items: '',
  });

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const subtotal = parseFloat(form.subtotal) || 0;
    const taxRefund = parseFloat(form.taxRefund) || 0;
    const discount = parseFloat(form.discount) || 0;
    const calculated = subtotal + taxRefund + discount;
    const amount = calculated > 0 ? calculated : parseFloat(form.amount) || 0;
    const rate = exchangeRates[form.currency] || 1;

    const items = form.items
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => ({ description: l.trim(), name: l.trim() }));

    addExpense({
      id: `exp-${Date.now()}`,
      date: form.date,
      store: form.merchant || '未命名',
      location: form.location || '',
      category: form.category,
      subtotal,
      tax: parseFloat(form.tax) || 0,
      taxRefund,
      discount,
      currency: form.currency,
      originalAmount: amount,
      hkdAmount: rate > 0 ? amount / rate : amount,
      rate,
      assignedTo: form.assignedTo,
      items,
    });

    navigate('/');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost !p-2 !rounded-xl" aria-label={t('addExpense.back')}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">{t('addExpense.title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">{t('addExpense.basic')}</h2>
          <div>
            <label htmlFor="add-date" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.date')}</label>
            <input id="add-date" type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} required className="input-field" />
          </div>
          <div>
            <label htmlFor="add-merchant" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.store')}</label>
            <input id="add-merchant" type="text" value={form.merchant} onChange={(e) => patch({ merchant: e.target.value })} required className="input-field" placeholder={t('addExpense.storePlaceholder')} autoComplete="off" />
          </div>
          <div>
            <label htmlFor="add-location" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.location')}</label>
            <input id="add-location" type="text" value={form.location} onChange={(e) => patch({ location: e.target.value })} className="input-field" placeholder={t('addExpense.locationPlaceholder')} autoComplete="off" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="add-category" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.category')}</label>
              <select id="add-category" value={form.category} onChange={(e) => patch({ category: e.target.value })} className="input-field">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`categories.${c}`, { defaultValue: c })}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="add-person" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.assignTo')}</label>
              <select id="add-person" value={form.assignedTo} onChange={(e) => patch({ assignedTo: e.target.value })} className="input-field">
                {people.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-700">{t('addExpense.amountSection')}</h2>
          <div>
            <label htmlFor="add-currency" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.currency')}</label>
            <select id="add-currency" value={form.currency} onChange={(e) => patch({ currency: e.target.value })} className="input-field">
              {Object.keys(CURRENCY_NAMES).map((code) => (
                <option key={code} value={code}>{code} - {t(`currency.${code}`)}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
            <p className="text-[10px] font-bold text-slate-500">{t('addExpense.fillOne')}</p>
            <div>
              <label htmlFor="add-amount" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.amountPaid')}</label>
              <input id="add-amount" type="number" step="0.01" value={form.amount} onChange={(e) => patch({ amount: e.target.value })} className="input-field text-xs" placeholder={t('addExpense.amountPaidPlaceholder')} />
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-[10px] text-slate-500 font-medium">{t('addExpense.orSplit')}</p>
              <div>
                <label htmlFor="add-subtotal" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.subtotal')}</label>
                <input id="add-subtotal" type="number" step="0.01" value={form.subtotal} onChange={(e) => patch({ subtotal: e.target.value })} className="input-field text-xs" />
              </div>
              <div>
                <label htmlFor="add-tax" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.tax')}</label>
                <input id="add-tax" type="number" step="0.01" value={form.tax} onChange={(e) => patch({ tax: e.target.value })} className="input-field text-xs" />
              </div>
              <div>
                <label htmlFor="add-taxrefund" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.taxRefund')}</label>
                <input id="add-taxrefund" type="number" step="0.01" value={form.taxRefund} onChange={(e) => patch({ taxRefund: e.target.value })} className="input-field text-xs" placeholder={t('addExpense.taxRefundPlaceholder')} />
              </div>
              <div>
                <label htmlFor="add-discount" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.discount')}</label>
                <input id="add-discount" type="number" step="0.01" value={form.discount} onChange={(e) => patch({ discount: e.target.value })} className="input-field text-xs" placeholder={t('addExpense.discountPlaceholder')} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="add-items" className="block text-xs font-medium text-slate-600 mb-1">{t('addExpense.items')}</label>
            <textarea id="add-items" value={form.items} onChange={(e) => patch({ items: e.target.value })} rows={3} className="input-field resize-none" placeholder={t('addExpense.itemsPlaceholder')} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('addExpense.cancel')}</button>
          <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Check size={18} /> {t('addExpense.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
