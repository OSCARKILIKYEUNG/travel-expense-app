import { useTranslation } from 'react-i18next';
import { CURRENCY_NAMES } from '../../utils/constants';
import { inferFixedFeeFromName } from '../../utils/personShare';

/**
 * 金額／稅務／收據免稅／細項（與編輯對話框相同結構），供新增頁與編輯共用。
 */
export default function ExpenseFormPricingSection({
  form,
  patch,
  people,
  defaultAssignee,
  idPrefix,
}) {
  const { t } = useTranslation();

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

  const removeItem = (idx) => patch({ items: (form.items || []).filter((_, i) => i !== idx) });

  const addItem = (name, price) => {
    patch({
      items: [
        ...(form.items || []),
        {
          name,
          price: parseFloat(price) || 0,
          assignedTo: form.assignedTo || defaultAssignee,
        },
      ],
    });
  };

  const newNameId = `${idPrefix}-new-item-name`;
  const newPriceId = `${idPrefix}-new-item-price`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-currency`} className="block text-sm font-medium text-slate-700 mb-1">
            {t('editExpense.currency')}
          </label>
          <select
            id={`${idPrefix}-currency`}
            value={form.currency}
            onChange={(e) => patch({ currency: e.target.value })}
            className="input-field"
          >
            {Object.keys(CURRENCY_NAMES).map((code) => (
              <option key={code} value={code}>
                {code} - {t(`currency.${code}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-amount`} className="block text-sm font-medium text-slate-700 mb-1">
            {t('editExpense.amountPaid')}
          </label>
          <input
            id={`${idPrefix}-amount`}
            type="number"
            step="0.01"
            value={form.originalAmount || ''}
            onChange={(e) => patch({ originalAmount: parseFloat(e.target.value) || 0 })}
            className="input-field"
          />
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <p className="text-xs font-bold text-slate-500 mb-1">{t('editExpense.taxSection')}</p>
        <p className="text-[10px] text-slate-400 mb-2 leading-snug">{t('editExpense.taxHint')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label htmlFor={`${idPrefix}-subtotal`} className="block text-[10px] text-slate-500 mb-0.5">
              {t('editExpense.subtotal')}
            </label>
            <input
              id={`${idPrefix}-subtotal`}
              type="number"
              step="0.01"
              value={form.subtotal || ''}
              onChange={(e) => patch({ subtotal: parseFloat(e.target.value) || 0 })}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-tax`} className="block text-[10px] text-slate-500 mb-0.5">
              {t('addExpense.tax')}
            </label>
            <input
              id={`${idPrefix}-tax`}
              type="number"
              step="0.01"
              value={form.tax || ''}
              onChange={(e) => patch({ tax: parseFloat(e.target.value) || 0 })}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-taxrefund`} className="block text-[10px] text-slate-500 mb-0.5">
              {t('editExpense.taxRefund')}
            </label>
            <input
              id={`${idPrefix}-taxrefund`}
              type="number"
              step="0.01"
              value={form.taxRefund || ''}
              onChange={(e) => patch({ taxRefund: parseFloat(e.target.value) || 0 })}
              placeholder={t('addExpense.taxRefundPlaceholder')}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-discount`} className="block text-[10px] text-slate-500 mb-0.5">
              {t('editExpense.discount')}
            </label>
            <input
              id={`${idPrefix}-discount`}
              type="number"
              step="0.01"
              value={form.discount || ''}
              onChange={(e) => patch({ discount: parseFloat(e.target.value) || 0 })}
              placeholder={t('addExpense.discountPlaceholder')}
              className="input-field text-xs"
            />
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-slate-200/80">
          <label htmlFor={`${idPrefix}-receipt-exemption`} className="block text-[10px] text-slate-500 mb-0.5">
            {t('editExpense.receiptExemption')}
          </label>
          <input
            id={`${idPrefix}-receipt-exemption`}
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
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">{t('editExpense.receiptExemptionHelp')}</p>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-700 mb-0.5">{t('editExpense.itemsTitle')}</p>
        <p className="text-[10px] text-slate-400 mb-2 leading-snug">{t('editExpense.itemsHelp')}</p>
        <div
          className="flex flex-wrap gap-1.5 items-center px-1.5 pb-1 text-[10px] text-slate-500 font-medium max-sm:hidden"
          aria-hidden
        >
          <span className="flex-1 min-w-[120px]">{t('editExpense.itemColName')}</span>
          <span className="w-20 text-center shrink-0">{t('editExpense.itemColTagPrice')}</span>
          <span className="w-24 shrink-0">{t('editExpense.assignTo')}</span>
          <span className="w-14 shrink-0">{t('editExpense.fixed')}</span>
          <span className="w-6 shrink-0" />
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(form.items || []).map((item, idx) => (
            <div
              key={idx}
              className="flex flex-wrap gap-1.5 items-center bg-white p-1.5 rounded-lg border border-slate-200"
            >
              <input
                type="text"
                value={item.name || ''}
                onChange={(e) => patchItem(idx, { name: e.target.value })}
                placeholder={t('editExpense.itemNamePlaceholder')}
                className="input-field flex-1 min-w-[120px] !py-1.5 text-xs"
                aria-label={t('editExpense.itemColName')}
              />
              <input
                type="number"
                step="0.01"
                value={item.price || ''}
                onChange={(e) => patchItem(idx, { price: parseFloat(e.target.value) || 0 })}
                className="input-field w-20 !py-1.5 text-xs"
                aria-label={t('editExpense.itemColTagPrice')}
              />
              <select
                value={item.assignedTo || form.assignedTo || defaultAssignee}
                onChange={(e) => patchItem(idx, { assignedTo: e.target.value })}
                className="input-field w-24 !py-1.5 text-xs"
              >
                {people.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label
                className="flex items-center gap-0.5 text-[9px] text-slate-500 shrink-0 cursor-pointer w-14"
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
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-red-400 hover:text-red-600 px-1.5 font-bold text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                aria-label={t('editExpense.removeItem')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <input id={newNameId} type="text" placeholder={t('editExpense.itemNamePlaceholder')} className="input-field flex-1 min-w-[100px] text-xs" />
          <input id={newPriceId} type="number" step="0.01" placeholder={t('editExpense.itemPricePlaceholder')} className="input-field w-20 text-xs" />
          <button
            type="button"
            onClick={() => {
              const n = document.getElementById(newNameId);
              const p = document.getElementById(newPriceId);
              if (n?.value?.trim()) {
                addItem(n.value.trim(), p?.value ?? '');
                n.value = '';
                if (p) p.value = '';
              }
            }}
            className="btn-primary !py-1.5 text-xs !px-3"
          >
            {t('editExpense.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
