import { useMemo } from 'react';
import { expenseDateKey } from '../../utils/date';
import { REF_CATEGORIES } from './mockRefTrip';
import { CATEGORY_DOT, Sparkle, Tape } from './parts';
import { fmtHKD, groupLedger } from './refLogic';
import {
  categorySplit,
  chartsMode,
  dailyStacks,
  paymentSplit,
  remainingPerDay,
  settleUp,
  todayVsAverage,
  topExpenses,
} from './refCharts';

const hk = (n) => `HK$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

const SHORT_WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function shortDayLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '未有日期';
  const [y, m, d] = iso.split('-').map(Number);
  const w = SHORT_WEEK[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} ${w}`;
}

const CATEGORY_STROKE = {
  飲食: 'rgb(var(--c-coral))',
  交通: 'rgb(var(--c-teal))',
  購物: 'rgb(var(--c-sakura-ink))',
  住宿: 'rgb(var(--c-mustard))',
  娛樂: 'rgb(var(--c-sage))',
  其他: 'rgb(var(--c-ink-muted))',
};

function formatNet(net) {
  const abs = Math.round(Math.abs(Number(net) || 0));
  if (abs === 0) return '0';
  return net > 0 ? `+${abs.toLocaleString('en-US')}` : `−${abs.toLocaleString('en-US')}`;
}

/**
 * Handmade travel-diary ChartsView with mode-aware sections (before / during / review),
 * budget allowance, cash vs card split, SVG category donut, horizontal stacked daily bars,
 * top-5 expenses (in review), and split-bill settlement.
 */
export default function ChartsView({ trip, today, onOpenDay, onOpenLedger }) {
  const expenses = useMemo(() => trip?.expenses || [], [trip?.expenses]);
  const people = useMemo(() => trip?.settings?.people || ['共同'], [trip?.settings?.people]);
  const participants = useMemo(() => people.filter((p) => p && p !== '共同'), [people]);
  const budget = trip?.settings?.budget ?? null;

  const mode = useMemo(() => chartsMode(trip, today), [trip, today]);
  const rem = useMemo(
    () =>
      remainingPerDay({
        budget,
        expenses,
        startDate: trip?.startDate,
        endDate: trip?.endDate,
        today,
      }),
    [budget, expenses, trip?.startDate, trip?.endDate, today],
  );
  const tva = useMemo(() => todayVsAverage(expenses, trip, today), [expenses, trip, today]);
  const pay = useMemo(() => paymentSplit(expenses), [expenses]);
  const cats = useMemo(() => categorySplit(expenses, REF_CATEGORIES), [expenses]);
  const daily = useMemo(() => dailyStacks(expenses, trip, today, REF_CATEGORIES), [expenses, trip, today]);
  const top5 = useMemo(() => topExpenses(expenses, 5), [expenses]);
  const settlement = useMemo(() => settleUp(expenses, people), [expenses, people]);

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e?.hkdAmount || 0), 0), [expenses]);
  const byDayDated = useMemo(() => groupLedger(expenses).filter((g) => g.iso), [expenses]);
  const dayCount = byDayDated.length || 1;
  const summaryAvg = Math.round(total / dayCount);

  const todaySection = rem ? (
    <section key="today" data-section="today" className="paper-panel relative space-y-3 p-4">
      <Tape tone="mustard" className="-top-2 left-6 z-10 h-4 w-20 -rotate-1" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line bg-cream p-3">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">今日使咗</p>
          <p className="mt-0.5 whitespace-nowrap font-display text-xl font-bold tabular-nums text-teal-strong">
            {hk(tva.today)}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-cream p-3">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">旅程日均</p>
          <p className="mt-0.5 whitespace-nowrap font-display text-xl font-bold tabular-nums text-ink">
            {hk(tva.avg)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-line bg-cream px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`whitespace-nowrap text-sm font-bold ${
              rem.over ? 'text-coral-ink' : 'text-teal-strong'
            }`}
          >
            {rem.over
              ? `已超出預算 ${hk(Math.abs(rem.left))}`
              : mode === 'before'
                ? `旅程未開始 · 每日可以使 ${hk(rem.perDay)}`
                : rem.lastDay
                  ? `今日仲可以使 ${hk(rem.perDay)}`
                  : `之後每日仲可以使 ${hk(rem.perDay)}`}
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-pill bg-beige">
          <div
            className={`h-full rounded-pill transition-all ${rem.over ? 'bg-coral-ink' : 'bg-teal-strong'}`}
            style={{ width: `${Math.min(100, Math.max(4, rem.pct))}%` }}
          />
        </div>
        <p className="whitespace-nowrap font-mono text-meta font-semibold text-ink-soft">
          已用 {hk(rem.spent)} / {hk(rem.budget)} · {rem.pct}%
        </p>
      </div>
    </section>
  ) : null;

  const summarySection = (
    <section key="summary" data-section="summary" className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">總花費</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-teal-strong">{fmtHKD(total)}</p>
        </div>
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">天數</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-ink">{byDayDated.length} 日</p>
        </div>
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">日均</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-ink">{fmtHKD(summaryAvg)}</p>
        </div>
      </div>
      {mode === 'review' && rem && (
        <div className="paper-panel flex items-center justify-between px-4 py-2.5">
          <span
            className={`whitespace-nowrap text-meta font-bold ${
              rem.over ? 'text-coral-ink' : 'text-teal-strong'
            }`}
          >
            {rem.over
              ? `預算 ${hk(rem.budget)} · 已超出 ${hk(Math.abs(rem.left))}（${rem.pct}%）`
              : `預算 ${hk(rem.budget)} · 用咗 ${rem.pct}%`}
          </span>
        </div>
      )}
    </section>
  );

  const cashPct = pay.total > 0 ? Math.round((pay.cash.total / pay.total) * 100) : 0;
  const cardPct = pay.total > 0 ? Math.round((pay.card.total / pay.total) * 100) : 0;

  const paymentSection = (
    <section key="payment" data-section="payment" className="paper-panel space-y-2.5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">現金 vs 卡</h2>
        <span className="whitespace-nowrap text-meta font-medium text-ink-muted">點按篩選帳本</span>
      </div>

      <div className="flex h-3 overflow-hidden rounded-pill bg-beige">
        {pay.cash.total > 0 && (
          <div
            className="h-full bg-mustard transition-all"
            style={{ width: `${Math.max(6, cashPct)}%` }}
          />
        )}
        {pay.card.total > 0 && (
          <div
            className="h-full bg-teal-strong transition-all"
            style={{ width: `${Math.max(6, cardPct)}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-testid="chart-pay-cash"
          onClick={() => onOpenLedger?.({ payment: 'cash' })}
          className="flex min-h-11 items-center justify-between gap-1.5 rounded-xl border border-line bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-meta font-bold text-ink">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-mustard" />
            <span>現金 {hk(pay.cash.total)} · {cashPct}%</span>
          </span>
        </button>

        <button
          type="button"
          data-testid="chart-pay-card"
          onClick={() => onOpenLedger?.({ payment: 'card' })}
          className="flex min-h-11 items-center justify-between gap-1.5 rounded-xl border border-line bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-meta font-bold text-ink">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-strong" />
            <span>卡 {hk(pay.card.total)} · {cardPct}%</span>
          </span>
        </button>
      </div>
    </section>
  );

  // SVG Donut geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;
  const donutArcs = cats.map((row) => {
    const fraction = total > 0 ? row.total / total : 0;
    const arcLen = Math.max(0, fraction * circumference);
    const offset = -cumulativeFraction * circumference;
    cumulativeFraction += fraction;
    return {
      ...row,
      arcLen,
      offset,
      stroke: CATEGORY_STROKE[row.cat] || CATEGORY_STROKE.其他,
    };
  });

  const categorySection = (
    <section key="category" data-section="category" className="paper-panel relative space-y-3 p-4">
      <Tape tone="coral" className="-top-2 right-6 z-10 h-4 w-16 rotate-1" />
      <h2 className="whitespace-nowrap font-display text-lg text-ink">類別花費分佈</h2>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
        <div className="relative flex shrink-0 items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className="h-36 w-36 shrink-0"
            role="img"
            aria-label="類別花費分佈圓環圖"
          >
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="rgb(var(--c-beige))"
              strokeWidth="16"
            />
            <g transform="rotate(-90 80 80)">
              {donutArcs.map((arc) => (
                <circle
                  key={arc.cat}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={arc.stroke}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={`${arc.arcLen} ${circumference}`}
                  strokeDashoffset={arc.offset}
                  className="cursor-pointer transition-opacity hover:opacity-85"
                  onClick={() => onOpenLedger?.({ category: arc.cat })}
                />
              ))}
            </g>
            <text
              x="80"
              y="74"
              textAnchor="middle"
              fontSize="12"
              className="fill-current text-meta font-medium text-ink-muted"
            >
              總花費
            </text>
            <text
              x="80"
              y="94"
              textAnchor="middle"
              fontSize="14"
              className="fill-current font-mono text-sm font-bold text-ink"
            >
              {hk(total)}
            </text>
          </svg>
        </div>

        <div className="w-full min-w-0 flex-1 space-y-1.5">
          {cats.map((row) => {
            const dotTone = CATEGORY_DOT[row.cat] || 'bg-teal';
            return (
              <button
                key={row.cat}
                type="button"
                data-testid={`chart-cat-${row.cat}`}
                onClick={() => onOpenLedger?.({ category: row.cat })}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-meta font-bold text-ink">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotTone}`} />
                  <span>
                    {row.cat} · {row.count} 筆
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink-soft">
                  {hk(row.total)} · {row.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const avgPct = daily.max > 0 ? Math.min(100, Math.max(0, Math.round((daily.avg / daily.max) * 100))) : 0;

  const dailySection = (
    <section key="daily" data-section="daily" className="paper-panel space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">每日花費</h2>
        {daily.rows.length > 0 && (
          <span className="whitespace-nowrap font-mono text-meta font-semibold text-ink-muted">
            日均 {hk(daily.avg)}
          </span>
        )}
      </div>

      {daily.rows.length === 0 ? (
        <p className="whitespace-nowrap py-2 text-meta text-ink-muted">旅程未開始，尚無每日花費趨勢。</p>
      ) : (
        <div className="space-y-2">
          {daily.rows.map((row) => {
            const barPct =
              daily.max > 0 ? Math.max(row.total > 0 ? 6 : 0, Math.round((row.total / daily.max) * 100)) : 0;
            return (
              <button
                key={row.iso}
                type="button"
                data-testid={`chart-bar-${row.iso}`}
                onClick={() => onOpenDay?.(row.iso)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  row.isToday
                    ? 'border-teal-strong bg-teal-soft/60 ring-1 ring-teal-strong'
                    : 'border-line/60 bg-cream hover:bg-beige/50'
                }`}
              >
                <span className="flex w-[5.5rem] shrink-0 items-center gap-1 whitespace-nowrap text-meta font-bold text-ink">
                  <span>{shortDayLabel(row.iso)}</span>
                  {row.isToday && (
                    <span className="rounded-pill bg-teal-strong px-1.5 py-0.5 text-meta font-bold leading-none text-white">
                      今日
                    </span>
                  )}
                </span>

                <div className="relative h-3.5 min-w-0 flex-1 rounded-pill bg-beige">
                  <div
                    className="flex h-full overflow-hidden rounded-pill"
                    style={{ width: `${barPct}%` }}
                  >
                    {row.segments.map((seg) => {
                      const segTone = CATEGORY_DOT[seg.cat] || 'bg-teal';
                      const segPct = row.total > 0 ? (seg.total / row.total) * 100 : 0;
                      return (
                        <span
                          key={seg.cat}
                          className={`h-full ${segTone}`}
                          style={{ width: `${segPct}%` }}
                        />
                      );
                    })}
                  </div>
                  {daily.avg > 0 && daily.max > 0 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-1 -top-1 w-0 border-l border-dashed border-ink-soft/75"
                      style={{ left: `${avgPct}%` }}
                    />
                  )}
                </div>

                <span className="w-[4.75rem] shrink-0 whitespace-nowrap text-right font-mono text-meta font-semibold text-teal-strong">
                  {hk(row.total)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const top5Section = (
    <section key="top5" data-section="top5" className="paper-panel space-y-2.5 p-4">
      <h2 className="whitespace-nowrap font-display text-lg text-ink">最貴 5 筆</h2>
      <div className="space-y-2">
        {top5.map((e, idx) => (
          <button
            key={e.id}
            type="button"
            data-testid={`chart-top-${e.id}`}
            onClick={() => onOpenLedger?.({ focus: e.id })}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-beige font-mono text-meta font-bold text-ink-soft">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-bold text-ink">
                {e.store}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-meta text-ink-muted">
              {e.date ? shortDayLabel(expenseDateKey(e.date)) : '未有日期'}
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold text-teal-strong">
              {hk(e.hkdAmount)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const settleSection = (
    <section key="settle" data-section="settle" className="paper-panel space-y-2.5 p-4">
      <h2 className="whitespace-nowrap font-display text-lg text-ink">夾錢結算</h2>

      <div className="space-y-2">
        {settlement.rows.map((row) => {
          const isPositive = row.net > 0.5;
          const isNegative = row.net < -0.5;
          return (
            <button
              key={row.person}
              type="button"
              data-testid={`chart-person-${row.person}`}
              onClick={() => onOpenLedger?.({ payer: row.person })}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-meta font-semibold text-ink">
                {row.person} 俾咗 {hk(row.paid)} · 應付 {hk(row.owed)}
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-mono text-sm font-bold ${
                  isPositive ? 'text-teal-strong' : isNegative ? 'text-coral-ink' : 'text-ink-muted'
                }`}
              >
                {formatNet(row.net)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5 pt-1">
        {settlement.transfers.length > 0 ? (
          settlement.transfers.map((t) => (
            <div
              key={`${t.from}-${t.to}`}
              className="flex min-h-11 items-center justify-between rounded-xl border border-teal/35 bg-teal-soft/65 px-3 py-2 text-sm font-bold text-teal-strong"
            >
              <span className="whitespace-nowrap">
                {t.from} 要還 {t.to} {hk(t.amount)}
              </span>
            </div>
          ))
        ) : (
          <div className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-cream px-3 py-2 text-sm font-bold text-teal-strong">
            <span className="whitespace-nowrap">已經夾平 ✓</span>
          </div>
        )}
      </div>

      {participants.length > 0 && (
        <p className="truncate whitespace-nowrap text-meta text-ink-muted">
          共同消費由 {participants.join('、')} 平分
        </p>
      )}
    </section>
  );

  const sections =
    mode === 'review'
      ? [categorySection, top5Section, summarySection, paymentSection, dailySection, settleSection]
      : [todaySection || summarySection, paymentSection, categorySection, dailySection, settleSection];

  return (
    <div data-testid="page-charts" className="space-y-4 px-4 pb-6 pt-4">
      <div className="relative flex items-baseline gap-2">
        <Sparkle className="absolute -left-1 top-1 h-4 w-4" />
        <h1 className="whitespace-nowrap pl-4 font-display text-2xl text-ink">統計圖表</h1>
        <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Charts</span>
      </div>
      {sections}
    </div>
  );
}
