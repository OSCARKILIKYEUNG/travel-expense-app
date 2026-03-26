import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { PERSON_COLORS, PERSON_BG_CLASSES } from '../../utils/constants';
import { getPartialMatchPersonShareHKD } from '../../utils/personShare';

export default function PersonChart() {
  const { t } = useTranslation();
  const { expenses, people, filterPerson, exchangeRates, homeCurrencyCode } = useApp();

  const { totals, totalAll } = useMemo(() => {
    const totals = {};
    for (const person of people) {
      let sum = 0;
      for (const e of expenses) {
        if (filterPerson && filterPerson !== person) continue;
        const whole = (e.assignedTo || '共同') === person;
        if (whole) {
          sum += e.hkdAmount;
        } else if (e.items?.some((i) => (i.assignedTo || e.assignedTo || '共同') === person)) {
          sum += getPartialMatchPersonShareHKD(e, person, exchangeRates);
        }
      }
      totals[person] = sum;
    }
    return { totals, totalAll: Object.values(totals).reduce((a, b) => a + b, 0) };
  }, [expenses, people, filterPerson, exchangeRates]);

  const entries = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || totalAll === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">{t('chartsPage.noChartData')}</div>;
  }

  // Pie chart arcs
  let angle = 0;
  const arcs = entries.map(([person, amount], idx) => {
    const pct = amount / totalAll;
    const sweep = pct * 360;
    const start = angle;
    angle += sweep;
    const sr = ((start - 90) * Math.PI) / 180;
    const er = ((angle - 90) * Math.PI) / 180;
    const x1 = 100 + 80 * Math.cos(sr);
    const y1 = 100 + 80 * Math.sin(sr);
    const x2 = 100 + 80 * Math.cos(er);
    const y2 = 100 + 80 * Math.sin(er);
    const la = sweep > 180 ? 1 : 0;
    return { person, path: `M 100 100 L ${x1} ${y1} A 80 80 0 ${la} 1 ${x2} ${y2} Z`, color: PERSON_COLORS[idx % PERSON_COLORS.length] };
  });

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-bold text-slate-700">{t('personChart.title')}</h4>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-44 h-44 shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            {arcs.map((a) => (
              <path key={a.person} d={a.path} fill={a.color} opacity="0.9" />
            ))}
          </svg>
        </div>
        <div className="flex-1 space-y-2">
          {entries.map(([person, amount], idx) => (
            <div key={person} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${PERSON_BG_CLASSES[idx % PERSON_BG_CLASSES.length]}`} />
              <span className="text-sm font-medium flex-1">{person}</span>
              <span className="text-sm text-slate-600">{homeCurrencyCode} ${Math.round(amount).toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">({((amount / totalAll) * 100).toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
