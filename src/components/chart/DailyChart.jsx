import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../store/AppContext';
import { CATEGORY_COLORS } from '../../utils/constants';
import { getPartialMatchPersonShareHKD } from '../../utils/personShare';
import { resolveAssigneeDisplay } from '../../utils/people';

export default function DailyChart() {
  const { t } = useTranslation();
  const { expenses, filterPerson, exchangeRates, homeCurrencyCode, people, defaultAssignee } = useApp();

  const { data, categories, max } = useMemo(() => {
    const map = {};
    for (const e of expenses) {
      if (filterPerson) {
        const whole = resolveAssigneeDisplay(e.assignedTo, people) === filterPerson;
        if (whole) {
          if (!map[e.date]) map[e.date] = {};
          const cat = e.category || '未分類';
          map[e.date][cat] = (map[e.date][cat] || 0) + e.hkdAmount;
        } else if (e.items?.some((i) => (i.assignedTo || resolveAssigneeDisplay(e.assignedTo, people)) === filterPerson)) {
          if (!map[e.date]) map[e.date] = {};
          const cat = e.category || '未分類';
          const share = getPartialMatchPersonShareHKD(e, filterPerson, exchangeRates, defaultAssignee);
          map[e.date][cat] = (map[e.date][cat] || 0) + share;
        }
      } else {
        if (!map[e.date]) map[e.date] = {};
        const cat = e.category || '未分類';
        map[e.date][cat] = (map[e.date][cat] || 0) + e.hkdAmount;
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
    return <div className="text-center py-12 text-slate-400">{t('chartsPage.noData')}</div>;
  }

  /** 左側留空給 Y 軸刻度（含「HKD $12345」）；標籤用 textAnchor=end 靠右對齊至此線左側，避免與長條圖重疊 */
  const MARGIN_LEFT = 96;
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
            <div className="w-3 h-3 rounded" style={{ backgroundColor: CATEGORY_COLORS[c] || '#9CA3AF' }} />
            <span className="text-xs text-slate-600">{t(`categories.${c}`, { defaultValue: c })}</span>
          </div>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div style={{ minWidth: `${chartW}px` }}>
          <svg width="100%" height="350" viewBox={`0 0 ${chartW} 350`} preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = 300 - ratio * 260;
              const tick = `${homeCurrencyCode} $${Math.round(max * ratio)}`;
              return (
                <g key={i}>
                  <line
                    x1={MARGIN_LEFT}
                    y1={y}
                    x2={chartW - MARGIN_RIGHT}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                    strokeDasharray={ratio === 0 ? '0' : '4 4'}
                  />
                  <text
                    x={MARGIN_LEFT - 10}
                    y={y + 4}
                    fontSize="10"
                    fill="#94A3B8"
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
              stroke="#64748B"
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
                    return <rect key={j} x={x} y={sy} width={bw} height={h} rx="3" fill={CATEGORY_COLORS[cat] || '#9CA3AF'} opacity="0.85"><title>{`${t(`categories.${cat}`, { defaultValue: cat })}: ${homeCurrencyCode} $${Math.round(amt)}`}</title></rect>;
                  })}
                  <text x={x + bw / 2} y={curY - 6} fontSize="10" fill="#7C3AED" textAnchor="middle" fontWeight="bold">{homeCurrencyCode} ${Math.round(d.total)}</text>
                  <text x={x + bw / 2} y="320" fontSize="9" fill="#64748B" textAnchor="end" transform={`rotate(-40 ${x + bw / 2} 320)`}>
                    {d.date.replace('年', '/').replace('月', '/').replace('日', '')}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-slate-600">{t('dailyChart.date')}</th>
              {categories.map((c) => (
                <th key={c} className="px-2 py-2 text-right font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded" style={{ backgroundColor: CATEGORY_COLORS[c] || '#9CA3AF' }} />
                    {t(`categories.${c}`, { defaultValue: c })}
                  </span>
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold text-violet-600">{t('dailyChart.total')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="px-2 py-1.5 font-medium text-slate-700">{d.date}</td>
                {categories.map((c) => (
                  <td key={c} className="px-2 py-1.5 text-right text-slate-500">
                    {d.categories[c] ? `${homeCurrencyCode} $${Math.round(d.categories[c])}` : '-'}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-bold text-violet-600">{homeCurrencyCode} ${Math.round(d.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-violet-50 font-bold">
            <tr>
              <td className="px-2 py-2 text-slate-700">{t('dailyChart.grandTotal')}</td>
              {categories.map((c) => {
                const t = data.reduce((s, d) => s + (d.categories[c] || 0), 0);
                return <td key={c} className="px-2 py-2 text-right text-slate-600">{homeCurrencyCode} ${Math.round(t)}</td>;
              })}
              <td className="px-2 py-2 text-right text-violet-700">{homeCurrencyCode} ${Math.round(data.reduce((s, d) => s + d.total, 0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
