import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import {
  CameraIcon,
  CheckboxCheckedIcon,
  CheckboxIcon,
  CloudIcon,
  DestinationMap,
  NavyTape,
  PencilIcon,
  PinIcon,
  SunIcon,
  TodayRing,
  TriangleDownIcon,
  WashiLabel,
  resolveDestinationArt,
} from '../../journal/art/index.js';
import {
  CompassVignette,
  PlaneVignette,
  SuitcaseVignette,
} from '../../journal/art/packs/generic.jsx';
import { deriveTodayTodos, nextDaysPreview } from '../../journal/todayTodos.js';
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS, monthGridSunday } from './mockRefTrip';
import {
  CountryFlag,
  STICKER_DOODLE_MAP,
  StickerGraphic,
  resolveTripDestination,
} from './parts';
import { ledgerTotalSummary } from './refLedgerTotal';
import { budgetRemaining, resolveHomeCostDetail } from './homeCost';
import { dayStats, fmtHKD, fmtHKDShort, shortenTitle } from './refLogic';
import { expenseDateKey } from '../../utils/date';

export { budgetRemaining, resolveHomeCostDetail } from './homeCost';

const LazyJpVignettes = lazy(() =>
  import('../../journal/art/packs/jp.jsx').then((m) => {
    const pack = m.default || m;
    const { PagodaVignette, GateVignette, LanternVignette } = m;
    const Pagoda = PagodaVignette || pack?.vignettes?.pagoda;
    const Gate = GateVignette || pack?.vignettes?.gate;
    const Lantern = LanternVignette || pack?.vignettes?.lantern;
    return {
      default: function JpVignetteRow() {
        return (
          <div className="flex items-center gap-2">
            {Pagoda ? <Pagoda className="h-6 w-8" /> : null}
            {Gate ? <Gate className="h-6 w-8" /> : null}
            {Lantern ? <Lantern className="h-6 w-8" /> : null}
          </div>
        );
      },
    };
  }),
);

function GenericVignetteRow() {
  return (
    <div className="flex items-center gap-2">
      <SuitcaseVignette className="h-6 w-6" />
      <PlaneVignette className="h-6 w-6" />
      <CompassVignette className="h-6 w-6" />
    </div>
  );
}

const hasSticker = (id) => Boolean(id && (STICKERS.some((s) => s.id === id) || STICKER_DOODLE_MAP[id]));
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_KEYS = [
  'notebook.home.weekdays.sun',
  'notebook.home.weekdays.mon',
  'notebook.home.weekdays.tue',
  'notebook.home.weekdays.wed',
  'notebook.home.weekdays.thu',
  'notebook.home.weekdays.fri',
  'notebook.home.weekdays.sat',
];

function extractCompanions(trip) {
  const raw = Array.isArray(trip?.settings?.people)
    ? trip.settings.people
    : Array.isArray(trip?.people)
      ? trip.people
      : Array.isArray(trip?.members)
        ? trip.members
        : [];
  return raw
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p && p !== '共同');
}

export function HomeCostCard({
  trip,
  today,
  total,
  count,
  budgetInfo,
  budget,
  counter,
  todaySpend,
  tripCurrency,
  origTotalLabel,
  open,
  defaultOpen = false,
}) {
  const { t } = useTranslation();
  const [localOpen, setLocalOpen] = useState(Boolean(defaultOpen));
  const isOpen = typeof open === 'boolean' ? open : localOpen;

  const expenses = Array.isArray(trip?.expenses) ? trip.expenses : [];
  const resolvedTotal =
    typeof total === 'number'
      ? total
      : expenses.reduce((s, e) => s + (Number(e?.hkdAmount) || 0), 0);
  const resolvedCount = typeof count === 'number' ? count : expenses.length;

  const costDetail = resolveHomeCostDetail(trip);
  const resolvedCurrency =
    typeof tripCurrency === 'string' && tripCurrency.trim()
      ? tripCurrency.trim().toUpperCase()
      : costDetail.tripCurrency;
  const resolvedOrigLabel =
    typeof origTotalLabel === 'string' ? origTotalLabel : costDetail.origTotalLabel;
  const showDetail = Boolean(resolvedOrigLabel && resolvedCurrency !== 'HKD');

  const rawBudget =
    budget !== undefined
      ? budget
      : budgetInfo !== undefined
        ? typeof budgetInfo === 'number'
          ? budgetInfo
          : budgetInfo?.budget ?? null
        : trip?.settings?.budget ?? trip?.budget ?? null;
  const rawSpent =
    budgetInfo && typeof budgetInfo === 'object' && typeof budgetInfo.spent === 'number'
      ? budgetInfo.spent
      : resolvedTotal;
  const budgetState = budgetRemaining(rawBudget, rawSpent);

  const resolvedCounter =
    counter || (trip && today ? dayCounter(trip, today, { t }) : { phase: 'during', label: '' });
  const resolvedTodaySpend =
    typeof todaySpend === 'number'
      ? todaySpend
      : trip && today
        ? dayStats(expenses, today).total
        : 0;

  const barPct = budgetState ? budgetState.barPct : 0;
  const fillW = Number(((304 * barPct) / 100).toFixed(1));
  const fillEndX = Number((2 + fillW).toFixed(1));
  const mid1 = Number((2 + fillW * 0.35).toFixed(1));
  const mid2 = Number((2 + fillW * 0.7).toFixed(1));
  const hatchSegments = [];
  if (barPct > 0) {
    for (let x = 12; x + 4 < fillEndX - 1; x += 14) {
      hatchSegments.push(`M${x} 9.2 L${x + 4} 2.8`);
    }
  }
  const hatchPath = hatchSegments.join(' ');
  const panelId = 'home-cost-detail-panel';

  return (
    <section className="jr-taped-card relative min-w-0 bg-paper-shade/90 px-3.5 pb-1 pt-2.5">
      <NavyTape
        tilt={2}
        className="absolute -top-2.5 right-3 z-10 h-3 w-14"
      />

      <div className="mb-1.5 pr-16">
        <WashiLabel tilt={-2}>{t('notebook.home.expenseLabel')}</WashiLabel>
      </div>

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2
          data-testid="trip-total"
          className="whitespace-nowrap font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink lg:text-hero-sm"
        >
          {fmtHKD(resolvedTotal)}
        </h2>
        <p className="whitespace-nowrap font-display text-xs font-medium tabular-nums text-ink-muted">
          {t('notebook.home.recordsCount', { count: resolvedCount })}
        </p>
      </div>

      {budgetState && (
        <div data-testid="home-budget-pill" className="mt-1.5 min-w-0">
          <div
            data-testid="home-budget-bar"
            data-pct={String(barPct)}
            aria-hidden="true"
            className="relative h-2 w-full"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 308 12"
              preserveAspectRatio="none"
              fill="none"
              className="block h-full w-full overflow-visible"
            >
              <path
                d="M2 2.4 C78 1.7, 158 2.8, 236 2.1 C268 1.9, 292 2.5, 306 2.2 L306.3 9.7 C248 10.2, 162 9.3, 84 10.1 C42 10.3, 16 9.6, 1.8 9.8 Z"
                fill="rgb(var(--c-paper))"
              />
              {barPct > 0 && (
                <path
                  d={`M2.2 2.5 C${mid1} 2.0, ${mid2} 2.7, ${fillEndX} 2.2 L${fillEndX} 9.7 C${mid2} 10.0, ${mid1} 9.4, 2.0 9.7 Z`}
                  fill="rgb(var(--c-tape-navy))"
                />
              )}
              {hatchPath && (
                <path
                  d={hatchPath}
                  stroke="rgb(var(--c-paper) / 0.22)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              )}
              <path
                d="M2 2.4 C78 1.7, 158 2.8, 236 2.1 C268 1.9, 292 2.5, 306 2.2 L306.3 9.7 C248 10.2, 162 9.3, 84 10.1 C42 10.3, 16 9.6, 1.8 9.8 Z"
                stroke="rgb(var(--c-ink-soft))"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {barPct > 0 && barPct < 100 && (
                <path
                  d={`M${fillEndX} 1.1 L${fillEndX} 10.9`}
                  stroke="rgb(var(--c-ink-soft))"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </div>

          <div className="mt-1 flex min-w-0 items-baseline justify-between gap-2 font-display text-xs tabular-nums">
            <span className="whitespace-nowrap font-medium text-ink-muted">
              {t('notebook.home.budgetUsedPct', { pct: budgetState.pct })}
            </span>
            <span
              data-testid="home-budget-remaining"
              className={`whitespace-nowrap font-bold ${
                budgetState.over ? 'text-stamp' : 'text-ink'
              }`}
            >
              {budgetState.over
                ? t('notebook.home.budgetOverBy', { amount: fmtHKD(budgetState.overBy) })
                : t('notebook.home.budgetRemaining', { amount: fmtHKD(budgetState.remaining) })}
            </span>
          </div>
        </div>
      )}

      <div className="mt-1.5 flex min-h-11 min-w-0 items-center justify-between gap-2 border-t border-dashed border-ink-soft/30 font-display tabular-nums">
        <div
          data-testid="today-line"
          className="min-w-0 truncate whitespace-nowrap font-display text-xs font-bold tabular-nums text-ink-soft"
        >
          {resolvedCounter.phase === 'during'
            ? t('notebook.home.todaySpend', { amount: fmtHKDShort(resolvedTodaySpend) })
            : resolvedCounter.label}
        </div>

        {showDetail && (
          <button
            type="button"
            data-testid="home-cost-detail-toggle"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={() => setLocalOpen((prev) => !prev)}
            className="inline-flex min-h-11 min-h-[44px] min-w-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 font-display text-xs font-bold tabular-nums text-route transition-colors hover:bg-paper/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            <span>{t('notebook.home.costDetail')}</span>
            <span
              aria-hidden="true"
              className={`inline-block text-xs leading-none transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            >
              ▾
            </span>
          </button>
        )}
      </div>

      {showDetail && isOpen && (
        <div
          id={panelId}
          data-testid="home-cost-detail"
          className="mb-1 mt-0.5 flex min-w-0 items-baseline justify-between gap-2 rounded-sm border border-ink-soft/25 bg-paper/75 px-2.5 py-1.5 font-display text-xs tabular-nums"
        >
          <span className="whitespace-nowrap text-ink-muted">
            {t('notebook.home.costDetailForeign')}
          </span>
          <span className="whitespace-nowrap font-bold text-ink">
            {resolvedOrigLabel}
          </span>
        </div>
      )}
    </section>
  );
}

export default function Home({
  trip,
  today,
  month,
  setMonth,
  selectedDay = null,
  onOpenDay,
  onScan,
  onAdd,
  costDetailOpen,
}) {
  const { t } = useTranslation();
  const total = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0);
  const { tripCurrency, origTotalLabel } = resolveHomeCostDetail(trip);
  const counter = dayCounter(trip, today, { t });
  const todaySpend = dayStats(trip.expenses, today).total;
  const todayDay = trip.days[today];
  const [, sm, sd] = trip.startDate.split('-').map(Number);
  const [, em, ed] = trip.endDate.split('-').map(Number);
  const dest = resolveTripDestination(trip);
  const destArt = resolveDestinationArt(trip, dest.cities);
  const countryHeading = t(dest.nameKey);
  const cityLabels = !dest.isFallback
    ? dest.cities.map((c) => t(c.labelKey))
    : destArt.stopNames;

  const companions = extractCompanions(trip);
  const nameSep = t('notebook.charts.nameSeparator');
  const rawBudget = trip.settings?.budget ?? trip.budget ?? null;
  const totalSummary = ledgerTotalSummary({
    shown: trip.expenses,
    all: trip.expenses,
    budget: rawBudget,
  });
  const budgetInfo = totalSummary.budget;

  const VignetteRowComp = !dest.isFallback ? LazyJpVignettes : GenericVignetteRow;
  const shortenedTodayTitle = shortenTitle(todayDay?.title || '', 8);
  const todayTodos = deriveTodayTodos(trip, today);
  const upcomingDays = nextDaysPreview(trip, today, 3);
  const [checkedTodoIds, setCheckedTodoIds] = useState({});

  let nextDaysRangeText = '';
  if (upcomingDays.length > 0) {
    const firstIso = upcomingDays[0].iso;
    const lastIso = upcomingDays[upcomingDays.length - 1].iso;
    const [, m1, d1] = firstIso.split('-').map(Number);
    const [, m2, d2] = lastIso.split('-').map(Number);
    nextDaysRangeText =
      firstIso === lastIso
        ? t('notebook.home.dayCellDate', {
            month: m1,
            day: d1,
            monthEn: MONTH_EN[m1 - 1],
          })
        : t('notebook.home.nextDaysRange', {
            startMonth: m1,
            startDay: d1,
            endMonth: m2,
            endDay: d2,
            startMonthEn: MONTH_EN[m1 - 1],
            endMonthEn: MONTH_EN[m2 - 1],
          });
  }

  return (
    <div
      data-testid="home"
      className="space-y-3.5 px-4 pb-6 pt-3.5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:gap-y-4 lg:space-y-0"
    >
      {/* Left page: Cover card + 旅費 total block */}
      <div
        data-testid="summary"
        className="min-w-0 space-y-3.5 lg:col-span-5 lg:col-start-1 lg:row-start-1"
      >
        {/* 1. Taped cover card */}
        <section className="jr-taped-card relative min-w-0 bg-paper px-3 pb-3 pt-4 lg:px-4 lg:pb-4 lg:pt-5">
          {/* Corner washi tapes (navy top-left, kraft top-right, tilted ±3°) */}
          <NavyTape
            tilt={-3}
            className="absolute -top-2.5 left-3 z-10 h-3 w-14"
          />
          <span
            aria-hidden="true"
            data-jr-decor="washi"
            style={{ '--jr-tilt': '2deg' }}
            className="jr-washi pointer-events-none absolute -top-2.5 right-3 z-10 h-3 w-12 select-none"
          />

          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* Country place tag + flag dot for JP (+ before/after status tag) */}
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-ink-soft/35 bg-paper-shade/85 px-2 py-0.5 font-hand text-xs font-bold text-ink-soft">
                  {!dest.isFallback && <CountryFlag code={dest.code} className="h-3 w-4" />}
                  <span>{countryHeading}</span>
                </span>
                {counter.phase !== 'during' && (
                  <span className="rounded-sm border border-stamp/40 bg-paper px-1.5 py-0.5 font-hand text-xs font-bold text-stamp">
                    {t(
                      counter.phase === 'before'
                        ? 'notebook.home.stampBefore'
                        : 'notebook.home.stampAfter',
                    )}
                  </span>
                )}
              </div>

              {/* Hand-lettered trip title */}
              <h1 className="mt-1 min-w-0 break-words font-hand text-2xl font-bold leading-tight tracking-wide text-ink lg:text-hero-sm">
                {trip.name}
              </h1>

              {/* Dates + companions metadata (Huninn body font, tabular-nums) */}
              <p className="mt-1 text-xs leading-snug tabular-nums text-ink-muted">
                <span className="block whitespace-nowrap">
                  {t('notebook.home.dateRangeLine', {
                    startMonth: sm,
                    startDay: sd,
                    endMonth: em,
                    endDay: ed,
                    startMonthEn: MONTH_EN[sm - 1],
                    endMonthEn: MONTH_EN[em - 1],
                    total: counter.total,
                  })}
                </span>
                {companions.length > 0 && (
                  <span className="mt-0.5 block truncate">
                    {t('notebook.home.companionsLine', {
                      names: companions.join(nameSep),
                    })}
                  </span>
                )}
              </p>

              {!dest.isFallback && (
                <span className="sr-only">
                  {t('notebook.journal.destinationSummaryAria', {
                    country: countryHeading,
                    localName: dest.localName,
                    cities: cityLabels.join(', '),
                  })}
                </span>
              )}
            </div>

            {/* Landmark vignettes row from destination pack */}
            <div
              aria-hidden="true"
              data-testid="landscape-strip"
              className="pointer-events-none shrink-0 pt-0.5 select-none"
            >
              <Suspense
                fallback={
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 96 24"
                    fill="none"
                    className="h-6 w-24 text-ink-soft"
                  >
                    <line
                      x1="4"
                      y1="20"
                      x2="92"
                      y2="20"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="2 3"
                    />
                  </svg>
                }
              >
                <VignetteRowComp />
              </Suspense>
            </div>
          </div>

          {/* Destination map (JP coastline + route dots; others route dots only) + city paper tags */}
          <div
            data-testid={!dest.isFallback ? 'japan-mini-map' : undefined}
            className="jr-home-map mt-2.5 min-w-0 overflow-hidden rounded-sm"
          >
            <DestinationMap
              trip={trip}
              cities={dest.cities}
              labels={cityLabels}
              fit="stops"
              className="w-full"
            />
            {cityLabels.length > 0 && cityLabels.length < 2 && (
              <div
                aria-hidden="true"
                className="mt-1.5 flex flex-wrap items-center gap-1"
              >
                {cityLabels.map((label, idx) => (
                  <span key={`${label}-${idx}`} className="inline-flex items-center gap-1">
                    {idx > 0 && (
                      <span className="text-xs text-ink-muted">→</span>
                    )}
                    <span className="rounded-sm border border-route/45 bg-route-soft/55 px-1.5 py-0.5 font-hand text-xs font-bold leading-none text-route">
                      {label}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 2. 旅費 total block (kraft paper, WashiLabel 「旅費」, navy washi on top-right) */}
        <HomeCostCard
          trip={trip}
          today={today}
          total={total}
          count={trip.expenses.length}
          budgetInfo={budgetInfo}
          counter={counter}
          todaySpend={todaySpend}
          tripCurrency={tripCurrency}
          origTotalLabel={origTotalLabel}
          open={costDetailOpen}
        />
      </div>

      {counter.phase === 'during' && (
        <div
          className="jr-taped-card relative min-w-0 bg-paper lg:col-span-7 lg:col-start-6 lg:row-start-2"
        >
          <span
            aria-hidden="true"
            data-jr-decor="washi"
            style={{ '--jr-tilt': '2deg' }}
            className="jr-washi pointer-events-none absolute -top-2.5 right-3 z-10 h-3 w-12 select-none"
          />
          <button
            type="button"
            data-testid="today-row"
            onClick={() => onOpenDay(today)}
            className="flex min-h-12 w-full items-center justify-between gap-2.5 px-3 pb-2.5 pt-3.5 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route"
          >
            <span className="inline-flex min-w-0 flex-1 items-center gap-2.5">
              <span
                data-jr-decor="tape"
                style={{ '--jr-tilt': '-2deg' }}
                className="jr-tape-navy shrink-0 whitespace-nowrap px-2.5 py-1 font-hand text-xs font-bold tracking-wider text-paper"
              >
                {t('notebook.home.todayJournal')}
              </span>
              <span className="min-w-0 truncate whitespace-nowrap font-hand text-sm font-bold text-ink">
                {shortenedTodayTitle
                  ? t('notebook.home.todayRowTitle', {
                      n: counter.n,
                      title: shortenedTodayTitle,
                    })
                  : t('notebook.home.todayRowDayOnly', { n: counter.n })}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 whitespace-nowrap px-0.5 text-base font-bold text-route"
            >
              ›
            </span>
          </button>
        </div>
      )}

      {/* 3. Actions: 掃描收據 (filled navy, camera icon) + 記一筆 (outline, pencil icon), each >= 48px tall */}
      <div className="grid min-w-0 grid-cols-2 gap-3 lg:col-span-5 lg:col-start-1 lg:row-start-2">
        <button
          type="button"
          data-testid="home-scan"
          onClick={onScan}
          className="jr-btn-navy inline-flex min-h-[48px] min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-bold tracking-wider transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <CameraIcon className="h-5 w-5 shrink-0 text-paper" />
          <span className="font-hand">{t('notebook.home.scanReceipt')}</span>
        </button>
        <button
          type="button"
          data-testid="home-add"
          onClick={onAdd}
          className="jr-btn-paper inline-flex min-h-[48px] min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-bold tracking-wider transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <PencilIcon className="h-5 w-5 shrink-0 text-route" />
          <span className="font-hand">{t('notebook.home.addEntry')}</span>
        </button>
      </div>

      <Calendar
        trip={trip}
        today={today}
        month={month}
        setMonth={setMonth}
        selectedDay={selectedDay}
        onOpenDay={onOpenDay}
      />

      {/* 5. 今日待辦 checklist card (mobile after calendar; lg in left page under actions) */}
      {todayTodos.length > 0 && (
        <section
          data-testid="today-todos"
          className="jr-grid jr-taped-card relative min-w-0 px-3.5 pb-3.5 pt-4 lg:col-span-5 lg:col-start-1 lg:row-start-3"
        >
          <span
            aria-hidden="true"
            data-jr-decor="washi"
            style={{ '--jr-tilt': '-2deg' }}
            className="jr-washi pointer-events-none absolute -top-2.5 right-3 z-10 h-3 w-12 select-none"
          />
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-ink-soft/30 pb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
              <WashiLabel tilt={-1}>{t('notebook.home.todayTodosLabel')}</WashiLabel>
              <span className="truncate font-hand text-xs font-bold text-ink-muted">
                {todayDay?.title
                  ? t('notebook.home.todayTodosSubtitle', {
                      n: counter.n || 1,
                      title: todayDay.title,
                    })
                  : t('notebook.home.todayTodosSubtitleDayOnly', { n: counter.n || 1 })}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            {todayTodos.map((item) => {
              const isChecked = Boolean(checkedTodoIds[item.id]);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isChecked}
                  data-testid={`today-todo-${item.id}`}
                  onClick={() =>
                    setCheckedTodoIds((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-ink-soft/25 bg-paper/85 px-2.5 py-1.5 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {isChecked ? (
                      <CheckboxCheckedIcon className="h-5 w-5 shrink-0 text-stamp" />
                    ) : (
                      <CheckboxIcon className="h-5 w-5 shrink-0 text-ink" />
                    )}
                    {item.time && (
                      <span
                        className={`shrink-0 text-xs tabular-nums ${
                          isChecked ? 'line-through text-ink-soft' : 'font-bold text-route'
                        }`}
                      >
                        {item.time}
                      </span>
                    )}
                    <span
                      className={`min-w-0 line-clamp-2 break-words text-sm font-bold leading-snug ${
                        isChecked ? 'line-through text-ink-soft' : 'text-ink'
                      }`}
                    >
                      {item.title}
                    </span>
                  </span>
                  {item.spentHkd != null && item.spentHkd > 0 && (
                    <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-ink-muted">
                      {t('notebook.home.todayTodosLogged', {
                        amount: fmtHKD(item.spentHkd),
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Next-3-days card + 「一路順風」 navy tape at the end of the right page */}
      <div
        className={`min-w-0 space-y-3 lg:col-span-7 lg:col-start-6 ${
          counter.phase === 'during' ? 'lg:row-start-3' : 'lg:row-start-2'
        }`}
      >
        {upcomingDays.length > 0 && (
          <section
            data-testid="next-days"
            className="jr-grid jr-taped-card relative min-w-0 px-3 pb-3 pt-4 lg:px-3.5 lg:pb-3.5 lg:pt-4"
          >
            <span
              aria-hidden="true"
              data-jr-decor="washi"
              style={{ '--jr-tilt': '2deg' }}
              className="jr-washi pointer-events-none absolute -top-2.5 right-3 z-10 h-3 w-14 select-none"
            />
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
                <WashiLabel tilt={-1}>{t('notebook.home.nextDaysLabel')}</WashiLabel>
                <span className="text-xs tabular-nums text-ink-muted">
                  {nextDaysRangeText}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-ink-soft/35 rounded-sm border border-ink-soft/45 bg-paper/90">
              {upcomingDays.map((dayItem) => {
                const [, dm, dd] = dayItem.iso.split('-').map(Number);
                const weekdayLabel = t(WEEKDAY_KEYS[dayItem.weekdayIndex]);
                const rawWeather = trip.days?.[dayItem.iso]?.weather;
                const WeatherComp =
                  rawWeather === 'sun' || rawWeather === 'sunny' || rawWeather === '晴'
                    ? SunIcon
                    : rawWeather === 'cloud' ||
                        rawWeather === 'cloudy' ||
                        rawWeather === '陰' ||
                        rawWeather === '多雲'
                      ? CloudIcon
                      : null;

                return (
                  <div
                    key={dayItem.iso}
                    className="flex min-w-0 flex-col items-center p-2 text-center lg:p-2.5"
                  >
                    <div className="mb-1.5 flex w-full items-center justify-center gap-1 border-b border-dashed border-ink-soft/35 pb-1">
                      <span className="truncate font-hand text-xs font-bold tabular-nums text-route">
                        {t('notebook.home.nextDaysColHeader', {
                          month: dm,
                          day: dd,
                          monthEn: MONTH_EN[dm - 1],
                          weekday: weekdayLabel,
                        })}
                      </span>
                      {WeatherComp ? (
                        <WeatherComp className="h-3.5 w-3.5 shrink-0 text-stamp" />
                      ) : null}
                    </div>

                    <div className="flex w-full min-w-0 flex-col items-center">
                      {dayItem.stops.map((stopText, idx) => (
                        <div
                          key={`${dayItem.iso}-stop-${idx}`}
                          className="flex w-full min-w-0 flex-col items-center"
                        >
                          {idx > 0 && (
                            <span
                              aria-hidden="true"
                              className="my-0.5 inline-flex items-center text-xs text-stamp"
                            >
                              <TriangleDownIcon className="h-3 w-3" />
                              <span className="sr-only">▼</span>
                            </span>
                          )}
                          <span className="w-full truncate text-xs font-bold text-ink lg:text-sm">
                            {stopText}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div aria-hidden="true" className="flex justify-end pt-1">
          <span
            data-jr-decor="tape"
            style={{ '--jr-tilt': '-2deg' }}
            className="jr-tape-navy pointer-events-none inline-block px-4 py-1 font-hand text-xs font-bold tracking-widest text-paper select-none"
          >
            {t('notebook.home.bonVoyage')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Calendar({ trip, today, month, setMonth, selectedDay = null, onOpenDay }) {
  const { t } = useTranslation();
  const [y, m] = month.split('-').map(Number);
  const weeks = monthGridSunday(`${month}-01`);
  const shift = (n) => {
    const dt = new Date(y, m - 1 + n, 1);
    setMonth(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  };
  const inTrip = (iso) => iso >= trip.startDate && iso <= trip.endDate;
  const spendByIso = new Map();
  for (const e of trip.expenses || []) {
    if (!e || !e.date) continue;
    const key = expenseDateKey(e.date);
    if (!key) continue;
    spendByIso.set(key, (spendByIso.get(key) || 0) + (Number(e.hkdAmount) || 0));
  }
  const [, sm, sd] = (trip.startDate || '').split('-').map(Number);
  const [, em, ed] = (trip.endDate || '').split('-').map(Number);
  const hasValidTripDates = Boolean(sm && sd && em && ed);
  const tripStartMonth = (trip.startDate || '').slice(0, 7);
  const hasTripInMonth = weeks.some((w) => w.some((c) => c.inMonth && inTrip(c.iso)));
  const monthEn = MONTH_EN[m - 1];
  const monthTitle = t('notebook.home.monthTitle', { year: y, month: m, monthEn });

  return (
    <div
      data-testid="calendar"
      className="jr-grid jr-taped-card relative min-w-0 px-1 pb-3 pt-7 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:px-4 lg:pb-4 lg:pt-8"
    >
      <NavyTape
        tilt={-3}
        className="absolute -top-2.5 left-2.5 z-10 h-3 w-14"
      />
      <span
        aria-hidden="true"
        data-jr-decor="washi"
        style={{ '--jr-tilt': '3deg' }}
        className="jr-washi pointer-events-none absolute -top-2.5 right-2.5 z-10 h-3 w-12 select-none"
      />

      <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
        <WashiLabel tilt={1} className="px-4 py-0.5">
          <PinIcon className="mr-1 h-3.5 w-3.5 text-stamp" />
          <span>{t('notebook.home.itineraryLabel')}</span>
        </WashiLabel>
      </div>

      <div className="mb-2 flex min-w-0 items-center justify-between gap-1.5 border-b border-ink-soft/30 pb-1.5">
        <button
          type="button"
          aria-label={t('notebook.home.prevMonthAria')}
          onClick={() => shift(-1)}
          className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
            <h3 className="whitespace-nowrap font-hand text-base font-bold tracking-wider text-ink lg:text-xl">
              {monthTitle}
            </h3>
            {!hasTripInMonth && month !== tripStartMonth && (
              <button
                type="button"
                onClick={() => setMonth(tripStartMonth)}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-route/45 bg-route-soft px-2.5 py-1 font-hand text-xs font-bold text-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                {t('notebook.home.backToTripMonth')}
              </button>
            )}
          </div>
          {hasValidTripDates && (
            <p className="mt-0.5 max-w-full truncate text-xs tabular-nums text-ink-muted">
              {t('notebook.home.tripRangeSubtitle', {
                startMonth: sm,
                startDay: sd,
                endMonth: em,
                endDay: ed,
                startMonthEn: MONTH_EN[sm - 1],
                endMonthEn: MONTH_EN[em - 1],
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={t('notebook.home.nextMonthAria')}
          onClick={() => shift(1)}
          className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          ›
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7 border-b border-dashed border-ink-soft/30 pb-1 text-center font-hand text-xs font-bold">
        {WEEKDAY_KEYS.map((wKey, i) => (
          <div
            key={wKey}
            className={i === 0 ? 'text-stamp' : i === 6 ? 'text-route' : 'text-ink-soft'}
          >
            {t(wKey)}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week) => (
          <div
            key={week[0].iso}
            className="grid grid-cols-[repeat(7,minmax(0,1fr))] lg:gap-1.5"
          >
            {week.map((c) => {
              const day = trip.days[c.iso];
              const isTripDay = inTrip(c.iso);
              const isToday = c.iso === today;
              const isSelected = Boolean(selectedDay && c.iso === selectedDay);
              const rawNote = day?.note ? capCellNote(day.note) : '';
              const rawNoteChars = Array.from(rawNote);
              const hasCjkNote = rawNoteChars.some((ch) => ch.charCodeAt(0) > 0x2e7f);
              const note =
                hasCjkNote && rawNoteChars.length > 3
                  ? capCellNote(day.note, 9)
                  : rawNote;
              const noteCharCount = Array.from(note).length;
              const canSideBySideLg = Boolean(
                note && (hasCjkNote ? noteCharCount <= 2 : noteCharCount <= 4),
              );
              const stickerId = day?.sticker && hasSticker(day.sticker) ? day.sticker : '';
              const cellMonth = Number(c.iso.slice(5, 7));
              const n = Number(c.iso.slice(8));
              const cellSpend = spendByIso.get(c.iso) || 0;
              const cellDateLabel = t('notebook.home.dayCellDate', {
                month: cellMonth,
                day: n,
                monthEn: MONTH_EN[cellMonth - 1],
              });
              const dayTone = isTripDay
                ? 'font-bold text-ink'
                : c.inMonth
                  ? 'font-bold text-ink-muted opacity-80'
                  : 'font-bold text-ink-muted opacity-45';
              const cellBoxClass = isToday
                ? 'border-stamp/80 bg-wash-wheat/55'
                : isTripDay
                  ? 'border-route/35 bg-route-soft/75'
                  : 'border-ink-soft/10 bg-paper/45';

              return (
                <button
                  key={c.iso}
                  type="button"
                  data-testid={`day-cell-${c.iso}`}
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => onOpenDay(c.iso)}
                  aria-label={`${cellDateLabel}${day?.title ? ` ${day.title}` : ''}`}
                  className={`relative flex min-h-[60px] min-w-[44px] flex-col items-center justify-between gap-0.5 rounded-sm border px-0.5 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route lg:min-h-[66px] lg:p-1.5 ${cellBoxClass} ${
                    isSelected ? 'ring-2 ring-route' : ''
                  }`}
                >
                  <div
                    className={`flex w-full flex-col items-center gap-1 ${
                      canSideBySideLg
                        ? 'lg:flex-row lg:items-center lg:justify-between lg:gap-1'
                        : ''
                    }`}
                  >
                    {isToday ? (
                      <TodayRing className="h-6 w-6 shrink-0">{n}</TodayRing>
                    ) : (
                      <span
                        className={`inline-flex h-5 shrink-0 items-center justify-center text-xs leading-none tabular-nums ${dayTone}`}
                      >
                        {n}
                      </span>
                    )}
                    {note ? (
                      <span
                        data-cell-note
                        className={`inline-block shrink-0 whitespace-nowrap rounded-sm border bg-paper px-0.5 py-0.5 font-hand text-xs font-bold leading-none lg:px-1 ${
                          isToday
                            ? 'border-stamp/45 text-stamp'
                            : 'border-route/35 text-route'
                        }`}
                      >
                        {note}
                      </span>
                    ) : stickerId ? (
                      <span className="inline-flex shrink-0 items-center justify-center">
                        <StickerGraphic id={stickerId} className="text-xs leading-none" />
                      </span>
                    ) : null}
                  </div>

                  {cellSpend > 0 ? (
                    <span
                      data-cell-spend
                      className={`block max-w-full truncate text-xs leading-none tabular-nums ${
                        isToday ? 'font-bold text-stamp' : 'text-ink-soft'
                      }`}
                    >
                      {`$${Math.round(cellSpend).toLocaleString('en-US')}`}
                    </span>
                  ) : (
                    <span className="block h-3" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
