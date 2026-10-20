import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { getCategoryColor } from '../../utils/expenseCategories';
import { SHOW_RECEIPT_TYPE_UI } from '../../utils/constants';
import { shouldShowListSubtotal, shouldShowSeparateDiscount } from '../../services/AIService';
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
import { expenseDateLabel } from '../../utils/date';
import { formatMoney, formatNumber } from '../../utils/currency';

function groupedAmount(value) {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return typeof value === 'number' ? formatNumber(0) : String(value);
  return formatNumber(n, 'auto');
}

function refundEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

export default function ExpenseCard({ expense, isDuplicate, duplicateOf, onDismissDuplicate, onEdit, onDelete }) {
  const { t, i18n } = useTranslation();
  const { filterPerson, exchangeRates, homeCurrencyCode, tripCurrency, people, defaultAssignee } = useApp();
  const cat = expense.category || '未分類';
  const catLabel = t(`categories.${cat}`, { defaultValue: cat });
  const storeDisplay = getExpenseStoreDisplay(expense, i18n.language, t);
  const locationDisplay = getExpenseLocationDisplay(expense, i18n.language, t);
  const personLabel = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const catColor = getCategoryColor(cat);
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
  const simplified = expense.userEditedPricing === true;
  const discountAmount = useMemo(() => Number(expense.discount) || 0, [expense.discount]);

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
      /** 有填消費稅即顯示（不限外稅單據；編輯後仍能看到） */
      showTaxRow: !isPartialMatch && taxAmount > eps,
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
        <div className="bg-mustard-soft border-b-2 border-mustard px-4 py-2 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-mustard-ink text-sm font-bold">{t('expenseCard.duplicateTitle')}</p>
            <p className="text-mustard-ink text-sm">
              {duplicateOf
                ? t('expenseCard.duplicateHintWith', { date: duplicateOf.date, store: duplicateOf.store })
                : t('expenseCard.duplicateHint')}
            </p>
          </div>
          {onDismissDuplicate && (
            <button
              type="button"
              onClick={() => onDismissDuplicate(expense)}
              className="shrink-0 min-h-[40px] rounded-xl border border-mustard bg-white px-3 text-sm font-semibold text-mustard-ink hover:bg-mustard-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mustard-ink"
            >
              {t('expenseCard.notDuplicate')}
            </button>
          )}
        </div>
      )}

      {isPartialMatch && (
        <div className="bg-teal-soft border-b border-teal/40 px-4 py-1.5 space-y-0.5">
          <span className="text-teal-strong text-xs font-medium">{t('expenseCard.partialOnly', { name: filterPerson })}</span>
          {getEffectiveRefundPositive(expense) > refundEpsilon(expense.currency) && (
            <p className="text-teal-strong text-sm leading-snug">{t('expenseCard.partialRefundHint')}</p>
          )}
        </div>
      )}

      <div className="p-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="inline-flex items-center gap-1 text-meta font-bold px-2 py-0.5 rounded-md text-ink"
              style={{ backgroundColor: catColor + '22', border: `1px solid ${catColor}66` }}
            >
              <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
              {catLabel}
            </span>
            <span className="text-meta font-bold px-2 py-0.5 rounded-md bg-teal-soft text-teal-strong border border-teal/30">
              {personLabel(resolveAssigneeDisplay(expense.assignedTo, people))}
            </span>
            {SHOW_RECEIPT_TYPE_UI && expense.receiptType && (
              <span className="text-meta px-1.5 py-0.5 rounded-md bg-teal-soft text-teal-strong border border-teal/30">
                {t(`receiptTypes.${expense.receiptType}`, { defaultValue: expense.receiptType })}
              </span>
            )}
            <span className="text-ink-muted text-meta">{expenseDateLabel(expense.date)}</span>
          </div>
          <h3 className="font-bold text-ink truncate">{storeDisplay}</h3>
          <div className="flex items-center gap-1 text-ink-muted text-xs mt-0.5">
            <MapPin size={14} />
            <span className="truncate">{locationDisplay}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isPartialMatch ? (
            <>
              <p className="text-lg font-bold text-teal-strong">
                {formatMoney(displayAmount.hkd, { code: homeCurrencyCode })}
              </p>
              <p className="text-meta text-teal-strong">
                {formatMoney(displayAmount.orig, { code: displayAmount.currency, decimals: 'auto' })}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-ink">
                {formatMoney(displayAmount.hkd, { code: homeCurrencyCode })}
              </p>
              <p className="text-xs text-ink-muted font-medium">
                {displayAmount.orig == null
                  ? ''
                  : formatMoney(displayAmount.orig, { code: displayAmount.currency, decimals: 'auto' })}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="bg-cream/80 px-4 py-3 border-t border-line">
        {(expense.currencyMismatch || expense.needsReview) && (
          <div className="bg-mustard-soft border border-mustard rounded-lg px-3 py-2 mb-2 flex items-start gap-2">
            <span className="text-mustard-ink text-sm leading-none mt-0.5">⚠</span>
            <div className="text-sm text-mustard-ink leading-snug space-y-1.5">
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
            <p className="text-sm text-ink-muted mb-1.5">
              {simplified
                ? t('expenseCard.priceLineItemsSimple')
                : isTaxExclusive
                  ? t('expenseCard.priceTaxExclusive')
                  : t('expenseCard.priceOriginal')}
            </p>
            <ul className="space-y-0.5 mb-2">
              {visibleItems.map((item, idx) => {
                const showDual =
                  !simplified &&
                  item.priceActual != null &&
                  Math.abs(item.priceActual - item.price) > Math.max(refundEpsilon(expense.currency) * 2, 0.5);
                /** 精簡模式或手動編價後以 `price` 為準，避免舊的掃描 priceActual 蓋過新價 */
                const single = simplified
                  ? (Number(item.price) || 0)
                  : item.priceActual != null
                    ? item.priceActual
                    : item.price;
                return (
                  <li key={idx} className="flex justify-between items-center text-xs text-ink-soft">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="w-1 h-1 rounded-full bg-line shrink-0" />
                      <span className="truncate">{getItemDisplayName(item, i18n.language)}</span>
                      {item.assignedTo && item.assignedTo !== expense.assignedTo && (
                        <span className="text-meta bg-teal-soft text-teal-strong px-1.5 py-0.5 rounded-full font-medium shrink-0">
                          {personLabel(item.assignedTo)}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-ink-soft ml-2 shrink-0 tabular-nums">
                      {showDual ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="line-through text-ink-muted text-meta">
                            {groupedAmount(item.price)}
                          </span>
                          <span>{groupedAmount(item.priceActual)}</span>
                        </span>
                      ) : (
                        groupedAmount(single)
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {shouldShowListSubtotal(expense) && (
              <div className="flex justify-between items-center text-xs text-ink-soft mb-2 pt-1 border-t border-line/80">
                <span>{t('editExpense.subtotal')}</span>
                <span className="font-mono tabular-nums">{groupedAmount(expense.subtotal)}</span>
              </div>
            )}
            {shouldShowSeparateDiscount(expense, refundRowsMeta.eff) && (
              <div className="flex justify-between items-center text-xs text-mustard-ink font-medium mb-2 pt-1 border-t border-line/80">
                <span>{t('expenseCard.discountLine')}</span>
                <span className="font-mono tabular-nums">- {groupedAmount(Math.abs(discountAmount))}</span>
              </div>
            )}
            {refundRowsMeta.showTaxRow && (
              <div className="flex justify-between items-center text-xs text-teal-strong font-medium mb-2 pt-1.5 border-t border-line/80">
                <span>{t('expenseCard.consumptionTax')}</span>
                <span className="font-mono tabular-nums">+ {groupedAmount(taxAmount)}</span>
              </div>
            )}
            {isPartialMatch && isTaxExclusive && partialTaxShare > 0 && (
              <div className="flex justify-between items-center text-xs text-teal-strong font-medium mb-2 pt-1.5 border-t border-line/80">
                <span>{t('expenseCard.consumptionTaxProportional')}</span>
                <span className="font-mono tabular-nums">+ {groupedAmount(partialTaxShare)}</span>
              </div>
            )}
            {refundRowsMeta.showComputedRefundRow && (
              <div className="flex justify-between items-center text-xs text-teal-strong font-medium mb-2 pt-1.5 border-t border-line/80">
                <span>{t('expenseCard.refundDiff')}</span>
                <span className="font-mono tabular-nums">- {groupedAmount(refundRowsMeta.eff)}</span>
              </div>
            )}
            {refundRowsMeta.showReceiptOnlyRow && !simplified && (
              <div className="mb-2 pt-1.5 border-t border-teal/80 space-y-1">
                <div className="flex justify-between items-center text-xs text-teal-strong font-medium">
                  <span>{t('expenseCard.receiptExemption')}</span>
                  <span className="font-mono tabular-nums">{groupedAmount(refundRowsMeta.rec)}</span>
                </div>
                <p className="text-sm text-ink-muted leading-snug">
                  {t('expenseCard.receiptExemptionNote')}
                </p>
              </div>
            )}
            {refundRowsMeta.showReceiptSecondaryRow && !simplified && (
              <div className="flex justify-between items-center text-meta text-ink-soft mb-2 pt-1 border-t border-line">
                <span>{t('expenseCard.receiptExemptionSecondary')}</span>
                <span className="font-mono tabular-nums">{groupedAmount(refundRowsMeta.rec)}</span>
              </div>
            )}

            {partialBreakdown && (
              <div className="space-y-1.5 mb-2 pt-1.5 border-t border-teal/80">
                <div className="flex justify-between items-center text-xs text-ink-soft">
                  <span>{t('expenseCard.subtotalGross')}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(partialBreakdown.subtotalGross, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-teal-strong font-medium">
                  <span>{t('expenseCard.refundProportional')}</span>
                  <span className="font-mono tabular-nums">
                    - {formatNumber(Math.abs(partialBreakdown.refundShare), 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold text-teal-strong pt-1 border-t border-teal/30">
                  <span>{t('expenseCard.netShare')}</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(partialBreakdown.netOrig, { code: expense.currency, decimals: 'auto' })}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onEdit(expense)}
            className="btn-secondary min-h-[40px] !py-2 px-3 text-sm gap-1.5"
            aria-label={t('expenseCard.editAria', { store: storeDisplay })}
          >
            <Edit size={16} /> {t('expenseCard.edit')}
          </button>
          <button
            type="button"
            onClick={() => onDelete(expense)}
            className="btn-danger-soft ml-auto text-sm"
            aria-label={t('expenseCard.deleteAria', { store: storeDisplay })}
          >
            <Trash2 size={16} /> {t('expenseCard.delete')}
          </button>
        </div>
      </div>
    </article>
  );
}
