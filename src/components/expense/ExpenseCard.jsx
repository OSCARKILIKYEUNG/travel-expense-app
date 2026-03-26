import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { CATEGORY_COLORS } from '../../utils/constants';
import { getExpenseLocationDisplay, getExpenseStoreDisplay, getItemDisplayName } from '../../utils/displayNames';
import {
  getPartialMatchPersonShareHKD,
  getPartialMatchPersonShareOriginal,
  getPartialRefundShareOriginal,
  getEffectiveRefundPositive,
  sumAssignedItemPrices,
} from '../../utils/personShare';
import { MapPin, Edit, Trash2 } from '../ui/Icons';
import { resolveAssigneeDisplay } from '../../utils/people';

function refundEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

export default function ExpenseCard({ expense, isDuplicate, onEdit, onDelete }) {
  const { t, i18n } = useTranslation();
  const { filterPerson, exchangeRates, homeCurrencyCode, tripCurrency, people, defaultAssignee } = useApp();
  const cat = expense.category || '未分類';
  const catLabel = t(`categories.${cat}`, { defaultValue: cat });
  const storeDisplay = getExpenseStoreDisplay(expense, i18n.language, t);
  const locationDisplay = getExpenseLocationDisplay(expense, i18n.language, t);
  const personLabel = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const catColor = CATEGORY_COLORS[cat] || '#9CA3AF';
  const isPartialMatch = filterPerson && resolveAssigneeDisplay(expense.assignedTo, people) !== filterPerson;

  const displayAmount = useMemo(() => {
    if (!isPartialMatch) return { hkd: expense.hkdAmount, orig: expense.originalAmount, currency: expense.currency };
    const hkd = getPartialMatchPersonShareHKD(expense, filterPerson, exchangeRates, defaultAssignee);
    const orig = getPartialMatchPersonShareOriginal(expense, filterPerson, defaultAssignee);
    return { hkd, orig, currency: expense.currency };
  }, [expense, filterPerson, isPartialMatch, exchangeRates, defaultAssignee]);

  const visibleItems = useMemo(() => {
    const items = expense.items || [];
    if (!filterPerson) return items;
    if (!isPartialMatch) return items;
    return items.filter((i) => (i.assignedTo || resolveAssigneeDisplay(expense.assignedTo, people)) === filterPerson);
  }, [expense, filterPerson, isPartialMatch, people]);

  /** 收據印製之免稅額（細項可能已是免稅後價，與差額推算無關） */
  const receiptTaxExemptionAmount = useMemo(() => {
    return Math.max(0, Number(expense.receiptTaxExemptionAmount) || 0);
  }, [expense.receiptTaxExemptionAmount]);

  const isTaxExclusive = expense.receiptType === 'tax_exclusive';
  const taxAmount = useMemo(() => Number(expense.tax) || 0, [expense.tax]);

  const refundRowsMeta = useMemo(() => {
    const eps = refundEpsilon(expense.currency);
    const eff = getEffectiveRefundPositive(expense);
    const rec = receiptTaxExemptionAmount;
    const closeEnough =
      rec > eps && eff > eps && Math.abs(rec - eff) <= Math.max(eps * 3, 1.5);
    return {
      eff,
      rec,
      eps,
      showTaxRow: !isPartialMatch && isTaxExclusive && taxAmount > 0,
      showComputedRefundRow: !isPartialMatch && eff > eps,
      showReceiptOnlyRow: !isPartialMatch && rec > eps && eff <= eps,
      showReceiptSecondaryRow: !isPartialMatch && rec > eps && eff > eps && !closeEnough,
    };
  }, [expense, isPartialMatch, receiptTaxExemptionAmount, isTaxExclusive, taxAmount]);

  /** 分人：外稅時的比例消費稅 */
  const partialTaxShare = useMemo(() => {
    if (!isPartialMatch || !filterPerson || !isTaxExclusive || taxAmount <= 0) return 0;
    const personItemSum = sumAssignedItemPrices(expense, filterPerson, defaultAssignee);
    const allItemSum = (expense.items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
    if (allItemSum <= 0) return 0;
    return Math.round(taxAmount * (personItemSum / allItemSum));
  }, [expense, filterPerson, isPartialMatch, isTaxExclusive, taxAmount, defaultAssignee]);

  /** 分人檢視：原價小計、比例退稅、實攤明細（與全單「退稅」列語意一致） */
  const partialBreakdown = useMemo(() => {
    if (!isPartialMatch || !filterPerson) return null;
    const refundTotal = getEffectiveRefundPositive(expense);
    if (refundTotal <= refundEpsilon(expense.currency)) return null;
    const subtotalGross = sumAssignedItemPrices(expense, filterPerson);
    if (subtotalGross <= 0) return null;
    const refundShare = getPartialRefundShareOriginal(expense, filterPerson, defaultAssignee);
    const netOrig = getPartialMatchPersonShareOriginal(expense, filterPerson, defaultAssignee);
    return {
      subtotalGross,
      refundShare,
      netOrig,
    };
  }, [expense, filterPerson, isPartialMatch, defaultAssignee]);

  return (
    <article className="card overflow-hidden">
      {isDuplicate && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-amber-800 text-xs font-bold">{t('expenseCard.duplicateTitle')}</p>
            <p className="text-amber-600 text-[10px]">{t('expenseCard.duplicateHint')}</p>
          </div>
        </div>
      )}

      {isPartialMatch && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-1.5 space-y-0.5">
          <span className="text-violet-700 text-xs font-medium">{t('expenseCard.partialOnly', { name: filterPerson })}</span>
          {getEffectiveRefundPositive(expense) > refundEpsilon(expense.currency) && (
            <p className="text-violet-500 text-[10px] leading-tight">{t('expenseCard.partialRefundHint')}</p>
          )}
        </div>
      )}

      <div className="p-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: catColor + '15', color: catColor, border: `1px solid ${catColor}30` }}
            >
              {catLabel}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
              {personLabel(resolveAssigneeDisplay(expense.assignedTo, people))}
            </span>
            {expense.receiptType && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">
                {t(`receiptTypes.${expense.receiptType}`, { defaultValue: expense.receiptType })}
              </span>
            )}
            <span className="text-slate-400 text-[10px]">{expense.date}</span>
          </div>
          <h3 className="font-bold text-slate-800 truncate">{storeDisplay}</h3>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
            <MapPin size={11} />
            <span className="truncate">{locationDisplay}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isPartialMatch ? (
            <>
              <p className="text-lg font-bold text-violet-700">
                <span className="text-[10px] text-violet-400 font-normal mr-0.5">{homeCurrencyCode}</span>
                {Math.round(displayAmount.hkd).toLocaleString()}
              </p>
              <p className="text-[10px] text-violet-400">
                {Math.round(displayAmount.orig).toLocaleString()} {displayAmount.currency}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-900">
                <span className="text-xs text-slate-400 font-normal">{homeCurrencyCode} </span>
                {Math.round(displayAmount.hkd).toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 font-medium">
                {displayAmount.orig?.toLocaleString()} {displayAmount.currency}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100">
        {(expense.currencyMismatch || expense.needsReview) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2 flex items-start gap-2">
            <span className="text-amber-500 text-sm leading-none mt-0.5">⚠</span>
            <div className="text-[10px] text-amber-700 leading-snug space-y-1.5">
              {expense.currencyMismatch && (
                <p>{t('expenseCard.currencyMismatch', { ai: expense.aiDetectedCurrency || '—', trip: tripCurrency || '—' })}</p>
              )}
              {expense.needsReview && (
                <p>{t('expenseCard.needsReview')}</p>
              )}
            </div>
          </div>
        )}
        {visibleItems.length > 0 && (
          <>
            <p className="text-[10px] text-slate-400 mb-1.5">
              {isTaxExclusive ? t('expenseCard.priceTaxExclusive') : t('expenseCard.priceOriginal')}
            </p>
            <ul className="space-y-0.5 mb-2">
              {visibleItems.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="truncate">{getItemDisplayName(item, i18n.language)}</span>
                    {item.assignedTo && item.assignedTo !== expense.assignedTo && (
                      <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        {personLabel(item.assignedTo)}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-700 ml-2 shrink-0 tabular-nums">
                    {item.priceActual != null && Math.abs(item.priceActual - item.price) > 0.5 ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="line-through text-slate-400 text-[10px]">{typeof item.price === 'number' ? item.price.toLocaleString() : item.price}</span>
                        <span>{item.priceActual.toLocaleString()}</span>
                      </span>
                    ) : (
                      typeof item.price === 'number' ? item.price.toLocaleString() : item.price
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {refundRowsMeta.showTaxRow && (
              <div className="flex justify-between items-center text-xs text-blue-700 font-medium mb-2 pt-1.5 border-t border-slate-200/80">
                <span>{t('expenseCard.consumptionTax')}</span>
                <span className="font-mono tabular-nums">+ {taxAmount.toLocaleString()}</span>
              </div>
            )}
            {isPartialMatch && isTaxExclusive && partialTaxShare > 0 && (
              <div className="flex justify-between items-center text-xs text-blue-700 font-medium mb-2 pt-1.5 border-t border-slate-200/80">
                <span>{t('expenseCard.consumptionTaxProportional')}</span>
                <span className="font-mono tabular-nums">+ {partialTaxShare.toLocaleString()}</span>
              </div>
            )}
            {refundRowsMeta.showComputedRefundRow && (
              <div className="flex justify-between items-center text-xs text-emerald-800 font-medium mb-2 pt-1.5 border-t border-slate-200/80">
                <span>{t('expenseCard.refundDiff')}</span>
                <span className="font-mono tabular-nums">{refundRowsMeta.eff.toLocaleString()}</span>
              </div>
            )}
            {refundRowsMeta.showReceiptOnlyRow && (
              <div className="mb-2 pt-1.5 border-t border-teal-200/80 space-y-1">
                <div className="flex justify-between items-center text-xs text-teal-800 font-medium">
                  <span>{t('expenseCard.receiptExemption')}</span>
                  <span className="font-mono tabular-nums">{refundRowsMeta.rec.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-snug">
                  {t('expenseCard.receiptExemptionNote')}
                </p>
              </div>
            )}
            {refundRowsMeta.showReceiptSecondaryRow && (
              <div className="flex justify-between items-center text-[10px] text-slate-600 mb-2 pt-1 border-t border-slate-100">
                <span>{t('expenseCard.receiptExemptionSecondary')}</span>
                <span className="font-mono tabular-nums">{refundRowsMeta.rec.toLocaleString()}</span>
              </div>
            )}

            {partialBreakdown && (
              <div className="space-y-1.5 mb-2 pt-1.5 border-t border-violet-200/80">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span>{t('expenseCard.subtotalGross')}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(partialBreakdown.subtotalGross).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-800 font-medium">
                  <span>{t('expenseCard.refundProportional')}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(partialBreakdown.refundShare).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold text-violet-800 pt-1 border-t border-violet-100">
                  <span>{t('expenseCard.netShare')}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(partialBreakdown.netOrig).toLocaleString()} {expense.currency}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => onEdit(expense)}
            className="text-indigo-600 text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200
              hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            aria-label={t('expenseCard.editAria', { store: storeDisplay })}
          >
            <Edit size={14} /> {t('expenseCard.edit')}
          </button>
          <button
            onClick={() => onDelete(expense)}
            className="text-red-500 text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200
              hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={t('expenseCard.deleteAria', { store: storeDisplay })}
          >
            <Trash2 size={14} /> {t('expenseCard.delete')}
          </button>
        </div>
      </div>
    </article>
  );
}
