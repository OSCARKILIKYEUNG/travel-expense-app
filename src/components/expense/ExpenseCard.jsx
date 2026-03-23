import { useMemo } from 'react';
import { useApp } from '../../store/AppContext';
import { CATEGORY_COLORS } from '../../utils/constants';
import { getExchangeRate } from '../../utils/currency';
import { MapPin, Edit, Trash2 } from '../ui/Icons';

function refundEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

export default function ExpenseCard({ expense, isDuplicate, onEdit, onDelete }) {
  const { filterPerson, exchangeRates } = useApp();
  const cat = expense.category || '未分類';
  const catColor = CATEGORY_COLORS[cat] || '#9CA3AF';
  const isPartialMatch = filterPerson && (expense.assignedTo || '共同') !== filterPerson;

  const displayAmount = useMemo(() => {
    if (!isPartialMatch) return { hkd: expense.hkdAmount, orig: expense.originalAmount, currency: expense.currency };
    let total = 0;
    (expense.items || []).forEach((item) => {
      if ((item.assignedTo || expense.assignedTo || '共同') === filterPerson) {
        total += item.price || 0;
      }
    });
    const rate = getExchangeRate(expense.currency || 'HKD', exchangeRates);
    return { hkd: total * rate, orig: total, currency: expense.currency };
  }, [expense, filterPerson, isPartialMatch, exchangeRates]);

  const visibleItems = useMemo(() => {
    const items = expense.items || [];
    if (!filterPerson) return items;
    if (!isPartialMatch) return items;
    return items.filter((i) => (i.assignedTo || expense.assignedTo || '共同') === filterPerson);
  }, [expense, filterPerson, isPartialMatch]);

  const itemsGrossSum = useMemo(
    () => visibleItems.reduce((s, i) => s + (parseFloat(i.price) || 0), 0),
    [visibleItems],
  );

  const showRefundRow = useMemo(() => {
    if (isPartialMatch) return false;
    const tr = expense.taxRefund ?? 0;
    return Math.abs(tr) > refundEpsilon(expense.currency);
  }, [expense.taxRefund, expense.currency, isPartialMatch]);

  return (
    <article className="card overflow-hidden">
      {isDuplicate && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-amber-800 text-xs font-bold">可能重複記錄</p>
            <p className="text-amber-600 text-[10px]">相同日期、商品數和金額</p>
          </div>
        </div>
      )}

      {isPartialMatch && (
        <div className="bg-violet-50 border-b border-violet-200 px-4 py-1.5">
          <span className="text-violet-700 text-xs font-medium">僅顯示「{filterPerson}」的部分</span>
        </div>
      )}

      <div className="p-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: catColor + '15', color: catColor, border: `1px solid ${catColor}30` }}
            >
              {cat}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
              {expense.assignedTo || '共同'}
            </span>
            <span className="text-slate-400 text-[10px]">{expense.date}</span>
          </div>
          <h3 className="font-bold text-slate-800 truncate">{expense.store}</h3>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
            <MapPin size={11} />
            <span className="truncate">{expense.location}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {isPartialMatch ? (
            <>
              <p className="text-lg font-bold text-violet-700">
                <span className="text-[10px] text-violet-400 font-normal mr-0.5">HKD</span>
                {Math.round(displayAmount.hkd).toLocaleString()}
              </p>
              <p className="text-[10px] text-violet-400">{displayAmount.orig} {displayAmount.currency}</p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-900">
                <span className="text-xs text-slate-400 font-normal">HKD </span>
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
        {visibleItems.length > 0 && (
          <>
            <p className="text-[10px] text-slate-400 mb-1.5">品項（收據標價）</p>
            <ul className="space-y-0.5 mb-2">
              {visibleItems.map((item, idx) => (
                <li key={idx} className="flex justify-between items-center text-xs text-slate-600">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {item.assignedTo && item.assignedTo !== expense.assignedTo && (
                      <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        {item.assignedTo}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-700 ml-2 shrink-0 tabular-nums">
                    {typeof item.price === 'number' ? item.price.toLocaleString() : item.price}
                  </span>
                </li>
              ))}
            </ul>
            {showRefundRow && (
              <div className="space-y-1 mb-2 pt-1 border-t border-slate-200/80">
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>標價小計</span>
                  <span className="font-mono tabular-nums">{itemsGrossSum.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-800 font-medium">
                  <span>免稅／退稅調整</span>
                  <span className="font-mono tabular-nums">
                    {(expense.taxRefund ?? 0).toLocaleString()}
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
            aria-label={`編輯 ${expense.store}`}
          >
            <Edit size={14} /> 編輯
          </button>
          <button
            onClick={() => onDelete(expense.id, expense.store)}
            className="text-red-500 text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200
              hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label={`刪除 ${expense.store}`}
          >
            <Trash2 size={14} /> 刪除
          </button>
        </div>
      </div>
    </article>
  );
}
