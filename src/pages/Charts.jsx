import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../store/AppContext';
import PersonFilter from '../components/expense/PersonFilter';
import DailyChart from '../components/chart/DailyChart';
import PersonChart from '../components/chart/PersonChart';
import { getPartialMatchPersonShareHKD } from '../utils/personShare';
import { resolveAssigneeDisplay } from '../utils/people';

export default function Charts() {
  const { t } = useTranslation();
  const { expenses, filterPerson, exchangeRates, homeCurrencyCode, people, defaultAssignee } = useApp();

  const stats = useMemo(() => {
    let total = 0;
    const dates = new Set();
    for (const e of expenses) {
      if (filterPerson) {
        const whole = resolveAssigneeDisplay(e.assignedTo, people) === filterPerson;
        const hasItems = e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson);
        if (!whole && !hasItems) continue;
        if (whole) { total += e.hkdAmount; }
        else {
          total += getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates, defaultAssignee);
        }
      } else {
        total += e.hkdAmount;
      }
      dates.add(e.date);
    }
    const days = dates.size;
    return { total, days, avg: days > 0 ? total / days : 0 };
  }, [expenses, filterPerson, exchangeRates, people, defaultAssignee]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">{t('chartsPage.title')}</h1>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">
            {t('chartsPage.totalSpend', { currency: homeCurrencyCode })}{filterPerson ? ` (${filterPerson})` : ''}
          </p>
          <p className="text-xl font-bold text-violet-600 tabular-nums">{homeCurrencyCode} ${Math.round(stats.total).toLocaleString()}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">{t('chartsPage.days')}</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{stats.days}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">{t('chartsPage.dailyAvg')}</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">{homeCurrencyCode} ${Math.round(stats.avg).toLocaleString()}</p>
        </div>
      </div>

      <PersonFilter />

      <section className="card p-5">
        <h3 className="font-bold text-slate-700 mb-4">{t('chartsPage.dailyTrend')}</h3>
        <DailyChart />
      </section>

      <section className="card p-5">
        <PersonChart />
      </section>
    </div>
  );
}
