import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { expenseDateKey } from '../../utils/date';
import { REF_CATEGORIES } from './mockRefTrip';
import {
  CATEGORY_DOT,
  CategorySticker,
  DoodleSticker,
  Icon,
  cardDots,
} from './parts';
import { fmtHKD, groupLedger } from './refLogic';
import {
  assigneeSplit,
  categorySplit,
  chartsMode,
  dailyStacks,
  paymentSplit,
  remainingPerDay,
  settleUp,
  todayVsAverage,
  topExpenses,
} from './refCharts';
import RepaymentForm from './RepaymentForm';
import {
  buildSettlementRow,
  hasUnknownParticipant,
  resolveTripAccountingCurrency,
  resolveTripForeignCurrency,
  resolveTripRefRate,
} from './refRepayment';
import { resolveToday } from './refRules';
import { settlementBreakdown } from './refShares';

const hk = (n) => `HK$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function shortDayLabel(iso, t) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return t('notebook.charts.undated');
  const [y, m, d] = iso.split('-').map(Number);
  const wKey = WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} ${t(`notebook.home.weekdays.${wKey}`)}`;
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

function formatNetHKD(net) {
  const abs = Math.round(Math.abs(Number(net) || 0));
  if (abs === 0) return hk(0);
  return net > 0 ? `+${hk(abs)}` : `−${hk(abs)}`;
}

/**
 * Handmade travel-diary ChartsView with mode-aware sections (before / during / review),
 * budget allowance, cash vs card split, SVG category donut, horizontal stacked daily bars,
 * top-5 expenses (in review), and split-bill settlement.
 */
export default function ChartsView({ trip, today, onOpenDay, onOpenLedger, settlementActions }) {
  const { t } = useTranslation();
  const [settlePerson, setSettlePerson] = useState(null);
  const [editingSettlement, setEditingSettlement] = useState(null);
  const expenses = useMemo(() => trip?.expenses || [], [trip?.expenses]);
  const settlements = useMemo(() => trip?.settlements || [], [trip?.settlements]);
  const people = useMemo(() => trip?.settings?.people || ['共同'], [trip?.settings?.people]);
  const participants = useMemo(() => people.filter((p) => p && p !== '共同'), [people]);
  const budget = trip?.settings?.budget ?? null;
  const accountingCurrency = useMemo(() => resolveTripAccountingCurrency(trip), [trip]);
  const tripCurrency = useMemo(() => resolveTripForeignCurrency(trip), [trip]);
  const activeRate = useMemo(() => resolveTripRefRate(trip), [trip]);
  const effectiveToday = useMemo(() => today || resolveToday(''), [today]);

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
  const exchangeRates = trip?.exchangeRates || null;
  const assignee = useMemo(
    () => assigneeSplit(expenses, people, exchangeRates),
    [expenses, people, exchangeRates],
  );
  const settlement = useMemo(
    () => settleUp(expenses, people, exchangeRates, settlements),
    [expenses, people, exchangeRates, settlements],
  );
  const breakdown = useMemo(
    () => (settlePerson ? settlementBreakdown(expenses, people, exchangeRates, settlePerson) : null),
    [expenses, people, exchangeRates, settlePerson],
  );

  useEffect(() => {
    setEditingSettlement(null);
  }, [settlePerson]);

  useEffect(() => {
    if (!settlePerson || typeof document === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSettlePerson(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [settlePerson]);

  const handleMarkRepaid = (tr) => {
    const row = buildSettlementRow(
      {
        from: tr.from,
        to: tr.to,
        amount: tr.amount,
        currency: accountingCurrency,
        date: effectiveToday,
        note: '',
      },
      {
        accountingCurrency,
        tripCurrency,
        rate: activeRate,
      },
    );
    settlementActions?.add?.(row);
  };

  const total = useMemo(() => expenses.reduce((s, e) => s + Number(e?.hkdAmount || 0), 0), [expenses]);
  const byDayDated = useMemo(() => groupLedger(expenses).filter((g) => g.iso), [expenses]);
  const dayCount = byDayDated.length || 1;
  const summaryAvg = Math.round(total / dayCount);
  const displayPerson = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const displayCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });

  const todaySection = rem ? (
    <section
      key="today"
      data-section="today"
      className="paper-panel relative min-w-0 space-y-3 p-4 lg:col-span-2"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div className="min-w-0 rounded-xl border border-line bg-cream p-3">
          <p className="truncate whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.charts.spentToday')}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap font-display text-xl font-bold tabular-nums text-teal-strong">
            {hk(tva.today)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-line bg-cream p-3">
          <p className="truncate whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.charts.tripDailyAvg')}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap font-display text-xl font-bold tabular-nums text-ink">
            {hk(tva.avg)}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-1.5 rounded-xl border border-line bg-cream px-3 py-2.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p
            className={`min-w-0 truncate whitespace-nowrap text-sm font-bold ${
              rem.over ? 'text-coral-ink' : 'text-teal-strong'
            }`}
          >
            {rem.over
              ? t('notebook.charts.overBudget', { amount: hk(Math.abs(rem.left)) })
              : mode === 'before'
                ? t('notebook.charts.allowanceBefore', { amount: hk(rem.perDay) })
                : rem.lastDay
                  ? t('notebook.charts.allowanceLastDay', { amount: hk(rem.perDay) })
                  : t('notebook.charts.allowanceRemaining', { amount: hk(rem.perDay) })}
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-pill bg-beige">
          <div
            className={`h-full rounded-pill transition-all ${rem.over ? 'bg-coral-ink' : 'bg-teal-strong'}`}
            style={{ width: `${Math.min(100, Math.max(4, rem.pct))}%` }}
          />
        </div>
        <p className="truncate whitespace-nowrap font-mono text-meta font-semibold text-ink-soft">
          {t('notebook.charts.budgetProgress', {
            spent: hk(rem.spent),
            budget: hk(rem.budget),
            pct: rem.pct,
          })}
        </p>
      </div>
    </section>
  ) : null;

  const summarySection = (
    <section key="summary" data-section="summary" className="min-w-0 space-y-2.5 lg:col-span-2">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="paper-panel min-w-0 p-3 text-center">
          <p className="truncate whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.charts.totalSpend')}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-sm font-bold tabular-nums text-teal-strong">
            {fmtHKD(total)}
          </p>
        </div>
        <div className="paper-panel min-w-0 p-3 text-center">
          <p className="truncate whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.charts.daysLabel')}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-sm font-bold tabular-nums text-ink">
            {t('notebook.charts.daysCount', { count: byDayDated.length })}
          </p>
        </div>
        <div className="paper-panel min-w-0 p-3 text-center">
          <p className="truncate whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.charts.dailyAvg')}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-sm font-bold tabular-nums text-ink">
            {fmtHKD(summaryAvg)}
          </p>
        </div>
      </div>
      {mode === 'review' && rem && (
        <div className="paper-panel flex min-w-0 items-center justify-between px-4 py-2.5">
          <span
            className={`min-w-0 truncate whitespace-nowrap text-meta font-bold ${
              rem.over ? 'text-coral-ink' : 'text-teal-strong'
            }`}
          >
            {rem.over
              ? t('notebook.charts.reviewBudgetOver', {
                  budget: hk(rem.budget),
                  over: hk(Math.abs(rem.left)),
                  pct: rem.pct,
                })
              : t('notebook.charts.reviewBudgetUsed', {
                  budget: hk(rem.budget),
                  pct: rem.pct,
                })}
          </span>
        </div>
      )}
    </section>
  );

  const cashPct = pay.total > 0 ? Math.round((pay.cash.total / pay.total) * 100) : 0;
  const cardPct = pay.total > 0 ? Math.round((pay.card.total / pay.total) * 100) : 0;

  const paymentSection = (
    <section key="payment" data-section="payment" className="paper-panel relative min-w-0 space-y-2.5 p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.cashVsCard')}
        </h2>
        <span className="shrink-0 whitespace-nowrap text-meta font-medium text-ink-muted">
          {t('notebook.charts.tapToFilterLedger')}
        </span>
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
          className="flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl border border-line bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-meta font-bold text-ink">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-mustard" />
            <span>{t('notebook.charts.cash')}</span>
          </span>
          <span className="min-w-0 whitespace-nowrap text-meta font-bold tabular-nums text-ink">
            {hk(pay.cash.total)} · {cashPct}%
          </span>
        </button>

        <button
          type="button"
          data-testid="chart-pay-card"
          onClick={() => onOpenLedger?.({ payment: 'card' })}
          className="flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-xl border border-line bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-meta font-bold text-ink">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-teal-strong" />
            <span>{t('notebook.charts.card')}</span>
          </span>
          <span className="min-w-0 whitespace-nowrap text-meta font-bold tabular-nums text-ink">
            {hk(pay.card.total)} · {cardPct}%
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
    <section key="category" data-section="category" className="paper-panel relative min-w-0 space-y-3 p-4">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <h2 className="whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.categoryTitle')}
        </h2>
      </div>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
        <div className="relative flex shrink-0 items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className="h-36 w-36 shrink-0 lg:h-40 lg:w-40"
            role="img"
            aria-label={t('notebook.charts.categoryDonutAria')}
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
              {t('notebook.charts.totalSpend')}
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
                className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-meta font-bold text-ink">
                  <CategorySticker
                    category={row.cat}
                    size="sm"
                    dotClassName={`h-2.5 w-2.5 ${dotTone}`}
                  />
                  <span className="min-w-0 truncate">
                    {displayCategory(row.cat)} · {t('notebook.charts.itemsCount', { count: row.count })}
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
    <section key="daily" data-section="daily" className="paper-panel relative min-w-0 space-y-2.5 p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.dailyTitle')}
        </h2>
        {daily.rows.length > 0 && (
          <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink-muted">
            {t('notebook.charts.dailyAvgAmount', { amount: hk(daily.avg) })}
          </span>
        )}
      </div>

      {daily.rows.length === 0 ? (
        <div
          data-testid="charts-daily-empty"
          className="space-y-1.5 rounded-2xl border border-dashed border-line px-3 py-4 text-center"
          style={cardDots}
        >
          <DoodleSticker name="plane" secondary="sparkle" blob="teal" size="xl" />
          <div>
            <p className="mt-1 font-hand text-sm text-ink">
              {t('notebook.charts.dailyNotStarted')}
            </p>
            <p className="mt-0.5 text-meta text-ink-muted">
              {t('notebook.empty.chartsPreTripHint')}
            </p>
          </div>
        </div>
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
                className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  row.isToday
                    ? 'border-teal-strong bg-teal-soft/60 ring-1 ring-teal-strong'
                    : 'border-line/60 bg-cream hover:bg-beige/50'
                }`}
              >
                <span className="flex min-w-[5.5rem] shrink-0 items-center gap-1 whitespace-nowrap text-meta font-bold text-ink">
                  <span>{shortDayLabel(row.iso, t)}</span>
                  {row.isToday && (
                    <span className="rounded-pill bg-teal-strong px-1.5 py-0.5 text-meta font-bold leading-none text-white">
                      {t('notebook.charts.todayBadge')}
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
    <section key="top5" data-section="top5" className="paper-panel relative min-w-0 space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.top5Title')}
        </h2>
      </div>
      <div className="space-y-2">
        {top5.map((e, idx) => (
          <button
            key={e.id}
            type="button"
            data-testid={`chart-top-${e.id}`}
            onClick={() => onOpenLedger?.({ focus: e.id })}
            className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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
              {e.date ? shortDayLabel(expenseDateKey(e.date), t) : t('notebook.charts.undated')}
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold text-teal-strong">
              {hk(e.hkdAmount)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const assigneeSection = (
    <section key="assignee" data-section="assignee" className="paper-panel relative min-w-0 space-y-2.5 p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.assigneeTitle')}
        </h2>
        <span className="shrink-0 whitespace-nowrap text-meta text-ink-muted">
          {t('notebook.charts.tapToViewLedger')}
        </span>
      </div>

      <div className="space-y-2">
        {assignee.rows.map((row) => {
          const pIdx = participants.indexOf(row.person);
          const fillTone =
            row.person === '共同'
              ? 'bg-teal-strong'
              : pIdx === 0
                ? 'bg-coral'
                : pIdx === 1
                  ? 'bg-mustard'
                  : 'bg-sage';
          const barPct = row.total > 0 ? Math.min(100, Math.max(4, row.pct)) : 0;
          return (
            <button
              key={row.person}
              type="button"
              data-testid={`chart-assignee-${row.person}`}
              onClick={() => onOpenLedger?.({ person: row.person })}
              className="min-h-11 w-full min-w-0 space-y-1.5 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <div className="flex min-w-0 items-center justify-between gap-2 whitespace-nowrap">
                <span className="min-w-0 truncate text-meta font-bold text-ink">
                  {displayPerson(row.person)}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold text-ink">
                  {hk(row.total)} · {t('notebook.charts.itemsCount', { count: row.count })}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-pill bg-beige">
                <div
                  className={`h-full rounded-pill transition-all ${fillTone}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {assignee.shares.length > 0 && (
        <p data-testid="chart-assignee-shares" className="truncate whitespace-nowrap text-meta text-ink-muted">
          {t('notebook.charts.sharesLine', {
            shares: assignee.shares.map((s) => `${displayPerson(s.person)} ${hk(s.share)}`).join(' · '),
          })}
        </p>
      )}
    </section>
  );

  const settleSection = (
    <section key="settle" data-section="settle" className="paper-panel relative min-w-0 space-y-2.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="whitespace-nowrap font-hand text-lg text-ink">
          {t('notebook.charts.settleTitle')}
        </h2>
      </div>

      <div className="space-y-2">
        {settlement.rows.map((row) => {
          const isPositive = row.net > 0.5;
          const isNegative = row.net < -0.5;
          const isSettled = !isPositive && !isNegative;
          return (
            <button
              key={row.person}
              type="button"
              data-testid={`chart-person-${row.person}`}
              aria-haspopup="dialog"
              aria-expanded={settlePerson === row.person}
              onClick={() => setSettlePerson(row.person)}
              className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-meta font-semibold text-ink">
                {t('notebook.charts.personSummary', {
                  name: displayPerson(row.person),
                  paid: hk(row.paid),
                  owed: hk(row.owed),
                })}
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-mono text-sm font-bold ${
                  isPositive ? 'text-teal-strong' : isNegative ? 'text-coral-ink' : 'text-ink-muted'
                }`}
              >
                {isSettled ? t('notebook.settle.settled') : formatNet(row.net)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5 pt-1">
        {settlement.transfers.length > 0 ? (
          settlement.transfers.map((tr) => (
            <div
              key={`${tr.from}-${tr.to}`}
              className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-teal/35 bg-teal-soft/65 px-3 py-2 text-sm font-bold text-teal-strong"
            >
              <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                {t('notebook.charts.transferLine', {
                  from: displayPerson(tr.from),
                  to: displayPerson(tr.to),
                  amount: hk(tr.amount),
                })}
              </span>
              {participants.length >= 2 && (
                <button
                  type="button"
                  data-testid="settle-mark-repaid"
                  onClick={() => handleMarkRepaid(tr)}
                  className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {t('notebook.settle.markRepaid')}
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="flex min-h-11 items-center justify-center rounded-xl border border-line bg-cream px-3 py-2 text-sm font-bold text-teal-strong">
            <span className="whitespace-nowrap">{t('notebook.charts.allSettled')}</span>
          </div>
        )}
      </div>

      {participants.length > 0 && (
        <p className="truncate whitespace-nowrap text-meta text-ink-muted">
          {t('notebook.charts.sharedSplitBy', {
            names: participants.map(displayPerson).join(t('notebook.charts.nameSeparator')),
          })}
        </p>
      )}
    </section>
  );

  const sections =
    mode === 'review'
      ? [categorySection, top5Section, summarySection, paymentSection, dailySection, assigneeSection, settleSection]
      : [todaySection || summarySection, paymentSection, categorySection, dailySection, assigneeSection, settleSection];

  const personSettleRow = useMemo(() => {
    if (!breakdown) return null;
    return (
      settlement.rows.find((r) => r.person === breakdown.person) || {
        person: breakdown.person,
        paid: breakdown.paidTotal,
        owed: breakdown.owedTotal,
        repaid: 0,
        received: 0,
        net: breakdown.net,
        remaining: breakdown.net,
      }
    );
  }, [breakdown, settlement.rows]);

  const sheetSettlements = useMemo(() => {
    if (!breakdown) return [];
    return settlements.filter(
      (s) =>
        s &&
        (s.from === breakdown.person ||
          s.to === breakdown.person ||
          hasUnknownParticipant(s, participants)),
    );
  }, [breakdown, settlements, participants]);

  const suggestedTransfer = useMemo(() => {
    if (!breakdown) return null;
    return (
      settlement.transfers.find(
        (tr) => tr.from === breakdown.person || tr.to === breakdown.person,
      ) ||
      settlement.transfers[0] ||
      null
    );
  }, [breakdown, settlement.transfers]);

  const settleSheetNode = breakdown ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-ink/40 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-sheet-title"
      data-testid="settle-sheet"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettlePerson(null);
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-card border border-line bg-cream-soft p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-card">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2.5">
          <h2 id="settle-sheet-title" className="min-w-0 flex-1 truncate font-hand text-lg text-ink">
            {t('notebook.settle.sheetTitle', { name: displayPerson(breakdown.person) })}
          </h2>
          <button
            type="button"
            aria-label={t('notebook.settle.close')}
            onClick={() => setSettlePerson(null)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {Icon.x('h-4 w-4')}
          </button>
        </div>

        {/* Paid section */}
        <div className="space-y-2">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-hand text-meta font-bold text-ink-muted">
              {t('notebook.settle.paidTitle', { name: displayPerson(breakdown.person) })}
            </h3>
            <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-ink">
              {hk(breakdown.paidTotal)}
            </span>
          </div>

          {breakdown.paidLines.length === 0 ? (
            <p className="rounded-xl border border-line/60 bg-cream px-3 py-2 text-meta text-ink-muted">
              {t('notebook.settle.noPaid')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {breakdown.paidLines.map((line) => (
                <div
                  key={line.id}
                  className="min-w-0 space-y-1 rounded-xl border border-line/60 bg-cream px-3 py-2"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                      {line.title || t('common.unnamedStore')}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-meta text-ink-muted">
                      {line.date ? shortDayLabel(expenseDateKey(line.date), t) : t('notebook.settle.undated')}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-teal-strong">
                      {hk(line.hkd)}
                    </span>
                  </div>
                  {line.blankPayer && (
                    <p className="min-w-0 truncate text-meta text-ink-muted">
                      {t('notebook.settle.blankPayerTag', { name: displayPerson(breakdown.person) })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Owed section */}
        <div className="space-y-2">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-hand text-meta font-bold text-ink-muted">
              {t('notebook.settle.owedTitle')}
            </h3>
            <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-ink">
              {hk(breakdown.owedTotal)}
            </span>
          </div>

          {breakdown.owedLines.length === 0 ? (
            <p className="rounded-xl border border-line/60 bg-cream px-3 py-2 text-meta text-ink-muted">
              {t('notebook.settle.noOwed')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {breakdown.owedLines.map((line) => {
                const subParts = [];
                if (line.own > 0) {
                  subParts.push(t('notebook.settle.ownPart', { amount: hk(line.own) }));
                }
                if (line.sharedPart > 0) {
                  subParts.push(
                    t('notebook.settle.sharedPart', {
                      amount: hk(line.sharedPart),
                      n: line.sharedCount,
                    }),
                  );
                }
                return (
                  <div
                    key={line.id}
                    className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-line/60 bg-cream px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="min-w-0 truncate text-sm font-bold text-ink">
                        {line.title || t('common.unnamedStore')}
                      </p>
                      {subParts.length > 0 && (
                        <p className="min-w-0 truncate text-meta text-ink-muted">
                          {subParts.join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-ink">
                      {hk(line.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repayments section */}
        <div data-testid="settle-sheet-repayments" className="min-w-0 space-y-2.5">
          <div className="flex min-w-0 items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate font-hand text-meta font-bold text-ink-muted">
              {t('notebook.settle.repaymentSection')}
            </h3>
            {personSettleRow && (
              <span
                data-testid="settle-sheet-status"
                className={`shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums ${
                  personSettleRow.remaining > 0.5
                    ? 'text-teal-strong'
                    : personSettleRow.remaining < -0.5
                      ? 'text-coral-ink'
                      : 'text-teal-strong'
                }`}
              >
                {Math.abs(personSettleRow.remaining) < 0.5
                  ? t('notebook.settle.settled')
                  : personSettleRow.remaining < 0
                    ? t('notebook.settle.stillOwes', {
                        amount: hk(Math.abs(personSettleRow.remaining)),
                      })
                    : t('notebook.settle.toReceive', {
                        amount: hk(personSettleRow.remaining),
                      })}
              </span>
            )}
          </div>

          {sheetSettlements.length === 0 ? (
            <p className="rounded-xl border border-line/60 bg-cream px-3 py-2 text-meta text-ink-muted">
              {t('notebook.settle.emptyRepayments')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {sheetSettlements.map((s) => {
                const unknown = hasUnknownParticipant(s, participants);
                const isRepaidByPerson = s.from === breakdown.person;
                const isReceivedByPerson = s.to === breakdown.person;
                const dirLabel = isRepaidByPerson
                  ? t('notebook.settle.repaid')
                  : isReceivedByPerson
                    ? t('notebook.settle.received')
                    : t('notebook.settle.ledgerRepaymentTag');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSettlement(s)}
                    className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-dashed border-teal/45 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span aria-hidden="true" className="shrink-0 font-bold text-teal-strong">
                          ⇄
                        </span>
                        <span className="shrink-0 rounded-md bg-teal-soft px-1.5 py-0.5 text-meta font-bold text-teal-strong">
                          {dirLabel}
                        </span>
                        <span className="min-w-0 truncate text-sm font-bold text-ink">
                          {t('notebook.settle.repaidTo', {
                            from: displayPerson(s.from),
                            to: displayPerson(s.to),
                          })}
                        </span>
                        {unknown && (
                          <span
                            data-testid="settle-unknown-member"
                            className="shrink-0 rounded-md border border-coral-ink/40 bg-coral-soft px-1.5 py-0.5 text-meta font-bold text-coral-ink"
                          >
                            {t('notebook.settle.unknownMember')}
                          </span>
                        )}
                      </div>
                      {(s.date || s.note) && (
                        <p className="min-w-0 truncate text-meta text-ink-muted">
                          {[
                            s.date ? shortDayLabel(expenseDateKey(s.date), t) : '',
                            s.note || '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-mono text-sm font-bold tabular-nums text-teal-strong">
                      {hk(s.hkdAmount)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {(participants.length >= 2 || editingSettlement) && (
            <RepaymentForm
              participants={participants}
              initial={
                editingSettlement || {
                  from: suggestedTransfer?.from || breakdown.person || participants[0] || '',
                  to:
                    suggestedTransfer?.to ||
                    participants.find(
                      (p) => p !== (suggestedTransfer?.from || breakdown.person),
                    ) ||
                    participants[0] ||
                    '',
                  amount: suggestedTransfer?.amount ? String(suggestedTransfer.amount) : '',
                  currency: accountingCurrency,
                  date: effectiveToday,
                  note: '',
                }
              }
              accountingCurrency={accountingCurrency}
              tripCurrency={tripCurrency}
              rate={activeRate}
              oweAmount={editingSettlement ? 0 : suggestedTransfer?.amount || 0}
              transfers={editingSettlement ? null : settlement.transfers}
              today={effectiveToday}
              onSave={(row) => {
                if (editingSettlement?.id) {
                  settlementActions?.update?.(editingSettlement.id, row);
                  setEditingSettlement(null);
                } else {
                  settlementActions?.add?.(row);
                }
              }}
              onDelete={
                editingSettlement
                  ? () => {
                      settlementActions?.remove?.(editingSettlement);
                      setEditingSettlement(null);
                    }
                  : undefined
              }
              onCancel={editingSettlement ? () => setEditingSettlement(null) : undefined}
            />
          )}
        </div>

        {/* Net row */}
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-cream px-3 py-2.5">
          <span className="min-w-0 truncate font-hand text-sm font-bold text-ink">
            {t('notebook.settle.netLabel')}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap font-mono text-base font-bold tabular-nums ${
              (personSettleRow?.net ?? breakdown.net) > 0.5
                ? 'text-teal-strong'
                : (personSettleRow?.net ?? breakdown.net) < -0.5
                  ? 'text-coral-ink'
                  : 'text-ink-muted'
            }`}
          >
            {formatNetHKD(personSettleRow?.net ?? breakdown.net)}
          </span>
        </div>

        {/* View in ledger link button */}
        <button
          type="button"
          data-testid="settle-sheet-ledger"
          onClick={() => {
            const targetPayer = breakdown.person;
            setSettlePerson(null);
            onOpenLedger?.({ payer: targetPayer });
          }}
          className="btn-primary min-h-11 min-w-11 w-full whitespace-nowrap !py-2.5 text-sm"
        >
          {t('notebook.settle.viewInLedger')}
        </button>
      </div>
    </div>
  ) : null;

  const chartsTitle = t('notebook.charts.title');
  const chartsTitleScript = t('notebook.charts.titleScript');
  const showChartsTitleScript = Boolean(chartsTitleScript) && chartsTitleScript !== chartsTitle;

  return (
    <div data-testid="page-charts" className="w-full max-w-full min-w-0 overflow-x-hidden space-y-4 px-4 pb-6 pt-4">
      <div className="relative flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          {showChartsTitleScript && (
            <p className="whitespace-nowrap font-serif-display text-[15px] lg:text-base font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {chartsTitleScript}
            </p>
          )}
          <h1 className="whitespace-nowrap font-hand text-2xl text-ink">{chartsTitle}</h1>
        </div>
      </div>
      <div className="min-w-0 space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {sections}
      </div>
      {settleSheetNode &&
        (typeof document !== 'undefined' ? createPortal(settleSheetNode, document.body) : settleSheetNode)}
    </div>
  );
}
