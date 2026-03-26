import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getPartialMatchPersonShareHKD, getPartialMatchPersonShareOriginal } from '../utils/personShare';
import { Plus } from '../components/ui/Icons';
import PersonFilter from '../components/expense/PersonFilter';
import ExpenseList from '../components/expense/ExpenseList';
import UploadArea from '../components/expense/UploadArea';

/**
 * 首頂摘要卡曾含：備份／列印／複製／圖表捷徑，已移至「設定 → 資料管理」或底部導航。
 * 若需還原，見 git history 或 PRODUCT_ITERATION 2025-03。
 */

export default function Dashboard() {
  const { t } = useTranslation();
  const { expenses, filterPerson, exchangeRates, homeCurrencyCode } = useApp();

  const totalHKD = useMemo(() => {
    if (!filterPerson) return expenses.reduce((a, c) => a + c.hkdAmount, 0);
    let total = 0;
    for (const e of expenses) {
      const whole = (e.assignedTo || '共同') === filterPerson;
      if (whole) {
        total += e.hkdAmount;
      } else if (e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson)) {
        total += getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates);
      }
    }
    return total;
  }, [expenses, filterPerson, exchangeRates]);

  const recordCount = useMemo(() => {
    if (!filterPerson) return expenses.length;
    return expenses.filter((e) => {
      if ((e.assignedTo || '共同') === filterPerson) return true;
      return e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
    }).length;
  }, [expenses, filterPerson]);

  const currencySums = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (filterPerson) {
        const whole = (e.assignedTo || '共同') === filterPerson;
        const hasItems = e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
        if (!whole && !hasItems) continue;
        if (!whole && hasItems) {
          const c = e.originalCurrency || e.currency || 'HKD';
          map[c] = (map[c] || 0) + getPartialMatchPersonShareOriginal(e, filterPerson);
          continue;
        }
      }
      const c = e.originalCurrency || e.currency || 'HKD';
      const amt = e.originalAmount || e.hkdAmount || 0;
      if (amt > 0) map[c] = (map[c] || 0) + amt;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses, filterPerson]);

  return (
    <div className="space-y-5">
      <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative z-10">
          <p className="text-indigo-200 text-xs font-medium mb-0.5">
            {t('dashboard.totalSpend', { currency: homeCurrencyCode })}{filterPerson && ` · ${filterPerson}`}
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold mb-0.5 tabular-nums">
            {homeCurrencyCode} ${Math.round(totalHKD).toLocaleString()}
          </h2>
          <p className="text-indigo-300 text-xs">{t('dashboard.recordsCount', { count: recordCount })}</p>

          {currencySums.length > 0 && (
            <div className="border-t border-white/20 pt-3 mt-4">
              <p className="text-indigo-200 text-[10px] font-medium mb-1.5">{t('dashboard.originalTotals')}</p>
              {currencySums.map(([curr, amount]) => (
                <div key={curr} className="flex justify-between items-center text-xs mb-0.5">
                  <span className="text-indigo-200">{t(`currency.${curr}`, { defaultValue: curr })}</span>
                  <span className="font-bold">{curr} ${Math.round(amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <UploadArea />
        <Link
          to="/add"
          className="btn-primary w-full flex items-center justify-center gap-2 text-base !py-3.5 shadow-lg"
        >
          <Plus size={20} />
          {t('dashboard.manualAdd')}
        </Link>
      </section>

      <section>
        <PersonFilter />
        <ExpenseList />
      </section>
    </div>
  );
}
