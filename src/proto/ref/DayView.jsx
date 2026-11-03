import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import {
  CameraIcon,
  PencilIcon,
  TriangleDownIcon,
  WashiLabel,
  packKeyForTrip,
} from '../../journal/art/index.js';
import { SuitcaseVignette } from '../../journal/art/packs/generic.jsx';
import { isStickerTarget } from '../../motion/stickerKeyframes';
import { capCellNote, dayCounter } from '../shared/display';
import { dayStampLines, localDayStrip } from './dayHeader';
import { STICKERS } from './mockRefTrip';
import {
  DoodleSticker,
  Icon,
  STICKER_DOODLE_MAP,
  StickerGraphic,
} from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import {
  dayExpenses,
  dayStats,
  fmtHKD,
  formatNotebookDate,
  matchesPerson,
  personCounts,
} from './refLogic';
import { dayNav, isTimeEntryInvalid, parseHHMM, sortStops } from './refRules';

const PANES = ['itinerary', 'expenses'];
const hasSticker = (id) => Boolean(id && (STICKERS.some((s) => s.id === id) || STICKER_DOODLE_MAP[id]));

const LazyJpDayVignette = lazy(() =>
  import('../../journal/art/packs/jp.jsx').then((m) => {
    const pack = m.default || m;
    const Fuji = m.FujiVignette || pack?.vignettes?.fuji;
    const Pagoda = m.PagodaVignette || pack?.vignettes?.pagoda;
    const Comp = Fuji || Pagoda;
    return {
      default: function JpDayVignette() {
        return Comp ? <Comp className="h-8 w-11" /> : null;
      },
    };
  }),
);

function DayVignette({ trip }) {
  const packKey = packKeyForTrip(trip);
  return (
    <div
      aria-hidden="true"
      data-testid="day-vignette"
      data-pack={packKey}
      className="pointer-events-none shrink-0 select-none"
    >
      {packKey === 'jp' ? (
        <Suspense fallback={<span aria-hidden="true" className="inline-block h-8 w-11" />}>
          <LazyJpDayVignette />
        </Suspense>
      ) : (
        <SuitcaseVignette className="h-8 w-8" />
      )}
    </div>
  );
}

function DayStampBadge({ top, bottom }) {
  return (
    <div
      aria-hidden="true"
      data-testid="day-stamp"
      className="pointer-events-none relative flex h-[4.25rem] w-[4.25rem] shrink-0 -rotate-3 flex-col items-center justify-center gap-0.5 rounded-full border border-stamp/75 bg-paper px-1 text-center text-stamp"
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 68 68"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-stamp"
      >
        <circle
          cx="34"
          cy="34"
          r="30.5"
          stroke="currentColor"
          strokeOpacity="0.48"
          strokeWidth="1"
          strokeDasharray="14 3 6 2"
        />
        <path
          d="M14 19 H54 M14 49 H54"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
      </svg>
      <span className="relative whitespace-nowrap font-hand text-xs font-bold leading-none tracking-tight text-stamp">
        {top}
      </span>
      <span className="relative whitespace-nowrap font-hand text-xs font-bold leading-none tracking-tighter tabular-nums text-stamp">
        {bottom}
      </span>
    </div>
  );
}

function usePager(index, setIndex) {
  const track = useRef(null);
  const g = useRef(null);
  const dxRef = useRef(0);
  const [drag, setDrag] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const handlers = {
    onPointerDown: (e) => {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
      if (e.target.closest('input,textarea,select,[data-noswipe],.overflow-x-auto,[role=dialog],[role=menu]')) return;
      if (document.querySelector('[role=dialog][aria-modal=true]')) return;
      if (e.clientX < 24 || e.clientX > window.innerWidth - 24) return;
      g.current = { x: e.clientX, y: e.clientY, id: e.pointerId, axis: null };
      dxRef.current = 0;
    },
    onPointerMove: (e) => {
      const s = g.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!s.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (s.axis === 'x') track.current?.setPointerCapture?.(e.pointerId);
      }
      if (s.axis !== 'x') return;
      const atEdge = (index === 0 && dx > 0) || (index === PANES.length - 1 && dx < 0);
      dxRef.current = atEdge ? dx / 4 : dx;
      setDrag(dxRef.current);
    },
    onPointerUp: () => {
      const s = g.current;
      g.current = null;
      if (!s || s.axis !== 'x') return;
      const w = track.current?.offsetWidth || 390;
      const dx = dxRef.current;
      if (dx < -Math.min(70, w * 0.18) && index < PANES.length - 1) setIndex(index + 1);
      else if (dx > Math.min(70, w * 0.18) && index > 0) setIndex(index - 1);
      dxRef.current = 0;
      setDrag(0);
    },
  };
  handlers.onPointerCancel = handlers.onPointerUp;
  const style = {
    transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
    transition: drag || reduce ? 'none' : 'transform 260ms ease-out',
  };
  return { track, handlers, style };
}

function useIsDesktopLg() {
  const [isDesktopLg, setIsDesktopLg] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 1024px)').matches),
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktopLg(Boolean(mql.matches));
    sync();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', sync);
      return () => mql.removeEventListener('change', sync);
    }
    mql.addListener?.(sync);
    return () => mql.removeListener?.(sync);
  }, []);
  return isDesktopLg;
}

export default function DayView({
  trip,
  iso,
  pane,
  editing,
  highlightId,
  stickerId,
  onStickerPlayed,
  onPane,
  onEditToggle,
  onBack,
  onDay,
  onUpdateDay,
  onScan,
  onRequestScan,
  onAdd,
  onEditExpense,
  onDeleteExpense,
}) {
  const { t, i18n: activeI18n } = useTranslation();
  const handleScan = (targetIso) => {
    if (typeof onRequestScan === 'function') {
      onRequestScan(targetIso);
      return;
    }
    onScan?.(targetIso);
  };
  const index = Math.max(0, PANES.indexOf(pane));
  const setIndex = (i) => onPane(PANES[i]);
  const { track, handlers, style } = usePager(index, setIndex);
  const isDesktopLg = useIsDesktopLg();
  const day = trip.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] };
  const [, m, d] = iso.split('-').map(Number);
  const formattedDate = formatNotebookDate(iso, { t, lang: activeI18n.language });
  const nav = dayNav(trip, iso);
  const { inTrip } = nav;
  const nearestTripDay = nav.next || nav.prev || trip.startDate;
  const dayN = inTrip ? dayCounter(trip, iso).n : null;
  const stats = dayStats(trip.expenses, iso);
  const strip = localDayStrip({
    n: dayN,
    title: day.title,
    hkd: stats.total,
    t,
    lang: activeI18n.language,
  });
  const hints = [t('notebook.day.swipeLeftHint'), t('notebook.day.swipeRightHint')];

  useEffect(() => {
    if (!highlightId) window.scrollTo(0, 0);
  }, [iso, highlightId]);

  return (
    <div
      data-testid="day-view"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-2.5 px-4 pt-3.5 lg:mx-auto lg:max-w-6xl"
    >
      {/* Top date navigator paper strip */}
      <header className="jr-taped-card relative flex min-w-0 items-center gap-1 sm:gap-1.5 bg-paper px-1.5 sm:px-2 py-1.5">
        <button
          type="button"
          data-testid="back"
          onClick={onBack}
          className="jr-btn-paper inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-2 sm:px-3 font-hand text-sm font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          {t('notebook.day.backToCalendar')}
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-1.5 px-0.5 sm:px-1">
          <h1 className="shrink-0 whitespace-nowrap font-hand text-sm font-bold text-ink">
            {formattedDate}
          </h1>
          <span
            data-notched-tab="day-badge"
            className={`shrink-0 items-center whitespace-nowrap rounded-sm border py-0.5 font-hand text-meta font-bold ${
              dayN
                ? 'hidden sm:inline-flex border-stamp bg-paper px-2 text-stamp'
                : 'inline-flex border-dashed border-ink-muted bg-paper-shade px-1.5 sm:px-2 tracking-tight text-ink-muted'
            }`}
          >
            {dayN ? t('notebook.day.dayBadge', { n: dayN }) : t('notebook.day.outsideTrip')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={t('notebook.day.prevDayAria')}
            disabled={!nav.prev}
            aria-disabled={!nav.prev}
            onClick={() => nav.prev && onDay(nav.prev)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-sm border border-ink-soft/45 bg-paper text-base font-bold text-ink transition-opacity hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route disabled:pointer-events-none disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t('notebook.day.nextDayAria')}
            disabled={!nav.next}
            aria-disabled={!nav.next}
            onClick={() => nav.next && onDay(nav.next)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-sm border border-ink-soft/45 bg-paper text-base font-bold text-ink transition-opacity hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route disabled:pointer-events-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </header>

      {/* Mobile notebook index tabs (hidden at lg where both panes sit side by side) */}
      <div className="space-y-1.5 lg:hidden">
        <div
          className="grid grid-cols-2 gap-1 rounded-sm border border-ink-soft/45 bg-paper-shade p-1"
          role="tablist"
        >
          {[
            ['itinerary', t('notebook.day.tabItinerary'), day.itinerary.length],
            ['expenses', t('notebook.day.tabExpenses'), stats.count],
          ].map(([id, label, n], i) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={index === i}
              data-testid={`tab-${id}`}
              onClick={() => setIndex(i)}
              className={`min-h-11 min-w-0 whitespace-nowrap rounded-sm px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                index === i
                  ? 'border-b-2 border-route bg-paper text-ink'
                  : 'bg-paper-shade text-ink-soft hover:bg-paper/60 hover:text-ink'
              }`}
            >
              <span className="font-hand">{label}</span>{' '}
              <span className="font-display tabular-nums">{n}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 px-2" aria-hidden="true">
          {PANES.map((p, i) => (
            <span
              key={p}
              className={`rounded-full transition-all ${
                index === i ? 'h-2 w-5 bg-route' : 'h-2 w-2 bg-ink-soft/30'
              }`}
            />
          ))}
          <span className="whitespace-nowrap font-hand text-meta text-ink-muted">{hints[index]}</span>
        </div>
      </div>

      {/* Pager (swipe on mobile/tablet; 2-column side-by-side grid at lg) */}
      <div className="-mx-4 overflow-hidden lg:mx-0 lg:overflow-visible">
        <div
          ref={track}
          className="flex touch-pan-y lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:!transform-none"
          style={style}
          {...handlers}
        >
          <section
            data-testid="pane-itinerary"
            ref={(el) => el && el.toggleAttribute('inert', !isDesktopLg && index !== 0)}
            aria-hidden={!isDesktopLg && index !== 0}
            className="w-full min-w-0 shrink-0 touch-pan-y px-4 pb-6 lg:px-0"
          >
            <DayStrip
              text={strip}
              n={dayN}
              title={day.title}
              hkd={stats.total}
              nav={nav}
              onDay={onDay}
            />
            {editing ? (
              <ItineraryEditor
                day={day}
                onChange={(patch) => onUpdateDay(iso, patch)}
                onDone={() => onEditToggle(false)}
              />
            ) : (
              <ItineraryRead
                trip={trip}
                day={day}
                m={m}
                d={d}
                dayN={dayN}
                inTrip={inTrip}
                onReturnToTrip={() => onDay(nearestTripDay)}
                onEdit={() => onEditToggle(true)}
                onScan={() => handleScan(iso)}
                onAdd={() => onAdd?.(iso)}
              />
            )}
          </section>
          <section
            data-testid="pane-expenses"
            ref={(el) => el && el.toggleAttribute('inert', !isDesktopLg && index !== 1)}
            aria-hidden={!isDesktopLg && index !== 1}
            className="w-full min-w-0 shrink-0 touch-pan-y px-4 pb-6 lg:px-0"
          >
            <DayStrip
              text={strip}
              n={dayN}
              title={day.title}
              hkd={stats.total}
              nav={nav}
              onDay={onDay}
              className="lg:hidden"
            />
            <DayExpenses
              trip={trip}
              iso={iso}
              inTrip={inTrip}
              stats={stats}
              highlightId={highlightId}
              stickerId={stickerId}
              onStickerPlayed={onStickerPlayed}
              onReturnToTrip={() => onDay(nearestTripDay)}
              onAdd={onAdd}
              onEdit={onEditExpense}
              onDelete={onDeleteExpense}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function DayStrip({ text, n, title, hkd, nav, onDay, className = '' }) {
  const { t, i18n: activeI18n } = useTranslation();
  const startX = useRef(null);
  const resolvedText =
    text !== undefined
      ? text
      : localDayStrip({ n, title, hkd, t, lang: activeI18n.language });
  return (
    <div
      data-testid="day-strip"
      data-noswipe
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (dx > 48 && nav?.prev) onDay?.(nav.prev);
        else if (dx < -48 && nav?.next) onDay?.(nav.next);
      }}
      onPointerCancel={() => {
        startX.current = null;
      }}
      className={`mb-2.5 truncate whitespace-nowrap rounded-sm border border-dashed border-kraft bg-paper-shade/90 px-3 py-1 text-center font-display text-meta font-semibold tabular-nums text-kraft-ink ${className}`.trim()}
    >
      {resolvedText}
    </div>
  );
}

function ItineraryRead({
  trip,
  day,
  m,
  d,
  dayN,
  inTrip,
  onReturnToTrip,
  onEdit,
  onScan,
  onAdd,
}) {
  const { t, i18n: activeI18n } = useTranslation();
  const stamp = dayStampLines({
    dayN,
    m,
    d,
    lang: activeI18n.language,
    t,
  });
  const hasEmoji = day.sticker && hasSticker(day.sticker);
  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div className="jr-taped-card jr-grid relative space-y-3 overflow-hidden p-3">
      {/* Header row: round stamp-red day stamp + label/title/note + top-right vignette & edit button */}
      <div className="flex min-w-0 items-start gap-2.5">
        <DayStampBadge top={stamp.top} bottom={stamp.bottom} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="whitespace-nowrap font-hand text-xs font-bold tracking-wider text-ink-soft">
                {t('notebook.day.mainItinerary')}
              </span>
              {day.note && (
                <WashiLabel tilt={-1} className="px-2.5 py-0.5">
                  {day.note}
                </WashiLabel>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <DayVignette trip={trip} />
              <button
                type="button"
                data-testid="itinerary-edit"
                onClick={onEdit}
                className="jr-btn-paper inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-hand text-meta font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                {t('notebook.day.editBtn')}
              </button>
            </div>
          </div>

          <h2 className="truncate whitespace-nowrap font-hand text-xl font-bold text-ink">
            {day.title || t('notebook.dayView.noTitle')}
          </h2>
        </div>
      </div>

      {/* Itinerary ▼ stack on grid paper */}
      <div className="jr-grid relative rounded-sm border border-ink-soft/35 bg-paper/90 px-3 py-2.5">
        <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <WashiLabel tilt={-1}>
            {t('notebook.day.stopsSummary', { count: orderedStops.length })}
          </WashiLabel>
          {hasEmoji && (
            <StickerGraphic id={day.sticker} className="shrink-0 text-sm leading-none" />
          )}
        </div>
        <ul className="m-0 list-none space-y-1 p-0">
          {orderedStops.map((s, idx) => (
            <li key={s.id} className="min-w-0">
              {idx > 0 && (
                <div
                  aria-hidden="true"
                  className="my-0.5 flex w-12 items-center justify-center py-0.5 text-route opacity-100"
                >
                  <TriangleDownIcon className="h-3.5 w-3.5 fill-current text-route opacity-100 lg:h-4 lg:w-4" />
                </div>
              )}
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-12 shrink-0 whitespace-nowrap rounded-sm border border-kraft-ink/25 bg-kraft px-1.5 py-0.5 text-center font-display text-meta font-bold tabular-nums text-kraft-ink">
                  {parseHHMM(s.time) || '—'}
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm font-medium text-ink lg:text-base">
                  {s.title}
                </span>
              </div>
            </li>
          ))}
          {orderedStops.length === 0 && (
            <li data-testid="day-itinerary-empty" className="space-y-1.5 py-3 text-center">
              {packKeyForTrip(trip) === 'jp' ? (
                <DoodleSticker name="torii" secondary="fuji" blob="sand" size="xl" />
              ) : (
                <DoodleSticker name="suitcase" secondary="plane" blob="sand" size="xl" />
              )}
              <div>
                <p className="mt-1 font-hand text-sm text-ink">
                  {t('notebook.empty.itineraryTitle')}
                </p>
                <p className="mt-0.5 text-meta text-ink-muted">
                  {t('notebook.empty.itineraryHint')}
                </p>
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* 今日隨筆 ruled note */}
      <div className="jr-ruled relative rounded-sm border border-ink-soft/35 px-3 py-2">
        <span className="mb-1 block whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
          {t('notebook.day.journalTitle')}
        </span>
        <p className="line-clamp-2 break-words text-sm leading-relaxed text-ink">
          {day.journal || t('notebook.dayView.noJournal')}
        </p>
      </div>

      {inTrip ? (
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="day-scan"
            onClick={onScan}
            className="jr-btn-navy inline-flex min-h-12 min-h-[48px] w-full min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-2 text-sm font-bold tracking-tight transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:gap-2 sm:px-3 sm:tracking-wider"
          >
            <CameraIcon className="h-5 w-5 shrink-0 text-paper" />
            <span className="font-hand">{t('notebook.day.scanReceipt')}</span>
          </button>
          <button
            type="button"
            data-testid="itinerary-add"
            onClick={onAdd}
            className="jr-btn-paper inline-flex min-h-12 min-h-[48px] w-full min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-2 text-sm font-bold tracking-tight transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route sm:gap-2 sm:px-3 sm:tracking-wider"
          >
            <PencilIcon className="h-5 w-5 shrink-0 text-route" />
            <span className="font-hand">{t('notebook.day.addEntry')}</span>
          </button>
        </div>
      ) : (
        <div
          data-testid="outside-trip-banner"
          className="flex min-w-0 items-center justify-between gap-2 rounded-sm border border-dashed border-stamp bg-paper px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-ink-soft">
            {t('notebook.day.outsideTripBanner')}
          </span>
          <button
            type="button"
            data-testid="back-to-trip"
            onClick={onReturnToTrip}
            className="jr-btn-navy inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3.5 py-2 font-hand text-meta font-bold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('notebook.day.backToTrip')}
          </button>
        </div>
      )}
    </div>
  );
}

function ItineraryEditor({ day, onChange, onDone }) {
  const { t } = useTranslation();
  const [time, setTime] = useState('');
  const [badTimeInput, setBadTimeInput] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [what, setWhat] = useState('');
  const [editingStopId, setEditingStopId] = useState(null);
  const [editingStopTime, setEditingStopTime] = useState('');
  const timeInputRef = useRef(null);
  const editStopInputRef = useRef(null);

  const isTimeInvalid = isTimeEntryInvalid({ value: time, badInput: badTimeInput });

  const syncTimeFromInput = (target, { showError = false } = {}) => {
    const el = target || timeInputRef.current;
    if (!el) return false;
    const nextVal = el.value ?? '';
    const nextBad = Boolean(el.validity?.badInput);
    setTime(nextVal);
    setBadTimeInput(nextBad);
    const invalid = isTimeEntryInvalid({ value: nextVal, badInput: nextBad });
    if (!invalid) {
      setTimeError(false);
    } else if (showError) {
      setTimeError(true);
    }
    return invalid;
  };

  const add = (e) => {
    if (e) e.preventDefault();
    const el = timeInputRef.current;
    const currentVal = el ? el.value : time;
    const currentBad = Boolean(el?.validity?.badInput) || badTimeInput;
    if (isTimeEntryInvalid({ value: currentVal, badInput: currentBad })) {
      setTime(currentVal);
      setBadTimeInput(currentBad);
      setTimeError(true);
      return;
    }
    if (!what.trim()) return;
    const rawTime = String(currentVal ?? '').trim();
    const cleanTime = rawTime ? parseHHMM(rawTime) : '';
    if (rawTime && !cleanTime) {
      setTimeError(true);
      return;
    }
    const next = sortStops([
      ...day.itinerary,
      { id: `s${Date.now()}`, time: cleanTime, title: what.trim(), done: false },
    ]);
    onChange({ itinerary: next });
    if (el) el.value = '';
    setTime('');
    setBadTimeInput(false);
    setTimeError(false);
    setWhat('');
  };

  const commitStopTime = (stopId, rawVal, inputEl = editStopInputRef.current) => {
    const bad = Boolean(inputEl?.validity?.badInput);
    if (isTimeEntryInvalid({ value: rawVal, badInput: bad })) {
      setTimeError(true);
      return;
    }
    const trimmed = String(rawVal ?? '').trim();
    if (!trimmed) {
      const next = sortStops(day.itinerary.map((s) => (s.id === stopId ? { ...s, time: '' } : s)));
      onChange({ itinerary: next });
      setEditingStopId(null);
      setTimeError(false);
      return;
    }
    const valid = parseHHMM(trimmed);
    if (!valid) {
      setTimeError(true);
      return;
    }
    const next = sortStops(day.itinerary.map((s) => (s.id === stopId ? { ...s, time: valid } : s)));
    onChange({ itinerary: next });
    setEditingStopId(null);
    setTimeError(false);
  };

  const field =
    'h-11 min-h-11 w-full rounded-sm border border-ink-soft bg-paper px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-route';

  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div
      data-testid="itinerary-editor"
      className="jr-taped-card jr-grid relative space-y-2.5 p-3"
    >
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="ref-title" className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
            {t('notebook.day.titleLabel')}
          </label>
          <button
            type="button"
            data-testid="itinerary-done"
            onClick={onDone}
            className="jr-btn-navy inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 font-hand text-meta font-bold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('notebook.day.done')}
          </button>
        </div>
        <input
          id="ref-title"
          className={field}
          value={day.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('notebook.day.titlePlaceholder')}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
            {t('notebook.day.stickerLabel')}
          </span>
          <button
            type="button"
            onClick={() => onChange({ sticker: null })}
            className="jr-btn-paper inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 font-hand text-meta font-bold text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('notebook.day.clear')}
          </button>
        </div>
        <div
          data-noswipe
          className="-mx-3 flex gap-2 overflow-x-auto px-3 py-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label={t('notebook.day.stickerLabel')}
        >
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={day.sticker === s.id}
              aria-label={t(`notebook.day.stickers.${s.id}`, { defaultValue: s.label })}
              onClick={() => onChange({ sticker: s.id })}
              className={`flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border bg-paper text-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                day.sticker === s.id
                  ? 'border-2 border-route ring-2 ring-route'
                  : 'border-ink-soft/45'
              }`}
            >
              <StickerGraphic id={s.id} className="text-lg leading-none" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="ref-note" className="mb-1 block whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
          {t('notebook.day.calendarNoteLabel')}
        </label>
        <input
          id="ref-note"
          className={`${field} !w-24`}
          value={day.note}
          onChange={(e) => onChange({ note: capCellNote(e.target.value) })}
          placeholder={t('notebook.day.calendarNotePlaceholder')}
        />
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {orderedStops.map((s) => (
          <li key={s.id} className="flex min-w-0 items-center gap-2">
            {editingStopId === s.id ? (
              <input
                ref={editStopInputRef}
                type="time"
                aria-label={t('notebook.day.stopTimeAria', { title: s.title })}
                value={editingStopTime}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setEditingStopTime(nextVal);
                  if (!isTimeEntryInvalid({ value: nextVal, badInput: Boolean(e.target.validity?.badInput) })) {
                    setTimeError(false);
                  }
                }}
                onBlur={(e) => commitStopTime(s.id, editingStopTime, e.target)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitStopTime(s.id, editingStopTime, e.target);
                  } else if (e.key === 'Escape') {
                    setEditingStopId(null);
                    setTimeError(false);
                  }
                }}
                className="h-11 min-h-11 w-36 shrink-0 rounded-sm border border-route bg-paper px-2 font-display text-meta tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-route"
              />
            ) : (
              <button
                type="button"
                aria-label={t('notebook.day.editStopTimeAria', { title: s.title })}
                onClick={() => {
                  setEditingStopId(s.id);
                  setEditingStopTime(parseHHMM(s.time) || '');
                  setTimeError(false);
                }}
                className="inline-flex h-11 min-h-11 min-w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-kraft-ink/25 bg-kraft px-2.5 font-display text-meta font-bold tabular-nums text-kraft-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                {parseHHMM(s.time) || '—'}
              </button>
            )}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-ink">{s.title}</span>
            <button
              type="button"
              aria-label={t('notebook.day.deleteStopAria', { title: s.title })}
              onClick={() => onChange({ itinerary: day.itinerary.filter((x) => x.id !== s.id) })}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-stamp/45 bg-paper text-sm font-bold text-stamp transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="space-y-1.5" noValidate>
        <div className="flex min-w-0 items-center gap-1.5">
          <input
            ref={timeInputRef}
            aria-label={t('notebook.day.timeAria')}
            type="time"
            placeholder="09:30"
            className={`${field} !w-36 shrink-0 !px-2 font-display tabular-nums`}
            value={time}
            onChange={(e) => syncTimeFromInput(e.target)}
            onInput={(e) => syncTimeFromInput(e.target)}
            onKeyDown={(e) => {
              const target = e.target;
              if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => syncTimeFromInput(target));
              }
            }}
            onKeyUp={(e) => syncTimeFromInput(e.target)}
            onBlur={(e) => syncTimeFromInput(e.target, { showError: true })}
          />
          <input
            aria-label={t('notebook.day.placeOrActivityAria')}
            placeholder={t('notebook.day.placeOrActivityPlaceholder')}
            className={`${field} min-w-0 flex-1 !px-2.5`}
            value={what}
            onFocus={() => syncTimeFromInput(timeInputRef.current, { showError: true })}
            onChange={(e) => {
              syncTimeFromInput(timeInputRef.current, { showError: true });
              setWhat(e.target.value);
            }}
          />
          <button
            type="submit"
            disabled={!what.trim() || isTimeInvalid}
            className="jr-btn-paper h-11 min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-sm px-3 font-hand text-sm font-bold text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route disabled:pointer-events-none disabled:opacity-50"
          >
            {t('notebook.day.addStopBtn')}
          </button>
        </div>
        {timeError && (
          <p role="alert" data-testid="time-error" className="whitespace-nowrap text-meta font-semibold text-stamp">
            {t('notebook.day.timeFormatError')}
          </p>
        )}
      </form>

      <div>
        <label htmlFor="ref-journal" className="mb-1 block whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
          {t('notebook.day.journalTitle')}
        </label>
        <textarea
          id="ref-journal"
          rows={3}
          className="jr-ruled w-full rounded-sm border border-ink-soft bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-route"
          value={day.journal}
          onChange={(e) => onChange({ journal: e.target.value })}
        />
      </div>
    </div>
  );
}

function DayExpenses({
  trip,
  iso,
  inTrip,
  stats,
  highlightId,
  stickerId,
  onStickerPlayed,
  onReturnToTrip,
  onAdd,
  onEdit,
  onDelete,
}) {
  const { t } = useTranslation();
  const [person, setPerson] = useState('全部');
  const people = trip.settings?.people || ['共同'];
  const displayPerson = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const list = useMemo(() => dayExpenses(trip.expenses, iso), [trip.expenses, iso]);
  const counts = personCounts(list, people);
  const showExtraShared = !people.includes('共同') && list.some((e) => matchesPerson(e, '共同', people));
  const extraSharedCount = showExtraShared
    ? list.filter((e) => matchesPerson(e, '共同', people)).length
    : 0;
  const shown = list.filter((e) => matchesPerson(e, person, people));
  return (
    <div className="space-y-2.5">
      <div className="jr-taped-card jr-grid relative flex min-w-0 items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5">
            <WashiLabel tilt={-1}>{t('notebook.day.dayTotal')}</WashiLabel>
          </div>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="whitespace-nowrap font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink">
              {fmtHKD(stats.total)}
            </span>
            <span className="whitespace-nowrap font-display text-xs font-medium tabular-nums text-ink-muted">
              {t('notebook.day.countBeside', { count: stats.count })}
            </span>
          </div>
          <p className="mt-1 whitespace-nowrap font-display text-meta tabular-nums text-ink-muted">
            {t('notebook.day.scannedManualSummary', {
              scanned: stats.scanned,
              manual: stats.manual,
            })}
          </p>
        </div>

        {inTrip && (
          <button
            type="button"
            data-testid="day-add"
            aria-label={t('notebook.day.addDayExpenseAria')}
            onClick={() => onAdd(iso)}
            className="ml-auto flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-ink-soft bg-tape-navy text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {Icon.plus('h-4 w-4 text-paper')}
          </button>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 whitespace-nowrap font-hand text-sm font-bold text-ink-soft">
          {t('notebook.day.filterLabel')}
        </span>
        <div className="min-w-0 flex-1">
          <ChipRow label={t('notebook.day.filterPersonAria')}>
            <Chip active={person === '全部'} onClick={() => setPerson('全部')}>
              {t('notebook.day.allCount', { count: counts['全部'] || 0 })}
            </Chip>
            {showExtraShared && (
              <Chip active={person === '共同'} onClick={() => setPerson('共同')}>
                {`${displayPerson('共同')} (${extraSharedCount})`}
              </Chip>
            )}
            {people.map((p) => (
              <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
                {displayPerson(p)} ({counts[p] || 0})
              </Chip>
            ))}
          </ChipRow>
        </div>
      </div>

      <div className="space-y-2.5">
        {shown.map((e) => (
          <ExpenseCard
            key={e.id}
            expense={e}
            highlighted={e.id === highlightId}
            stickerPop={isStickerTarget(e.id, stickerId)}
            onStickerPlayed={onStickerPlayed}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {shown.length === 0 &&
          (inTrip ? (
            <div
              data-testid="day-expenses-empty"
              className="jr-taped-card jr-grid space-y-2 border-dashed bg-paper px-4 py-5 text-center"
            >
              <DoodleSticker name="ramen" secondary="camera" blob="sakura" size="xl" />
              <div>
                <p className="mt-1 font-hand text-sm text-ink">
                  {t('notebook.empty.dayExpensesTitle')}
                </p>
                <p className="mt-0.5 text-meta text-ink-muted">
                  {t('notebook.empty.dayExpensesHint')}
                </p>
              </div>
            </div>
          ) : (
            <div className="jr-taped-card space-y-2.5 border-dashed bg-paper p-4 text-center">
              <DoodleSticker name="suitcase" blob="sand" size="lg" />
              <p className="whitespace-nowrap text-sm text-ink-muted">
                {t('notebook.dayView.outsideNoExpenses')}
              </p>
              <button
                type="button"
                onClick={onReturnToTrip}
                className="jr-btn-navy inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 font-hand text-meta font-bold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                {t('notebook.day.backToTrip')}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
