import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '../ui/Dialog';
import { useApp } from '../../store/AppContext';
import { RECEIPT_TYPE_OPTIONS, SHOW_RECEIPT_TYPE_UI } from '../../utils/constants';
import { getCategorySelectOptions } from '../../utils/expenseCategories';
import { formatDateToInput, formatDateToDisplay } from '../../utils/date';
import { Check } from '../ui/Icons';
import ExpenseFormPricingSection from './ExpenseFormPricingSection';

export default function EditExpenseDialog({ open, expense, onSave, onCancel }) {
  const { t } = useTranslation();
  const { people, defaultAssignee, settings } = useApp();
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (expense) setForm({ ...expense });
  }, [expense]);

  if (!open || !form) return null;

  const patch = (updates) => setForm((p) => ({ ...p, ...updates }));

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
              {getCategorySelectOptions(settings, form.category).map((c) => (
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

        {SHOW_RECEIPT_TYPE_UI && (
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
        )}

        <ExpenseFormPricingSection
          form={form}
          patch={patch}
          people={people}
          defaultAssignee={defaultAssignee}
          idPrefix="edit"
        />
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
