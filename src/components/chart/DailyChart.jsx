import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { getCategoryColor } from '../../utils/expenseCategories';
import { getPartialMatchPersonShareHKD } from '../../utils/personShare';
import { resolveAssigneeDisplay } from '../../utils/people';
import { expenseDateKey, expenseDateLabel } from '../../utils/date';
import { formatMoney } from '../../utils/currency';
import { chartTheme } from '../../theme/tokens';

export default function DailyChart() {
  const { t } = useTranslation();
  const { expenses, filterPerson, exchangeRates, homeCurrencyCode, people, defaultAssignee } = useApp();

  const { data, categories, max } = useMemo(() => {
    const map = {};
    const addAmount = (date, cat, amount) => {
      const day = expenseDateKey(date);
      if (!map[day]) map[day] = {};
      map[day][cat] = (map[day][cat] || 0) + amount;
    };
    for (const e of expenses) {
      const cat = e.category || '未分類';
      if (filterPerson) {
        const whole = resolveAssigneeDisplay(e.assignedTo, people) === filterPerson;
        if (whole) {
          addAmount(e.date, cat, e.hkdAmount);
        } else if (e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson)) {
          const share = getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates, defaultAssignee);
          addAmount(e.date, cat, share);
        }
      } else {
        addAmount(e.date, cat, e.hkdAmount);
      }
    }

    const data = Object.entries(map)
      .map(([date, cats]) => ({ date, categories: cats, total: Object.values(cats).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const categories = [...new Set(expenses.map((e) => e.category || '未分類'))];
    const max = Math.max(...data.map((d) => d.total), 1);
    return { data, categories, max };
  }, [expenses, filterPerson, exchangeRates, people, defaultAssignee]);

  if (data.length === 0) {
    return <div className="text-center py-12 text-sm text-ink-muted">{t('chartsPage.noData')}</div>;
  }

  /** Left margin fits Y ticks like "HKD $12,345" (right-aligned to the axis). Bar-top labels drop the currency code ("$12,345") so they fit the 80px slot; the axis and table keep the code. */
  const MARGIN_LEFT = 156;
  const MARGIN_RIGHT = 20;
  const BAR_SLOT = 80;
  const BAR_WIDTH = 50;
  const GAP_AFTER_AXIS = 12;
  const plotBarsWidth = data.length * BAR_SLOT + GAP_AFTER_AXIS;
  const chartW = Math.max(MARGIN_LEFT + plotBarsWidth + MARGIN_RIGHT, 400);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {categories.map((c) => (
          <div key={c} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: getCategoryColor(c) }} />
            <span className="text-xs text-ink-soft">{t(`categories.${c}`, { defaultValue: c })}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: `${chartW}px` }}>
          <svg className="font-sans" width="100%" height="400" viewBox={`0 0 ${chartW} 400`} preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = 300 - ratio * 260;
              const tick = formatMoney(max * ratio, { code: homeCurrencyCode });
              return (
                <g key={i}>
                  <line
                    x1={MARGIN_LEFT}
                    y1={y}
                    x2={chartW - MARGIN_RIGHT}
                    y2={y}
                    stroke={chartTheme.grid}
                    strokeWidth="1"
                    strokeDasharray={ratio === 0 ? '0' : '4 4'}
                  />
                  <text
                    x={MARGIN_LEFT - 8}
                    y={y + 4}
                    fontSize={chartTheme.axisFontSize}
                    fill={chartTheme.axis}
                    textAnchor="end"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}
            <line
              x1={MARGIN_LEFT}
              y1="300"
              x2={chartW - MARGIN_RIGHT}
              y2="300"
              stroke={chartTheme.baseline}
              strokeWidth="1.5"
            />

            {data.map((d, i) => {
              const x = MARGIN_LEFT + GAP_AFTER_AXIS + i * BAR_SLOT;
              const bw = BAR_WIDTH;
              let curY = 300;
              return (
                <g key={i}>
                  {Object.entries(d.categories).sort((a, b) => b[1] - a[1]).map(([cat, amt], j) => {
                    const h = (amt / max) * 260;
                    const sy = curY - h;
                    curY = sy;
                    return <rect key={j} x={x} y={sy} width={bw} height={h} rx="3" fill={getCategoryColor(cat)} opacity="0.85"><title>{`${t(`categories.${cat}`, { defaultValue: cat })}: ${formatMoney(amt, { code: homeCurrencyCode })}`}</title></rect>;
                  })}
                  <text x={x + bw / 2} y={curY - 8} fontSize={chartTheme.labelFontSize} fill={chartTheme.barLabel} textAnchor="middle" fontWeight="600">{formatMoney(d.total)}</text>
                  <text x={x + bw / 2} y="348" fontSize={chartTheme.labelFontSize} fill={chartTheme.axis} textAnchor="end" transform={`rotate(-40 ${x + bw / 2} 348)`}>
                    {expenseDateLabel(d.date).replace('年', '/').replace('月', '/').replace('日', '')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-beige">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-ink-soft">{t('dailyChart.date')}</th>
              {categories.map((c) => (
                <th key={c} className="px-2 py-2 text-right font-semibold text-ink-soft">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded" style={{ backgroundColor: getCategoryColor(c) }} />
                    {t(`categories.${c}`, { defaultValue: c })}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold text-teal-strong">{t('dailyChart.total')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/50'}>
                <td className="px-2 py-1.5 font-medium text-ink-soft">{expenseDateLabel(d.date)}</td>
                {categories.map((c) => (
                  <td key={c} className="px-2 py-1.5 text-right text-ink-muted">
                    {d.categories[c] ? formatMoney(d.categories[c], { code: homeCurrencyCode }) : '-'}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-bold text-teal-strong">{formatMoney(d.total, { code: homeCurrencyCode })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-teal-soft font-bold">
            <tr>
              <td className="px-2 py-2 text-ink-soft">{t('dailyChart.grandTotal')}</td>
              {categories.map((c) => {
                const columnTotal = data.reduce((s, d) => s + (d.categories[c] || 0), 0);
                return <td key={c} className="px-2 py-2 text-right text-ink-soft">{formatMoney(columnTotal, { code: homeCurrencyCode })}</td>;
              })}
              <td className="px-2 py-2 text-right text-teal-strong">{formatMoney(data.reduce((s, d) => s + d.total, 0), { code: homeCurrencyCode })}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
