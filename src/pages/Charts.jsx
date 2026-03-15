import { useMemo } from 'react';
import { useApp } from '../store/AppContext';
import PersonFilter from '../components/expense/PersonFilter';
import DailyChart from '../components/chart/DailyChart';
import PersonChart from '../components/chart/PersonChart';
import { getExchangeRate } from '../utils/currency';

export default function Charts() {
  const { expenses, filterPerson, exchangeRates } = useApp();

  const stats = useMemo(() => {
    let total = 0;
    const dates = new Set();
    for (const e of expenses) {
      if (filterPerson) {
        const whole = (e.assignedTo || '共同') === filterPerson;
        const hasItems = e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === filterPerson);
        if (!whole && !hasItems) continue;
        if (whole) { total += e.hkdAmount; }
        else {
          for (const item of e.items) {
            if ((item.assignedTo || e.assignedTo || '共同') === filterPerson)
              total += (item.price || 0) * getExchangeRate(e.currency || 'HKD', exchangeRates);
          }
        }
      } else {
        total += e.hkdAmount;
      }
      dates.add(e.date);
    }
    const days = dates.size;
    return { total, days, avg: days > 0 ? total / days : 0 };
  }, [expenses, filterPerson, exchangeRates]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">統計圖表</h1>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">
            總花費{filterPerson ? ` (${filterPerson})` : ''}
          </p>
          <p className="text-xl font-bold text-violet-600 tabular-nums">${Math.round(stats.total).toLocaleString()}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">天數</p>
          <p className="text-xl font-bold text-blue-600 tabular-nums">{stats.days}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">日均</p>
          <p className="text-xl font-bold text-emerald-600 tabular-nums">${Math.round(stats.avg).toLocaleString()}</p>
        </div>
      </div>

      <PersonFilter />

      <section className="card p-5">
        <h3 className="font-bold text-slate-700 mb-4">每日花費趨勢</h3>
        <DailyChart />
      </section>

      <section className="card p-5">
        <PersonChart />
      </section>
    </div>
  );
}
