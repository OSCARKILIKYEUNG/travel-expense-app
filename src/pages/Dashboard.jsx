import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { getPartialMatchPersonShareHKD, getPartialMatchPersonShareOriginal } from '../utils/personShare';
import { resolveAssigneeDisplay } from '../utils/people';
import { Plus } from '../components/ui/Icons';
import { CornerBlob, DashedRoute } from '../components/ui/Doodles';
import PersonFilter from '../components/expense/PersonFilter';
import ExpenseList from '../components/expense/ExpenseList';
import UploadArea from '../components/expense/UploadArea';
import { formatMoney } from '../utils/currency';

/**
 * 首頂摘要卡曾含：備份／列印／複製／圖表捷徑，已移至「設定 → 資料管理」或底部導航。
 * 若需還原，見 git history 或 PRODUCT_ITERATION 2025-03。
 */

export default function Dashboard() {
  const { t } = useTranslation();
  const { expenses, filterPerson, exchangeRates, homeCurrencyCode, people, defaultAssignee, currentTrip } = useApp();

  const totalHKD = useMemo(() => {
    if (!filterPerson) return expenses.reduce((a, c) => a + c.hkdAmount, 0);
    let total = 0;
    for (const e of expenses) {
      const whole = resolveAssigneeDisplay(e.assignedTo, people) === filterPerson;
      if (whole) {
        total += e.hkdAmount;
      } else if (e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson)) {
        total += getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates, defaultAssignee);
      }
    }
    return total;
  }, [expenses, filterPerson, exchangeRates, people, defaultAssignee]);

  const recordCount = useMemo(() => {
    if (!filterPerson) return expenses.length;
    return expenses.filter((e) => {
      if (resolveAssigneeDisplay(e.assignedTo, people) === filterPerson) return true;
      return e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson);
    }).length;
  }, [expenses, filterPerson, people]);

  const currencySums = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (filterPerson) {
        const whole = resolveAssigneeDisplay(e.assignedTo, people) === filterPerson;
        const hasItems = e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson);
        if (!whole && !hasItems) continue;
        if (!whole && hasItems) {
          const c = e.originalCurrency || e.currency || 'HKD';
          map[c] = (map[c] || 0) + getPartialMatchPersonShareOriginal(e, filterPerson, defaultAssignee);
          continue;
        }
      }
      const c = e.originalCurrency || e.currency || 'HKD';
      const amt = e.originalAmount || e.hkdAmount || 0;
      if (amt > 0) map[c] = (map[c] || 0) + amt;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses, filterPerson, people, defaultAssignee]);

  return (
    <div className="space-y-6">
      <section className="paper-panel relative overflow-hidden p-6 lg:p-7">
        <CornerBlob className="absolute -right-16 -top-20 h-48 w-48" tone="sage" />
        <DashedRoute className="absolute bottom-4 right-3 hidden h-12 w-40 sm:block" />
        <div className="relative z-10 space-y-5 sm:pr-36">
          <div className="space-y-2">
            <p className="eyebrow">{currentTrip?.name || t('nav.home')}</p>
            <h2 className="display-title">
              {formatMoney(totalHKD, { code: homeCurrencyCode })}
            </h2>
            <p className="text-sm text-ink-muted">
              {t('dashboard.totalSpend', { currency: homeCurrencyCode })}{filterPerson && ` · ${filterPerson}`}
            </p>
          </div>

          <p className="text-sm text-ink-muted">{t('dashboard.recordsCount', { count: recordCount })}</p>

          {currencySums.length > 0 && (
            <div className="border-t border-line pt-4">
              <p className="eyebrow mb-2">{t('dashboard.originalTotals')}</p>
              {currencySums.map(([curr, amount]) => (
                <div key={curr} className="flex justify-between items-center text-sm mb-1">
                  <span className="text-ink-muted">{t(`currency.${curr}`, { defaultValue: curr })}</span>
                  <span className="font-semibold text-ink">{formatMoney(amount, { code: curr })}</span>
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
          className="btn-primary w-full flex items-center justify-center gap-2 text-base !py-3.5"
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
