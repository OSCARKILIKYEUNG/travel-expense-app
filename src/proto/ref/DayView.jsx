import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { isStickerTarget } from '../../motion/stickerKeyframes';
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS } from './mockRefTrip';
import {
  DayStamp,
  DoodleSticker,
  Icon,
  NotchedTabBg,
  STICKER_DOODLE_MAP,
  StickerGraphic,
  cardDots,
} from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import {
  dayExpenses,
  dayStats,
  dayStrip,
  fmtHKD,
  formatNotebookDate,
  matchesPerson,
  personCounts,
} from './refLogic';
import { dayNav, isTimeEntryInvalid, parseHHMM, sortStops } from './refRules';

const PANES = ['itinerary', 'expenses'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hasSticker = (id) => Boolean(id && (STICKERS.some((s) => s.id === id) || STICKER_DOODLE_MAP[id]));

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
  const strip = dayStrip({ n: dayN, title: day.title, hkd: stats.total });
  const hints = [t('notebook.day.swipeLeftHint'), t('notebook.day.swipeRightHint')];

  useEffect(() => {
    if (!highlightId) window.scrollTo(0, 0);
  }, [iso, highlightId]);

  return (
    <div
      data-testid="day-view"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-2.5 px-4 pt-4 lg:mx-auto lg:max-w-6xl"
    >
      {/* Top date navigator banner */}
      <header className="relative flex min-w-0 items-center gap-1.5 rounded-2xl border border-line bg-cream-soft px-2 py-1.5 shadow-sm">
        <button
          type="button"
          data-testid="back"
          onClick={onBack}
          className="h-11 min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-xl border border-line bg-cream px-2.5 sm:px-3 text-sm font-bold text-ink transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {t('notebook.day.backToCalendar')}
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1">
          <h1 className="whitespace-nowrap font-hand text-sm text-ink">
            {formattedDate}
          </h1>
          <span
            data-notched-tab="day-badge"
            className={`relative inline-flex shrink-0 items-center whitespace-nowrap rounded-md pl-3.5 pr-3.5 py-0.5 text-meta font-semibold ${
              dayN
                ? 'font-serif-display tracking-[0.04em] text-coral-ink'
                : 'border border-dashed border-ink-muted bg-cream-soft font-hand text-ink-muted'
            }`}
          >
            {dayN && <NotchedTabBg tone="coral" />}
            <span className="relative z-10">{dayN ? `Day ${dayN}` : t('notebook.day.outsideTrip')}</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={t('notebook.day.prevDayAria')}
            disabled={!nav.prev}
            aria-disabled={!nav.prev}
            onClick={() => nav.prev && onDay(nav.prev)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-cream-soft text-base text-ink transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={t('notebook.day.nextDayAria')}
            disabled={!nav.next}
            aria-disabled={!nav.next}
            onClick={() => nav.next && onDay(nav.next)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-cream-soft text-base text-ink transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </header>

      {/* Two-segment control (mobile/tablet only; hidden at lg where both panes sit side by side) */}
      <div className="space-y-1.5 lg:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-beige/80 p-1" role="tablist">
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
              className={`min-h-11 min-w-0 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                index === i
                  ? 'border border-teal/40 bg-cream-soft text-teal-strong shadow-sm'
                  : 'text-ink-soft hover:bg-cream-soft/50 hover:text-ink'
              }`}
            >
              <span className="font-hand">{label}</span> {n}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 px-2" aria-hidden="true">
          {PANES.map((p, i) => (
            <span
              key={p}
              className={`rounded-full transition-all ${index === i ? 'h-2 w-5 bg-teal-strong' : 'h-2 w-2 bg-line'}`}
            />
          ))}
          <span className="whitespace-nowrap text-meta text-ink-muted">{hints[index]}</span>
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
            <DayStrip text={strip} nav={nav} onDay={onDay} />
            {editing ? (
              <ItineraryEditor
                day={day}
                onChange={(patch) => onUpdateDay(iso, patch)}
                onDone={() => onEditToggle(false)}
              />
            ) : (
              <ItineraryRead
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
            <DayStrip text={strip} nav={nav} onDay={onDay} />
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

function DayStrip({ text, nav, onDay }) {
  const startX = useRef(null);
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
      className="mb-2.5 whitespace-nowrap rounded-xl border border-dashed border-line bg-cream-soft/90 px-3 py-1 text-center text-meta font-semibold text-ink-soft"
    >
      {text}
    </div>
  );
}

function ItineraryRead({ day, m, d, dayN, inTrip, onReturnToTrip, onEdit, onScan, onAdd }) {
  const { t } = useTranslation();
  const stampTop = dayN ? `Day ${dayN}` : `${m}/${d}`;
  const stampBottom = `${MONTH_EN[m - 1]} ${d}`;
  const hasEmoji = day.sticker && hasSticker(day.sticker);
  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div
      className="relative space-y-3 overflow-hidden rounded-card border border-line bg-cream-soft p-3"
      style={cardDots}
    >
      <div className="flex items-center gap-3">
        <DayStamp top={stampTop} bottom={stampBottom} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap font-hand text-sm font-semibold tracking-[0.06em] text-ink-soft">
            {t('notebook.day.mainItinerary')}{day.note ? ` · ${day.note}` : ''}
          </p>
          <h2 className="truncate whitespace-nowrap font-hand text-xl text-ink">
            {day.title || t('notebook.dayView.noTitle')}
          </h2>
        </div>
        <button
          type="button"
          data-testid="itinerary-edit"
          onClick={onEdit}
          className="mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-3.5 py-2 text-meta font-bold text-teal-strong shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {t('notebook.day.editBtn')}
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-cream px-3 py-2">
        <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <span className="whitespace-nowrap font-hand text-meta text-ink-muted">
            {t('notebook.day.stopsSummary', { count: orderedStops.length })}
          </span>
          {day.note && (
            <span className="min-w-0 truncate whitespace-nowrap font-hand text-meta font-medium text-teal-strong">
              {t('notebook.day.calendarNoteValue', { note: day.note })}
            </span>
          )}
        </div>
        <ul className="m-0 list-none space-y-1 p-0">
          {orderedStops.map((s) => (
            <li key={s.id} className="flex min-w-0 items-center gap-2">
              <span className="w-12 shrink-0 whitespace-nowrap rounded-md bg-mustard-soft px-1 text-center font-mono text-meta tabular-nums text-mustard-ink">
                {parseHHMM(s.time) || '—'}
              </span>
              <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-ink">{s.title}</span>
              {hasEmoji && <StickerGraphic id={day.sticker} className="shrink-0 text-sm leading-none" />}
            </li>
          ))}
          {orderedStops.length === 0 && (
            <li data-testid="day-itinerary-empty" className="space-y-1.5 py-3 text-center">
              <DoodleSticker name="torii" secondary="fuji" blob="mustard" size="xl" />
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

      <div className="relative rounded-2xl border border-line bg-cream px-3 py-2">
        <span className="mb-1 block whitespace-nowrap font-hand text-meta text-ink-muted">
          {t('notebook.day.journalTitle')}
        </span>
        <p className="truncate whitespace-nowrap text-sm text-ink-soft">
          {day.journal || t('notebook.dayView.noJournal')}
        </p>
      </div>

      {inTrip ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="day-scan"
            onClick={onScan}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-2xl bg-teal-strong px-3 py-3 text-base font-bold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {t('notebook.day.scanReceipt')}
          </button>
          <button
            type="button"
            data-testid="itinerary-add"
            onClick={onAdd}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-white px-3 py-3 text-base font-bold text-ink shadow-sm transition-colors hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {t('notebook.day.addEntry')}
          </button>
        </div>
      ) : (
        <div
          data-testid="outside-trip-banner"
          className="flex min-w-0 items-center justify-between gap-2 rounded-2xl border border-dashed border-line bg-cream px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-ink-muted">
            {t('notebook.day.outsideTripBanner')}
          </span>
          <button
            type="button"
            data-testid="back-to-trip"
            onClick={onReturnToTrip}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-3.5 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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
    'h-11 min-h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal';

  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div
      data-testid="itinerary-editor"
      className="relative space-y-2.5 rounded-card border border-line bg-cream-soft p-3 shadow-sm"
    >
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="ref-title" className="whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.day.titleLabel')}
          </label>
          <button
            type="button"
            data-testid="itinerary-done"
            onClick={onDone}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-4 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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
          <span className="whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.day.stickerLabel')}
          </span>
          <button
            type="button"
            onClick={() => onChange({ sticker: null })}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill border border-line bg-beige px-3 py-2 text-meta font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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
              className={`flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border-2 bg-cream text-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                day.sticker === s.id ? 'border-teal-strong ring-2 ring-teal-strong' : 'border-white shadow-sm'
              }`}
            >
              <StickerGraphic id={s.id} className="text-lg leading-none" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="ref-note" className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
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
                className="h-11 min-h-11 w-36 shrink-0 rounded-pill border border-teal-strong bg-white px-2 font-mono text-meta tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-teal"
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
                className="inline-flex h-11 min-h-11 min-w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-teal-soft px-2.5 font-mono text-meta tabular-nums text-teal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {parseHHMM(s.time) || '—'}
              </button>
            )}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-ink">{s.title}</span>
            <button
              type="button"
              aria-label={t('notebook.day.deleteStopAria', { title: s.title })}
              onClick={() => onChange({ itinerary: day.itinerary.filter((x) => x.id !== s.id) })}
              className="btn-icon-danger h-11 w-11 min-h-11 min-w-11 shrink-0"
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
            className={`${field} !w-36 shrink-0 !px-2 font-mono tabular-nums`}
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
            className="h-11 min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-2xl border border-line bg-cream-soft px-3 text-sm font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-50"
          >
            {t('notebook.day.addStopBtn')}
          </button>
        </div>
        {timeError && (
          <p role="alert" data-testid="time-error" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
            {t('notebook.day.timeFormatError')}
          </p>
        )}
      </form>

      <div>
        <label htmlFor="ref-journal" className="mb-1 block whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
          {t('notebook.day.journalTitle')}
        </label>
        <textarea
          id="ref-journal"
          rows={3}
          className="w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
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
      <div className="rounded-2xl border border-line bg-cream-soft px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-hand text-meta font-medium text-ink-muted">
            {t('notebook.day.dayTotal')}
          </span>
          <span className="whitespace-nowrap rounded-pill bg-teal-soft px-2.5 py-0.5 text-meta font-semibold text-teal-strong">
            {t('notebook.day.scannedManualSummary', {
              scanned: stats.scanned,
              manual: stats.manual,
            })}
          </span>
          {inTrip && (
            <button
              type="button"
              data-testid="day-add"
              aria-label={t('notebook.day.addDayExpenseAria')}
              onClick={() => onAdd(iso)}
              className="ml-auto flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full bg-teal-strong text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {Icon.plus('h-4 w-4')}
            </button>
          )}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-xl font-bold text-ink">{fmtHKD(stats.total)}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className="shrink-0 whitespace-nowrap font-hand text-sm font-medium text-ink-muted">
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
              className="space-y-2 rounded-card border border-dashed border-line px-4 py-5 text-center shadow-sm"
              style={cardDots}
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
            <div className="space-y-2.5 rounded-2xl border border-dashed border-line bg-cream-soft p-4 text-center">
              <DoodleSticker name="suitcase" blob="sand" size="lg" />
              <p className="whitespace-nowrap text-sm text-ink-muted">
                {t('notebook.dayView.outsideNoExpenses')}
              </p>
              <button
                type="button"
                onClick={onReturnToTrip}
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-4 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {t('notebook.day.backToTrip')}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
