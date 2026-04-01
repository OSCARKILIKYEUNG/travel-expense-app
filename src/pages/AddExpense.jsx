import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getSelectableExpenseCategories } from '../utils/expenseCategories';
import { todayISO } from '../utils/date';
import { ArrowLeft, Check } from '../components/ui/Icons';
import ExpenseFormPricingSection from '../components/expense/ExpenseFormPricingSection';

export default function AddExpense() {
  const { t } = useTranslation();
  const { people, exchangeRates, addExpense, tripCurrency, defaultAssignee, settings } = useApp();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: todayISO(),
    merchant: '',
    location: '',
    category: '飲食',
    assignedTo: defaultAssignee,
    currency: tripCurrency || 'JPY',
    originalAmount: 0,
    subtotal: 0,
    tax: 0,
    taxRefund: 0,
    discount: 0,
    receiptTaxExemptionAmount: undefined,
    items: [],
  });

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

  useEffect(() => {
    setForm((p) => (people.includes(p.assignedTo) ? p : { ...p, assignedTo: defaultAssignee }));
  }, [people, defaultAssignee]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.originalAmount) || 0;
    const rate = exchangeRates[form.currency] || 1;

    addExpense({
      id: `exp-${Date.now()}`,
      date: form.date,
      store: form.merchant || '未命名',
      location: form.location || '',
      category: form.category,
      subtotal: parseFloat(form.subtotal) || 0,
      tax: parseFloat(form.tax) || 0,
      taxRefund: parseFloat(form.taxRefund) || 0,
      discount: parseFloat(form.discount) || 0,
      currency: form.currency,
      originalAmount: amount,
      hkdAmount: rate > 0 ? amount / rate : amount,
      rate,
      assignedTo: form.assignedTo,
      items: form.items || [],
      ...(form.receiptTaxExemptionAmount != null && form.receiptTaxExemptionAmount > 0
        ? { receiptTaxExemptionAmount: form.receiptTaxExemptionAmount }
        : {}),
    });

    navigate('/');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-ghost !p-2 !rounded-xl" aria-label={t('addExpense.back')}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="eyebrow">{t('nav.add')}</p>
          <h1 className="display-title text-[color:var(--ink)] text-[clamp(1.7rem,3vw,2.5rem)]">{t('addExpense.title')}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="paper-panel p-5 space-y-4">
          <h2 className="section-title">{t('addExpense.basic')}</h2>
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
                {getSelectableExpenseCategories(settings).map((c) => (
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

        <div className="paper-panel p-5 space-y-4">
          <h2 className="section-title">{t('addExpense.amountSection')}</h2>
          <ExpenseFormPricingSection
            form={form}
            patch={patch}
            people={people}
            defaultAssignee={defaultAssignee}
            idPrefix="add"
          />
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
