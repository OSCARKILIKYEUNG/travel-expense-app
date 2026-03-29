import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '../ui/Dialog';
import { useApp } from '../../store/AppContext';
import { CURRENCY_NAMES, RECEIPT_TYPE_OPTIONS } from '../../utils/constants';
import { getCategorySelectOptions } from '../../utils/expenseCategories';
import { formatDateToInput, formatDateToDisplay } from '../../utils/date';
import { Check } from '../ui/Icons';
import { inferFixedFeeFromName } from '../../utils/personShare';

export default function EditExpenseDialog({ open, expense, onSave, onCancel }) {
  const { t } = useTranslation();
  const { people, defaultAssignee, settings } = useApp();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (expense) setForm({ ...expense });
  }, [expense]);

  if (!open || !form) return null;

  const categoryOptions = getCategorySelectOptions(settings, form.category);

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

  const patchItem = (idx, updates) => {
    const items = [...(form.items || [])];
    const prev = items[idx] || {};
    const next = { ...prev, ...updates };
    if (updates.price != null && Number(updates.price) !== Number(prev.price)) {
      next.priceActual = undefined;
    }
    items[idx] = next;
    patch({ items });
  };

  const removeItem = (idx) => patch({ items: form.items.filter((_, i) => i !== idx) });

  const addItem = (name, price) => {
    patch({ items: [...(form.items || []), { name, price: parseFloat(price) || 0, assignedTo: form.assignedTo || defaultAssignee }] });
  };

  return (
    <Dialog open={open} onClose={onCancel} title={t('editExpense.title')} size="lg">
      <div className="space-y-4">
        <div>
          <label htmlFor="edit-date" className="block text-sm font-medium text-slate-700 mb-1">{t('addExpense.date')}</label>
          <input
            id="edit-date"
            type="date"
            defaultValue={formatDateToInput(form.date)}
            onBlur={(e) => patch({ date: formatDateToDisplay(e.target.value) })}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="edit-store" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.storeName')}</label>
          <input id="edit-store" type="text" defaultValue={form.store} onBlur={(e) => patch({ store: e.target.value })} className="input-field" />
        </div>

        <div>
          <label htmlFor="edit-location" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.location')}</label>
          <input id="edit-location" type="text" defaultValue={form.location} onBlur={(e) => patch({ location: e.target.value })} className="input-field" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-category" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.category')}</label>
            <select id="edit-category" defaultValue={form.category} onChange={(e) => patch({ category: e.target.value })} className="input-field">
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{t(`categories.${c}`, { defaultValue: c })}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-person" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.assignTo')}</label>
            <select id="edit-person" value={form.assignedTo || defaultAssignee} onChange={(e) => patch({ assignedTo: e.target.value })} className="input-field">
              {people.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="edit-receipt-type" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.receiptType')}</label>
          <select
            id="edit-receipt-type"
            value={form.receiptType || ''}
            onChange={(e) => patch({ receiptType: e.target.value })}
            className="input-field"
          >
            {RECEIPT_TYPE_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value}>
                {t(`receiptTypeOptions.${o.value || 'empty'}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-currency" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.currency')}</label>
            <select id="edit-currency" defaultValue={form.currency} onChange={(e) => patch({ currency: e.target.value })} className="input-field">
              {Object.keys(CURRENCY_NAMES).map((code) => (
                <option key={code} value={code}>{code} - {t(`currency.${code}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-amount" className="block text-sm font-medium text-slate-700 mb-1">{t('editExpense.amountPaid')}</label>
            <input
              id="edit-amount"
              type="number"
              value={form.originalAmount || ''}
              onChange={(e) => patch({ originalAmount: parseFloat(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          <p className="text-xs font-bold text-slate-500 mb-1">{t('editExpense.taxSection')}</p>
          <p className="text-[10px] text-slate-400 mb-2">{t('editExpense.taxHint')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label htmlFor="edit-subtotal" className="block text-[10px] text-slate-500 mb-0.5">{t('editExpense.subtotal')}</label>
              <input id="edit-subtotal" type="number" step="0.01" value={form.subtotal || ''} onChange={(e) => patch({ subtotal: parseFloat(e.target.value) || 0 })} className="input-field text-xs" />
            </div>
            <div>
              <label htmlFor="edit-tax" className="block text-[10px] text-slate-500 mb-0.5">{t('addExpense.tax')}</label>
              <input id="edit-tax" type="number" step="0.01" value={form.tax || ''} onChange={(e) => patch({ tax: parseFloat(e.target.value) || 0 })} className="input-field text-xs" />
            </div>
            <div>
              <label htmlFor="edit-taxrefund" className="block text-[10px] text-slate-500 mb-0.5">{t('editExpense.taxRefund')}</label>
              <input id="edit-taxrefund" type="number" step="0.01" value={form.taxRefund || ''} onChange={(e) => patch({ taxRefund: parseFloat(e.target.value) || 0 })} placeholder={t('addExpense.taxRefundPlaceholder')} className="input-field text-xs" />
            </div>
            <div>
              <label htmlFor="edit-discount" className="block text-[10px] text-slate-500 mb-0.5">{t('editExpense.discount')}</label>
              <input id="edit-discount" type="number" step="0.01" value={form.discount || ''} onChange={(e) => patch({ discount: parseFloat(e.target.value) || 0 })} placeholder={t('addExpense.discountPlaceholder')} className="input-field text-xs" />
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/80">
            <label htmlFor="edit-receipt-exemption" className="block text-[10px] text-slate-500 mb-0.5">
              {t('editExpense.receiptExemption')}
            </label>
            <input
              id="edit-receipt-exemption"
              type="number"
              min="0"
              step="0.01"
              value={form.receiptTaxExemptionAmount ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '') patch({ receiptTaxExemptionAmount: undefined });
                else patch({ receiptTaxExemptionAmount: Math.max(0, parseFloat(v) || 0) });
              }}
              placeholder={t('editExpense.receiptExemptionPlaceholder')}
              className="input-field text-xs"
            />
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              {t('editExpense.receiptExemptionHelp')}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-0.5">{t('editExpense.itemsTitle')}</p>
          <p className="text-[10px] text-slate-400 mb-2 leading-snug">
            {t('editExpense.itemsHelp')}
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(form.items || []).map((item, idx) => (
              <div key={idx} className="flex flex-wrap gap-1.5 items-center bg-white p-1.5 rounded-lg border border-slate-200">
                <input type="text" value={item.name || ''} onChange={(e) => patchItem(idx, { name: e.target.value })} placeholder={t('editExpense.itemNamePlaceholder')} className="input-field flex-1 min-w-[120px] !py-1.5 text-xs" />
                <input type="number" value={item.price || ''} onChange={(e) => patchItem(idx, { price: parseFloat(e.target.value) || 0 })} className="input-field w-20 !py-1.5 text-xs" />
                <select value={item.assignedTo || form.assignedTo || defaultAssignee} onChange={(e) => patchItem(idx, { assignedTo: e.target.value })} className="input-field w-24 !py-1.5 text-xs">
                  {people.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <label
                  className="flex items-center gap-0.5 text-[9px] text-slate-500 shrink-0 cursor-pointer"
                  title={t('editExpense.fixedTitle')}
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={
                      item.excludeFromRefundSplit === true ||
                      (item.excludeFromRefundSplit !== false && inferFixedFeeFromName(item.name))
                    }
                    onChange={(e) => patchItem(idx, { excludeFromRefundSplit: e.target.checked })}
                  />
                  {t('editExpense.fixed')}
                </label>
                <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded" aria-label={t('editExpense.removeItem')}>×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-2">
            <input id="new-item-name" type="text" placeholder={t('editExpense.itemNamePlaceholder')} className="input-field flex-1 text-xs" />
            <input id="new-item-price" type="number" placeholder={t('editExpense.itemPricePlaceholder')} className="input-field w-20 text-xs" />
            <button
              type="button"
              onClick={() => {
                const n = document.getElementById('new-item-name');
                const p = document.getElementById('new-item-price');
                if (n.value.trim()) { addItem(n.value.trim(), p.value); n.value = ''; p.value = ''; }
              }}
              className="btn-primary !py-1.5 text-xs !px-3"
            >
              {t('editExpense.add')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">{t('editExpense.cancel')}</button>
        <button type="button" onClick={() => onSave(form)} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Check size={18} /> {t('editExpense.save')}
        </button>
      </div>
    </Dialog>
  );
}
