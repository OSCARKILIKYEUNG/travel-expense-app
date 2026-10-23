import { useEffect, useMemo, useRef, useState } from 'react';
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS } from './mockRefTrip';
import { DayStamp, Icon, Sakura, Sparkle, StickerGraphic, Tape, bannerStripe, cardDots } from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import { dayStats, dayStrip, expensesOn, fmtHKD, matchesPerson, personCounts } from './refLogic';
import { dayNav, isTimeEntryInvalid, parseHHMM, sortStops } from './refRules';

const PANES = ['itinerary', 'expenses'];
const WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hasSticker = (id) => STICKERS.some((s) => s.id === id);

function usePager(index, setIndex) {
  const track = useRef(null);
  const g = useRef(null);
  const dxRef = useRef(0);
  const [drag, setDrag] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const handlers = {
    onPointerDown: (e) => {
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

export default function DayView({
  trip,
  iso,
  pane,
  editing,
  highlightId,
  onPane,
  onEditToggle,
  onBack,
  onDay,
  onUpdateDay,
  onScan,
  onAdd,
  onEditExpense,
  onDeleteExpense,
}) {
  const index = Math.max(0, PANES.indexOf(pane));
  const setIndex = (i) => onPane(PANES[i]);
  const { track, handlers, style } = usePager(index, setIndex);
  const day = trip.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] };
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEK[new Date(y, m - 1, d).getDay()];
  const nav = dayNav(trip, iso);
  const { inTrip } = nav;
  const nearestTripDay = nav.next || nav.prev || trip.startDate;
  const dayN = inTrip ? dayCounter(trip, iso).n : null;
  const stats = dayStats(trip.expenses, iso);
  const strip = dayStrip({ n: dayN, title: day.title, hkd: stats.total });
  const hints = ['左滑看消費', '右滑回行程'];

  useEffect(() => {
    if (!highlightId) window.scrollTo(0, 0);
  }, [iso, highlightId]);

  return (
    <div data-testid="day-view" className="space-y-2.5 px-4 pt-4">
      {/* Top date navigator banner */}
      <header
        className="relative flex min-w-0 items-center gap-1.5 rounded-2xl border border-mustard-ink/35 bg-mustard-soft px-2 py-1.5 shadow-sm"
        style={bannerStripe}
      >
        <Tape tone="sakura" className="-top-2 right-14 z-30 h-4 w-16 rotate-2 opacity-90" />
        <Sparkle className="absolute left-12 top-0.5 z-10 h-3 w-3 opacity-80" />
        <button
          type="button"
          data-testid="back"
          onClick={onBack}
          className="h-11 min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-xl border border-line bg-cream-soft px-3 text-meta font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          ← 月曆
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1">
          <h1 className="whitespace-nowrap font-display text-sm text-ink">
            {m}月{d}日 {weekday}
          </h1>
          <span
            className={`shrink-0 whitespace-nowrap rounded-lg border-2 border-dashed px-1.5 py-0.5 text-meta font-semibold ${
              dayN
                ? 'border-coral-ink bg-coral-soft font-script text-coral-ink'
                : 'border-ink-muted bg-cream-soft text-ink-muted'
            }`}
          >
            {dayN ? `Day ${dayN}` : '旅程外'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="前一日"
            disabled={!nav.prev}
            aria-disabled={!nav.prev}
            onClick={() => nav.prev && onDay(nav.prev)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-cream-soft text-base text-ink transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="後一日"
            disabled={!nav.next}
            aria-disabled={!nav.next}
            onClick={() => nav.next && onDay(nav.next)}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl border border-line bg-cream-soft text-base text-ink transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </header>

      {/* Two-segment control */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-beige/80 p-1" role="tablist">
          {[
            ['itinerary', '行程手札', day.itinerary.length],
            ['expenses', '當日消費', stats.count],
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
              {label} {n}
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

      {/* Pager */}
      <div className="-mx-4 overflow-hidden">
        <div ref={track} className="flex touch-pan-y" style={style} {...handlers}>
          <section
            data-testid="pane-itinerary"
            ref={(el) => el && el.toggleAttribute('inert', index !== 0)}
            aria-hidden={index !== 0}
            className="w-full shrink-0 touch-pan-y px-4 pb-6"
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
                onScan={() => onScan?.(iso)}
                onAdd={() => onAdd?.(iso)}
              />
            )}
          </section>
          <section
            data-testid="pane-expenses"
            ref={(el) => el && el.toggleAttribute('inert', index !== 1)}
            aria-hidden={index !== 1}
            className="w-full shrink-0 touch-pan-y px-4 pb-6"
          >
            <DayStrip text={strip} nav={nav} onDay={onDay} />
            <DayExpenses
              trip={trip}
              iso={iso}
              inTrip={inTrip}
              stats={stats}
              highlightId={highlightId}
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
  const stampTop = dayN ? `Day ${dayN}` : `${m}/${d}`;
  const stampBottom = `${MONTH_EN[m - 1]} ${d}`;
  const hasEmoji = day.sticker && hasSticker(day.sticker);
  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div
      className="relative space-y-3 overflow-hidden rounded-card border border-line bg-cream-soft p-3"
      style={cardDots}
    >
      <Sakura className="absolute right-1 top-1 h-7 w-7 opacity-70" />

      <div className="flex items-center gap-3">
        <DayStamp top={stampTop} bottom={stampBottom} />
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-meta text-ink-muted">
            今日主行程{day.note ? ` · ${day.note}` : ''}
          </p>
          <h2 className="truncate whitespace-nowrap font-display text-xl text-ink">{day.title || '未有標題'}</h2>
        </div>
        <button
          type="button"
          data-testid="itinerary-edit"
          onClick={onEdit}
          className="mt-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-3.5 py-2 text-meta font-bold text-teal-strong shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          ✎編輯
        </button>
      </div>

      <div className="relative rounded-2xl border border-line bg-cream px-3 py-2">
        <Tape tone="teal" className="-top-2.5 right-4 z-10 h-4 w-14 rotate-2" />
        <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
          <span className="whitespace-nowrap text-meta text-ink-muted">今日行程 · {orderedStops.length} 站</span>
          {day.note && (
            <span className="whitespace-nowrap text-meta font-medium text-teal-strong">月曆小字：{day.note}</span>
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
            <li className="whitespace-nowrap text-sm text-ink-muted">未有行程，按 ✎編輯 加入。</li>
          )}
        </ul>
      </div>

      <div className="rounded-2xl border border-line bg-cream px-3 py-2">
        <span className="mb-1 block whitespace-nowrap text-meta text-ink-muted">今日隨筆</span>
        <p className="truncate whitespace-nowrap text-sm text-ink-soft">{day.journal || '未有隨筆'}</p>
      </div>

      {inTrip ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="day-scan"
            onClick={onScan}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-2xl bg-teal-strong px-3 py-3 text-base font-bold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            掃描收據
          </button>
          <button
            type="button"
            data-testid="itinerary-add"
            onClick={onAdd}
            className="inline-flex min-h-11 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-white px-3 py-3 text-base font-bold text-ink shadow-sm transition-colors hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            記一筆
          </button>
        </div>
      ) : (
        <div
          data-testid="outside-trip-banner"
          className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-line bg-cream px-3 py-2.5"
        >
          <span className="whitespace-nowrap text-sm font-semibold text-ink-muted">旅程外 · 此日不計入旅程消費</span>
          <button
            type="button"
            data-testid="back-to-trip"
            onClick={onReturnToTrip}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-3.5 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            回到旅程
          </button>
        </div>
      )}
    </div>
  );
}

function ItineraryEditor({ day, onChange, onDone }) {
  const [time, setTime] = useState('');
  const [badTimeInput, setBadTimeInput] = useState(false);
  const [timeError, setTimeError] = useState('');
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
      setTimeError('');
    } else if (showError) {
      setTimeError('請輸入 HH:MM 時間');
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
      setTimeError('請輸入 HH:MM 時間');
      return;
    }
    if (!what.trim()) return;
    const rawTime = String(currentVal ?? '').trim();
    const cleanTime = rawTime ? parseHHMM(rawTime) : '';
    if (rawTime && !cleanTime) {
      setTimeError('請輸入 HH:MM 時間');
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
    setTimeError('');
    setWhat('');
  };

  const commitStopTime = (stopId, rawVal, inputEl = editStopInputRef.current) => {
    const bad = Boolean(inputEl?.validity?.badInput);
    if (isTimeEntryInvalid({ value: rawVal, badInput: bad })) {
      setTimeError('請輸入 HH:MM 時間');
      return;
    }
    const trimmed = String(rawVal ?? '').trim();
    if (!trimmed) {
      const next = sortStops(day.itinerary.map((s) => (s.id === stopId ? { ...s, time: '' } : s)));
      onChange({ itinerary: next });
      setEditingStopId(null);
      setTimeError('');
      return;
    }
    const valid = parseHHMM(trimmed);
    if (!valid) {
      setTimeError('請輸入 HH:MM 時間');
      return;
    }
    const next = sortStops(day.itinerary.map((s) => (s.id === stopId ? { ...s, time: valid } : s)));
    onChange({ itinerary: next });
    setEditingStopId(null);
    setTimeError('');
  };

  const field =
    'h-11 min-h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal';

  const orderedStops = useMemo(() => sortStops(day.itinerary), [day.itinerary]);

  return (
    <div
      data-testid="itinerary-editor"
      className="relative space-y-2.5 rounded-card border border-line bg-cream-soft p-3 shadow-sm"
    >
      <Sparkle className="absolute right-16 top-3.5 h-3.5 w-3.5 opacity-80" />

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="ref-title" className="whitespace-nowrap text-meta font-medium text-ink-muted">
            今日標題
          </label>
          <button
            type="button"
            data-testid="itinerary-done"
            onClick={onDone}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-4 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            完成
          </button>
        </div>
        <input
          id="ref-title"
          className={field}
          value={day.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="例如：富士山一日遊"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-meta font-medium text-ink-muted">貼紙</span>
          <button
            type="button"
            onClick={() => onChange({ sticker: null })}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill border border-line bg-beige px-3 py-2 text-meta font-semibold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            清除
          </button>
        </div>
        <div
          data-noswipe
          className="-mx-3 flex gap-2 overflow-x-auto px-3 py-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="radiogroup"
          aria-label="貼紙"
        >
          {STICKERS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={day.sticker === s.id}
              aria-label={s.label}
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
        <label htmlFor="ref-note" className="mb-1 block whitespace-nowrap text-meta font-medium text-ink-muted">
          月曆小字
        </label>
        <input
          id="ref-note"
          className={`${field} !w-24`}
          value={day.note}
          onChange={(e) => onChange({ note: capCellNote(e.target.value) })}
          placeholder="富士"
        />
      </div>

      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {orderedStops.map((s) => (
          <li key={s.id} className="flex min-w-0 items-center gap-2">
            {editingStopId === s.id ? (
              <input
                ref={editStopInputRef}
                type="time"
                aria-label={`${s.title} 時間`}
                value={editingStopTime}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setEditingStopTime(nextVal);
                  if (!isTimeEntryInvalid({ value: nextVal, badInput: Boolean(e.target.validity?.badInput) })) {
                    setTimeError('');
                  }
                }}
                onBlur={(e) => commitStopTime(s.id, editingStopTime, e.target)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitStopTime(s.id, editingStopTime, e.target);
                  } else if (e.key === 'Escape') {
                    setEditingStopId(null);
                    setTimeError('');
                  }
                }}
                className="h-11 min-h-11 w-36 shrink-0 rounded-pill border border-teal-strong bg-white px-2 font-mono text-meta tabular-nums text-ink focus:outline-none focus:ring-2 focus:ring-teal"
              />
            ) : (
              <button
                type="button"
                aria-label={`修改時間 ${s.title}`}
                onClick={() => {
                  setEditingStopId(s.id);
                  setEditingStopTime(parseHHMM(s.time) || '');
                  setTimeError('');
                }}
                className="inline-flex h-11 min-h-11 min-w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-teal-soft px-2.5 font-mono text-meta tabular-nums text-teal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {parseHHMM(s.time) || '—'}
              </button>
            )}
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-ink">{s.title}</span>
            <button
              type="button"
              aria-label={`刪除 ${s.title}`}
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
            aria-label="時間"
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
            aria-label="地點或活動"
            placeholder="地點／活動"
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
            ＋加入
          </button>
        </div>
        {timeError && (
          <p role="alert" data-testid="time-error" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
            {timeError}
          </p>
        )}
      </form>

      <div>
        <label htmlFor="ref-journal" className="mb-1 block whitespace-nowrap text-meta font-medium text-ink-muted">
          今日隨筆
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

function DayExpenses({ trip, iso, inTrip, stats, highlightId, onReturnToTrip, onAdd, onEdit, onDelete }) {
  const [person, setPerson] = useState('全部');
  const people = trip.settings?.people || ['共同'];
  const list = useMemo(() => expensesOn(trip.expenses, iso), [trip.expenses, iso]);
  const counts = personCounts(list, people);
  const shown = list.filter((e) => matchesPerson(e, person, people));
  return (
    <div className="space-y-2.5">
      <div className="rounded-2xl border border-line bg-cream-soft px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-meta font-medium text-ink-muted">當日合計</span>
          <span className="whitespace-nowrap rounded-pill bg-teal-soft px-2.5 py-0.5 text-meta font-semibold text-teal-strong">
            掃描 {stats.scanned} · 手動 {stats.manual}
          </span>
          {inTrip && (
            <button
              type="button"
              data-testid="day-add"
              aria-label="新增這日的消費"
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
        <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">篩選:</span>
        <div className="min-w-0 flex-1">
          <ChipRow label="篩選人物">
            {['全部', ...people].map((p) => (
              <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
                {p} ({counts[p] || 0})
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
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {shown.length === 0 &&
          (inTrip ? (
            <p className="py-6 text-center text-sm text-ink-muted">這日未有消費，按 ＋ 記一筆。</p>
          ) : (
            <div className="space-y-2.5 rounded-2xl border border-dashed border-line bg-cream-soft p-4 text-center">
              <p className="whitespace-nowrap text-sm text-ink-muted">旅程外 · 這日未有消費</p>
              <button
                type="button"
                onClick={onReturnToTrip}
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill bg-teal-strong px-4 py-2 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                回到旅程
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
