import { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import {
  JournalIcon,
  PlaneIcon,
  SuitcaseIcon,
} from '../../journal/art/core.jsx';
import {
  TodayRing,
  WashBlob,
  WashiLabel,
} from '../../journal/art/decor.jsx';
import { formatAccountingAmount } from '../../utils/currency';
import { expenseDateKey } from '../../utils/date';
import { REF_CATEGORIES } from './mockRefTrip';
import { Icon } from './parts';
import { groupLedger } from './refLogic';
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

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function shortDayLabel(iso, t) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return t('notebook.charts.undated');
  const [y, m, d] = iso.split('-').map(Number);
  const wKey = WEEKDAY_KEYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} ${t(`notebook.home.weekdays.${wKey}`)}`;
}

const CATEGORY_DONUT_FILL = {
  飲食: 'rgb(var(--c-coral) / 0.72)',
  交通: 'rgb(var(--c-route) / 0.72)',
  購物: 'rgb(var(--c-sakura) / 0.78)',
  住宿: 'rgb(var(--c-mustard) / 0.78)',
  娛樂: 'rgb(var(--c-sage) / 0.76)',
  其他: 'rgb(var(--c-ink-muted) / 0.62)',
};

const CATEGORY_BAR_WASH = {
  飲食: 'bg-coral/70',
  交通: 'bg-route/70',
  購物: 'bg-sakura/75',
  住宿: 'bg-mustard/75',
  娛樂: 'bg-sage/75',
  其他: 'bg-ink-muted/65',
};

const CATEGORY_WASH_TONE = {
  飲食: 'wheat',
  交通: 'sky',
  購物: 'berry',
  住宿: 'wheat',
  娛樂: 'leaf',
  其他: 'leaf',
};

const CATEGORY_WASH_SHAPE = {
  飲食: 1,
  交通: 2,
  購物: 3,
  住宿: 1,
  娛樂: 2,
  其他: 3,
};

function formatNet(net) {
  const abs = Math.round(Math.abs(Number(net) || 0));
  if (abs === 0) return '0';
  return net > 0 ? `+${abs.toLocaleString('en-US')}` : `−${abs.toLocaleString('en-US')}`;
}

function formatNetAmount(net, code) {
  const abs = Math.round(Math.abs(Number(net) || 0));
  const formatted = formatAccountingAmount(abs, code);
  if (abs === 0) return formatted;
  return net > 0 ? `+${formatted}` : `−${formatted}`;
}

function polarToCartesian(cx, cy, r, angleRad) {
  return {
    x: Number((cx + r * Math.cos(angleRad)).toFixed(2)),
    y: Number((cy + r * Math.sin(angleRad)).toFixed(2)),
  };
}

function buildAnnularSectorPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const span = endAngle - startAngle;
  if (span <= 0) return '';
  if (span >= Math.PI * 2 - 1e-4) {
    const midAngle = startAngle + Math.PI;
    const o1 = polarToCartesian(cx, cy, rOuter, startAngle);
    const o2 = polarToCartesian(cx, cy, rOuter, midAngle);
    const i1 = polarToCartesian(cx, cy, rInner, startAngle);
    const i2 = polarToCartesian(cx, cy, rInner, midAngle);
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o2.x} ${o2.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${o1.x} ${o1.y}`,
      'Z',
      `M ${i1.x} ${i1.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i2.x} ${i2.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i1.x} ${i1.y}`,
      'Z',
    ].join(' ');
  }
  const largeArc = span > Math.PI ? 1 : 0;
  const oStart = polarToCartesian(cx, cy, rOuter, startAngle);
  const oEnd = polarToCartesian(cx, cy, rOuter, endAngle);
  const iEnd = polarToCartesian(cx, cy, rInner, endAngle);
  const iStart = polarToCartesian(cx, cy, rInner, startAngle);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${iStart.x} ${iStart.y}`,
    'Z',
  ].join(' ');
}

function SummaryRouteProgress({ rem }) {
  const barPct = Math.min(100, Math.max(0, Number(rem?.pct) || 0));
  return (
    <div className="relative ml-[3.5px] mr-3 h-5">
      <svg
        aria-hidden="true"
        focusable="false"
        fill="none"
        className="block h-5 w-full overflow-visible"
      >
        {barPct > 0 && (
          <line
            x1="0%"
            y1="14"
            x2={`${barPct}%`}
            y2="14"
            stroke={rem.over ? 'rgb(var(--c-wash-berry) / 0.45)' : 'rgb(var(--c-wash-sky))'}
            strokeWidth="6"
            strokeLinecap="round"
          />
        )}
        {barPct < 100 && (
          <line
            x1={`${barPct}%`}
            y1="14"
            x2="100%"
            y2="14"
            stroke="rgb(var(--c-route))"
            strokeWidth="2"
            strokeDasharray="0 6"
            strokeLinecap="round"
          />
        )}
        {barPct > 0 && (
          <line
            x1="0%"
            y1="14"
            x2={`${barPct}%`}
            y2="14"
            stroke={rem.over ? 'rgb(var(--c-stamp))' : 'rgb(var(--c-route))'}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        <circle cx="0%" cy="14" r="3.5" fill="rgb(var(--c-route))" />
        <svg x="100%" y="0" className="overflow-visible">
          <line
            x1="0"
            y1="3"
            x2="0"
            y2="17"
            stroke="rgb(var(--c-ink))"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M0 3 L12 7 L0 11 Z"
            fill="rgb(var(--c-stamp) / 0.8)"
            stroke="rgb(var(--c-ink))"
            strokeWidth="1"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="17" r="2" fill="rgb(var(--c-route))" />
        </svg>
        <circle
          cx={`${barPct}%`}
          cy="14"
          r="5"
          fill="rgb(var(--c-route-soft))"
          stroke="rgb(var(--c-route))"
          strokeWidth="1.35"
        />
        <circle cx={`${barPct}%`} cy="14" r="2.2" fill="rgb(var(--c-stamp))" />
      </svg>
    </div>
  );
}

/**
 * Handmade travel-journal ChartsView with grid-paper notes, WashiLabel headers,
 * dotted route budget progress, hand-hatched bars & donut, and honest empty states.
 */
export default function ChartsView({ trip, today, onOpenDay, onOpenLedger, settlementActions }) {
  const { t } = useTranslation();
  const rawHatchId = useId();
  const donutHatchId = `jr-donut-hatch-${rawHatchId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
  const fmt = (n) => formatAccountingAmount(n, accountingCurrency);

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
  const hasExpenses = expenses.length > 0;

  const primarySummaryLabel =
    mode === 'review' ? t('notebook.charts.totalSpend') : t('notebook.charts.spentToday');
  const primarySummaryValue = mode === 'review' ? total : tva.today;
  const secondarySummaryValue = mode === 'review' ? summaryAvg : tva.avg;

  const todaySection =
    hasExpenses || rem ? (
      <section
        key="today"
        data-section="today"
        className="jr-taped-card jr-grid relative min-w-0 space-y-3 p-3.5 lg:col-span-2"
      >
        <div className="mb-1">
          <WashiLabel tone="navy" tilt={-1}>
            {t('notebook.charts.todayTitle')}
          </WashiLabel>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="font-hand text-xs font-bold text-ink-muted">
              {primarySummaryLabel}
            </p>
            <p className="mt-0.5 break-words font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-route lg:text-3xl">
              {fmt(primarySummaryValue)}
            </p>
          </div>
          <div className="min-w-0 border-t border-dashed border-ink-soft/30 pt-2.5 sm:border-l sm:border-t-0 sm:pl-3.5 sm:pt-0">
            <p className="font-hand text-xs font-bold text-ink-muted">
              {t('notebook.charts.tripDailyAvg')}
            </p>
            <p className="mt-0.5 break-words font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink lg:text-3xl">
              {fmt(secondarySummaryValue)}
            </p>
          </div>
        </div>

        {rem && (
          <div className="min-w-0 space-y-1.5 border-t border-dashed border-ink-soft/30 pt-2.5">
            <SummaryRouteProgress rem={rem} />
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-display text-xs tabular-nums">
              <span className={`min-w-0 break-words font-bold ${rem.over ? 'text-stamp' : 'text-route'}`}>
                {rem.over
                  ? t('notebook.charts.overBudget', { amount: fmt(Math.abs(rem.left)) })
                  : mode === 'before'
                    ? t('notebook.charts.allowanceBefore', { amount: fmt(rem.perDay) })
                    : mode === 'review'
                      ? t('notebook.charts.reviewBudgetUsed', {
                          budget: fmt(rem.budget),
                          pct: rem.pct,
                        })
                      : rem.lastDay
                        ? t('notebook.charts.allowanceLastDay', { amount: fmt(rem.perDay) })
                        : t('notebook.charts.allowanceRemaining', { amount: fmt(rem.perDay) })}
              </span>
              <span className="min-w-0 break-words font-semibold text-ink-soft">
                {t('notebook.charts.budgetProgress', {
                  spent: fmt(rem.spent),
                  budget: fmt(rem.budget),
                  pct: rem.pct,
                })}
              </span>
            </div>
          </div>
        )}
      </section>
    ) : null;

  const cashPct = pay.total > 0 ? Math.round((pay.cash.total / pay.total) * 100) : 0;
  const cardPct = pay.total > 0 ? Math.round((pay.card.total / pay.total) * 100) : 0;

  const paymentSection = (
    <section
      key="payment"
      data-section="payment"
      className="jr-taped-card jr-grid relative min-w-0 space-y-2.5 p-3.5 lg:order-2"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <WashiLabel tilt={-1}>{t('notebook.charts.cashVsCard')}</WashiLabel>
        <span className="text-xs font-medium text-ink-muted">
          {t('notebook.charts.tapToFilterLedger')}
        </span>
      </div>

      <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
        {fmt(pay.total)}
      </p>

      <div className="flex h-3.5 overflow-hidden rounded-sm border border-ink/60 bg-paper-shade/75">
        {pay.cash.total > 0 && (
          <div
            className="jr-hatch h-full border-r border-ink/60 bg-mustard/75 transition-all last:border-r-0"
            style={{ width: `${Math.max(6, cashPct)}%` }}
          />
        )}
        {pay.card.total > 0 && (
          <div
            className="jr-hatch h-full bg-route/70 transition-all"
            style={{ width: `${Math.max(6, cardPct)}%` }}
          />
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          data-testid="chart-pay-cash"
          onClick={() => onOpenLedger?.({ payment: 'cash' })}
          className="flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-sm border border-ink-soft/45 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-hand text-xs font-bold text-ink">
            <span
              aria-hidden="true"
              className="jr-hatch h-2.5 w-2.5 shrink-0 rounded-sm border border-ink/60 bg-mustard/75"
            />
            <span>{t('notebook.charts.cash')}</span>
          </span>
          <span className="min-w-0 break-words font-display text-sm font-bold tabular-nums text-ink">
            {fmt(pay.cash.total)} · {cashPct}%
          </span>
        </button>

        <button
          type="button"
          data-testid="chart-pay-card"
          onClick={() => onOpenLedger?.({ payment: 'card' })}
          className="flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 rounded-sm border border-ink-soft/45 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-hand text-xs font-bold text-ink">
            <span
              aria-hidden="true"
              className="jr-hatch h-2.5 w-2.5 shrink-0 rounded-sm border border-ink/60 bg-route/70"
            />
            <span>{t('notebook.charts.card')}</span>
          </span>
          <span className="min-w-0 break-words font-display text-sm font-bold tabular-nums text-ink">
            {fmt(pay.card.total)} · {cardPct}%
          </span>
        </button>
      </div>
    </section>
  );

  // SVG Donut geometry (annular sectors with wash fills + hatch pattern + thin ink outline)
  const outerRadius = 68;
  const innerRadius = 46;
  let currentAngle = -Math.PI / 2;
  const donutSegments = cats.map((row) => {
    const fraction = total > 0 ? row.total / total : 0;
    const span = fraction * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + span;
    currentAngle = endAngle;
    return {
      ...row,
      d: buildAnnularSectorPath(80, 80, outerRadius, innerRadius, startAngle, endAngle),
      fill: CATEGORY_DONUT_FILL[row.cat] || CATEGORY_DONUT_FILL.其他,
    };
  });

  const categorySection = (
    <section
      key="category"
      data-section="category"
      className="jr-taped-card jr-grid relative min-w-0 space-y-3 p-3.5"
    >
      <div>
        <WashiLabel tilt={-1}>{t('notebook.charts.categoryTitle')}</WashiLabel>
      </div>

      <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
        {fmt(total)}
      </p>

      <div className="flex flex-col items-center gap-3">
        <div className="relative flex shrink-0 items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className="h-40 w-40 shrink-0"
            role="img"
            aria-label={t('notebook.charts.categoryDonutAria')}
          >
            <defs>
              <pattern
                id={donutHatchId}
                width="6"
                height="6"
                patternTransform="rotate(-45)"
                patternUnits="userSpaceOnUse"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="rgb(var(--c-ink) / 0.14)"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            {donutSegments.map((seg) => (
              <g
                key={seg.cat}
                className="cursor-pointer transition-opacity hover:opacity-85"
                onClick={() => onOpenLedger?.({ category: seg.cat })}
              >
                <path
                  d={seg.d}
                  fill={seg.fill}
                   fillRule="evenodd"
                  stroke="rgb(var(--c-ink) / 0.65)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d={seg.d}
                  fill={`url(#${donutHatchId})`}
                  fillRule="evenodd"
                  pointerEvents="none"
                />
              </g>
            ))}

            <text
              x="80"
              y="74"
              textAnchor="middle"
              fontSize="12"
              className="fill-current font-hand text-xs font-bold text-ink-muted"
            >
              {t('notebook.charts.totalSpend')}
            </text>
            <text
              x="80"
              y="93"
              textAnchor="middle"
              fontSize="13"
              className="fill-current font-display text-xs font-bold tabular-nums text-ink"
            >
              {fmt(total)}
            </text>
          </svg>
        </div>

        <div className="w-full min-w-0 space-y-1.5">
          {cats.map((row) => {
            const washTone = CATEGORY_WASH_TONE[row.cat] || 'leaf';
            const washShape = CATEGORY_WASH_SHAPE[row.cat] || 1;
            return (
              <button
                key={row.cat}
                type="button"
                data-testid={`chart-cat-${row.cat}`}
                onClick={() => onOpenLedger?.({ category: row.cat })}
                className="flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                <WashBlob tone={washTone} shape={washShape} className="h-8 w-8 shrink-0">
                  <JournalIcon name={row.cat} className="h-4 w-4 text-ink" />
                </WashBlob>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <span className="min-w-0 break-words font-hand text-sm font-bold text-ink">
                    {displayCategory(row.cat)} · {t('notebook.charts.itemsCount', { count: row.count })}
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-ink">
                    {fmt(row.total)} · {row.pct}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  const avgPct = daily.max > 0 ? Math.min(100, Math.max(0, Math.round((daily.avg / daily.max) * 100))) : 0;

  const dailySection = (
    <section
      key="daily"
      data-section="daily"
      className="jr-taped-card jr-grid relative min-w-0 space-y-2.5 p-3.5 lg:order-1"
    >
      <div>
        <WashiLabel tilt={-1}>{t('notebook.charts.dailyTitle')}</WashiLabel>
      </div>

      {daily.rows.length > 0 && (
        <div>
          <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
            {fmt(daily.avg)}
          </p>
          <p className="mt-0.5 font-hand text-xs font-bold text-ink-muted">
            {t('notebook.charts.dailyAvg')}
          </p>
        </div>
      )}

      {daily.rows.length === 0 ? (
        <div
          data-testid="charts-daily-empty"
          className="space-y-2 rounded-sm border border-dashed border-ink-soft/45 bg-paper/85 px-3 py-4 text-center"
        >
          <WashBlob tone="sky" shape={2} className="h-11 w-11">
            <PlaneIcon className="h-5 w-5 text-route" />
          </WashBlob>
          <div>
            <p className="mt-1 font-hand text-sm font-bold text-ink">
              {t('notebook.charts.dailyNotStarted')}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
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
                className={`flex min-h-11 w-full min-w-0 flex-col justify-center gap-1.5 rounded-sm border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                  row.isToday
                    ? 'border-tape-navy bg-route-soft/45 ring-1 ring-tape-navy'
                    : 'border-ink-soft/40 bg-paper hover:bg-paper-shade/60'
                }`}
              >
                <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-bold text-ink">
                    {row.isToday && <TodayRing className="h-4 w-4 shrink-0" />}
                    <span>{shortDayLabel(row.iso, t)}</span>
                    {row.isToday && (
                      <span className="rounded-sm border border-ink-soft bg-tape-navy px-1.5 py-0.5 font-hand text-xs font-bold leading-none text-paper">
                        {t('notebook.charts.todayBadge')}
                      </span>
                    )}
                  </span>
                  <span className="font-display text-sm font-bold tabular-nums text-route">
                    {fmt(row.total)}
                  </span>
                </div>

                <div className="relative h-3.5 w-full rounded-sm border border-ink/60 bg-paper-shade/75">
                  {barPct > 0 && (
                    <div
                      className="flex h-full overflow-hidden rounded-sm"
                      style={{ width: `${barPct}%` }}
                    >
                      {row.segments.map((seg) => {
                        const segTone = CATEGORY_BAR_WASH[seg.cat] || CATEGORY_BAR_WASH.其他;
                        const segPct = row.total > 0 ? (seg.total / row.total) * 100 : 0;
                        return (
                          <span
                            key={seg.cat}
                            className={`jr-hatch h-full border-r border-ink/50 last:border-r-0 ${segTone}`}
                            style={{ width: `${segPct}%` }}
                          />
                        );
                      })}
                    </div>
                  )}
                  {daily.avg > 0 && daily.max > 0 && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-1 -top-1 w-0 border-l border-dashed border-ink-soft"
                      style={{ left: `${avgPct}%` }}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  const top5Section = (
    <section
      key="top5"
      data-section="top5"
      className="jr-taped-card jr-grid relative min-w-0 space-y-2.5 p-3.5"
    >
      <div>
        <WashiLabel tilt={-1}>{t('notebook.charts.top5Title')}</WashiLabel>
      </div>

      {top5[0] && (
        <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
          {fmt(top5[0].hkdAmount)}
        </p>
      )}

      <div className="space-y-2">
        {top5.map((e) => {
          const washTone = CATEGORY_WASH_TONE[e.category] || 'leaf';
          const washShape = CATEGORY_WASH_SHAPE[e.category] || 1;
          return (
            <button
              key={e.id}
              type="button"
              data-testid={`chart-top-${e.id}`}
              onClick={() => onOpenLedger?.({ focus: e.id })}
              className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2.5 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
            >
              <WashBlob tone={washTone} shape={washShape} className="h-9 w-9 shrink-0">
                <JournalIcon name={e.category} className="h-4 w-4 text-ink" />
              </WashBlob>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-sm font-bold leading-snug text-ink">
                  {e.store}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {e.date ? shortDayLabel(expenseDateKey(e.date), t) : t('notebook.charts.undated')}
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap font-display text-base font-bold tabular-nums text-route">
                {fmt(e.hkdAmount)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const assigneeSection = (
    <section
      key="assignee"
      data-section="assignee"
      className="jr-taped-card jr-grid relative min-w-0 space-y-2.5 p-3.5 lg:order-4"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <WashiLabel tilt={-1}>{t('notebook.charts.assigneeTitle')}</WashiLabel>
        <span className="text-xs text-ink-muted">
          {t('notebook.charts.tapToViewLedger')}
        </span>
      </div>

      <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
        {fmt(assignee.total)}
      </p>

      <div className="space-y-2">
        {assignee.rows.map((row) => {
          const pIdx = participants.indexOf(row.person);
          const fillTone =
            row.person === '共同'
              ? 'bg-route/70'
              : pIdx === 0
                ? 'bg-coral/70'
                : pIdx === 1
                  ? 'bg-mustard/75'
                  : 'bg-sage/75';
          const barPct = row.total > 0 ? Math.min(100, Math.max(4, row.pct)) : 0;
          return (
            <button
              key={row.person}
              type="button"
              data-testid={`chart-assignee-${row.person}`}
              onClick={() => onOpenLedger?.({ person: row.person })}
              className="min-h-11 w-full min-w-0 space-y-1.5 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
            >
              <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <span className="min-w-0 break-words font-hand text-xs font-bold text-ink">
                  {displayPerson(row.person)}
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-ink">
                  {fmt(row.total)} · {t('notebook.charts.itemsCount', { count: row.count })}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-sm border border-ink/60 bg-paper-shade/75">
                {barPct > 0 && (
                  <div
                    className={`jr-hatch h-full transition-all ${fillTone}`}
                    style={{ width: `${barPct}%` }}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {assignee.shares.length > 0 && (
        <p data-testid="chart-assignee-shares" className="min-w-0 break-words font-display text-xs tabular-nums text-ink-muted">
          {t('notebook.charts.sharesLine', {
            shares: assignee.shares.map((s) => `${displayPerson(s.person)} ${fmt(s.share)}`).join(' · '),
          })}
        </p>
      )}
    </section>
  );

  const settleHeadlineAmount = settlement.transfers.reduce((sum, tr) => sum + Number(tr.amount || 0), 0);

  const settleSection = (
    <section
      key="settle"
      data-section="settle"
      className="jr-taped-card jr-grid relative min-w-0 space-y-2.5 p-3.5 lg:order-3"
    >
      <div>
        <WashiLabel tilt={-1}>{t('notebook.charts.settleTitle')}</WashiLabel>
      </div>

      <p className="font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
        {fmt(settleHeadlineAmount)}
      </p>

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
              className="flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
            >
              <span className="min-w-0 flex-1 break-words font-display text-xs font-semibold tabular-nums text-ink">
                {t('notebook.charts.personSummary', {
                  name: displayPerson(row.person),
                  paid: fmt(row.paid),
                  owed: fmt(row.owed),
                })}
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums ${
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
              className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-route/40 bg-route-soft/60 px-3 py-2 font-display text-sm font-bold tabular-nums text-route"
            >
              <span className="min-w-0 flex-1 break-words">
                {t('notebook.charts.transferLine', {
                  from: displayPerson(tr.from),
                  to: displayPerson(tr.to),
                  amount: fmt(tr.amount),
                })}
              </span>
              {participants.length >= 2 && (
                <button
                  type="button"
                  data-testid="settle-mark-repaid"
                  onClick={() => handleMarkRepaid(tr)}
                  className="jr-btn-navy inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 font-hand text-xs font-bold text-paper transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  {t('notebook.settle.markRepaid')}
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="flex min-h-11 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 font-hand text-sm font-bold text-route">
            <span>{t('notebook.charts.allSettled')}</span>
          </div>
        )}
      </div>

      {participants.length > 0 && (
        <p className="min-w-0 break-words text-xs text-ink-muted">
          {t('notebook.charts.sharedSplitBy', {
            names: participants.map(displayPerson).join(t('notebook.charts.nameSeparator')),
          })}
        </p>
      )}
    </section>
  );

  const emptySection = (
    <section
      key="empty"
      data-testid="charts-empty"
      className="jr-taped-card jr-grid relative flex min-w-0 flex-col items-center justify-center space-y-2.5 px-4 py-8 text-center lg:col-span-2"
    >
      <WashBlob tone="sky" shape={1} className="h-12 w-12">
        <SuitcaseIcon className="h-6 w-6 text-route" />
      </WashBlob>
      <div className="space-y-1">
        <p className="font-hand text-base font-bold text-ink">
          {t('notebook.empty.chartsEmptyTitle')}
        </p>
        <p className="text-xs text-ink-muted">
          {t('notebook.empty.chartsEmptyHint')}
        </p>
      </div>
    </section>
  );

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
      <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-card border border-ink-soft/60 bg-paper p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-sm">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-dashed border-ink-soft/35 pb-2.5">
          <h2 id="settle-sheet-title" className="min-w-0 flex-1 break-words font-hand text-lg font-bold text-ink">
            {t('notebook.settle.sheetTitle', { name: displayPerson(breakdown.person) })}
          </h2>
          <button
            type="button"
            aria-label={t('notebook.settle.close')}
            onClick={() => setSettlePerson(null)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {Icon.x('h-4 w-4')}
          </button>
        </div>

        {/* Paid section */}
        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words font-hand text-xs font-bold text-ink-muted">
              {t('notebook.settle.paidTitle', { name: displayPerson(breakdown.person) })}
            </h3>
            <span className="shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums text-ink">
              {fmt(breakdown.paidTotal)}
            </span>
          </div>

          {breakdown.paidLines.length === 0 ? (
            <p className="rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-xs text-ink-muted">
              {t('notebook.settle.noPaid')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {breakdown.paidLines.map((line) => (
                <div
                  key={line.id}
                  className="min-w-0 space-y-1 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2"
                >
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 break-words text-sm font-bold text-ink">
                      {line.title || t('common.unnamedStore')}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">
                      {line.date ? shortDayLabel(expenseDateKey(line.date), t) : t('notebook.settle.undated')}
                    </span>
                    <span className="shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums text-route">
                      {fmt(line.hkd)}
                    </span>
                  </div>
                  {line.blankPayer && (
                    <p className="min-w-0 break-words text-xs text-ink-muted">
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
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words font-hand text-xs font-bold text-ink-muted">
              {t('notebook.settle.owedTitle')}
            </h3>
            <span className="shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums text-ink">
              {fmt(breakdown.owedTotal)}
            </span>
          </div>

          {breakdown.owedLines.length === 0 ? (
            <p className="rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-xs text-ink-muted">
              {t('notebook.settle.noOwed')}
            </p>
          ) : (
            <div className="space-y-1.5">
              {breakdown.owedLines.map((line) => {
                const subParts = [];
                if (line.own > 0) {
                  subParts.push(t('notebook.settle.ownPart', { amount: fmt(line.own) }));
                }
                if (line.sharedPart > 0) {
                  subParts.push(
                    t('notebook.settle.sharedPart', {
                      amount: fmt(line.sharedPart),
                      n: line.sharedCount,
                    }),
                  );
                }
                return (
                  <div
                    key={line.id}
                    className="flex min-w-0 flex-wrap items-start justify-between gap-2 rounded-sm border border-ink-soft/40 bg-paper px-3 py-2"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="min-w-0 break-words text-sm font-bold text-ink">
                        {line.title || t('common.unnamedStore')}
                      </p>
                      {subParts.length > 0 && (
                        <p className="min-w-0 break-words font-display text-xs tabular-nums text-ink-muted">
                          {subParts.join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums text-ink">
                      {fmt(line.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Repayments section */}
        <div data-testid="settle-sheet-repayments" className="min-w-0 space-y-2.5">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <h3 className="min-w-0 flex-1 break-words font-hand text-xs font-bold text-ink-muted">
              {t('notebook.settle.repaymentSection')}
            </h3>
            {personSettleRow && (
              <span
                data-testid="settle-sheet-status"
                className={`shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums ${
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
                        amount: fmt(Math.abs(personSettleRow.remaining)),
                      })
                    : t('notebook.settle.toReceive', {
                        amount: fmt(personSettleRow.remaining),
                      })}
              </span>
            )}
          </div>

          {sheetSettlements.length === 0 ? (
            <p className="rounded-sm border border-ink-soft/40 bg-paper px-3 py-2 text-xs text-ink-muted">
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
                    className="flex min-h-11 w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-dashed border-route/50 bg-paper px-3 py-2 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span aria-hidden="true" className="shrink-0 font-bold text-route">
                          ⇄
                        </span>
                        <span className="shrink-0 rounded-sm bg-route-soft px-1.5 py-0.5 font-hand text-xs font-bold text-route">
                          {dirLabel}
                        </span>
                        <span className="min-w-0 break-words text-sm font-bold text-ink">
                          {t('notebook.settle.repaidTo', {
                            from: displayPerson(s.from),
                            to: displayPerson(s.to),
                          })}
                        </span>
                        {unknown && (
                          <span
                            data-testid="settle-unknown-member"
                            className="shrink-0 rounded-sm border border-stamp/45 bg-paper px-1.5 py-0.5 font-hand text-xs font-bold text-stamp"
                          >
                            {t('notebook.settle.unknownMember')}
                          </span>
                        )}
                      </div>
                      {(s.date || s.note) && (
                        <p className="min-w-0 break-words text-xs text-ink-muted">
                          {[
                            s.date ? shortDayLabel(expenseDateKey(s.date), t) : '',
                            s.note || '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-display text-sm font-bold tabular-nums text-route">
                      {fmt(s.hkdAmount)}
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
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-sm border border-ink-soft/45 bg-paper px-3 py-2.5">
          <span className="min-w-0 font-hand text-sm font-bold text-ink">
            {t('notebook.settle.netLabel')}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap font-display text-base font-bold tabular-nums ${
              (personSettleRow?.net ?? breakdown.net) > 0.5
                ? 'text-teal-strong'
                : (personSettleRow?.net ?? breakdown.net) < -0.5
                  ? 'text-coral-ink'
                  : 'text-ink-muted'
            }`}
          >
            {formatNetAmount(personSettleRow?.net ?? breakdown.net, accountingCurrency)}
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
          className="jr-btn-navy inline-flex min-h-11 min-w-11 w-full items-center justify-center whitespace-nowrap rounded-sm px-4 py-2.5 font-hand text-sm font-bold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
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
    <div
      data-testid="page-charts"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-3 px-4 pb-6 pt-3.5 lg:mx-auto lg:max-w-6xl"
    >
      <div className="relative flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          {showChartsTitleScript && (
            <p className="font-hand text-xs font-bold tracking-wider text-ink-soft">
              {chartsTitleScript}
            </p>
          )}
          <h1 className="font-hand text-2xl font-bold tracking-wider text-ink">{chartsTitle}</h1>
        </div>
      </div>

      <div className="min-w-0 space-y-3.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        {todaySection}
        {hasExpenses ? (
          <>
            <div className="min-w-0 space-y-3.5 lg:col-start-2 lg:row-start-2">
              {categorySection}
              {top5Section}
            </div>
            <div className="flex min-w-0 flex-col gap-3.5 lg:col-start-1 lg:row-start-2">
              {assigneeSection}
              {dailySection}
              {paymentSection}
              {settleSection}
            </div>
          </>
        ) : (
          emptySection
        )}
      </div>

      {settleSheetNode &&
        (typeof document !== 'undefined' ? createPortal(settleSheetNode, document.body) : settleSheetNode)}
    </div>
  );
}
