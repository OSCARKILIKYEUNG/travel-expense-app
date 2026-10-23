import { useEffect, useMemo, useRef, useState } from 'react';
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS, REF_PEOPLE } from './mockRefTrip';
import { Icon, Sparkle, Tape, cardDots, mustardStripe } from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import { dayStats, dayStrip, expensesOn, fmtHKD, matchesPerson, personCounts } from './refLogic';

const PANES = ['itinerary', 'expenses']; // Oscar 08:51: two panes, 行程手札 first
const WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const stickerEmoji = (id) => STICKERS.find((s) => s.id === id)?.emoji || '';

function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function usePager(index, setIndex) {
  const track = useRef(null);
  const g = useRef(null);
  const dxRef = useRef(0);
  const [drag, setDrag] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const handlers = {
    onPointerDown: (e) => {
      // Interrogate F3: ignore form fields, chip/sticker rows, scrollers, menus, dialogs, and a 24px edge dead zone (OS back gesture).
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

export default function DayView({ trip, iso, pane, editing, today, onPane, onEditToggle, onBack, onDay, onUpdateDay, onAdd, onEditExpense, onDeleteExpense }) {
  const index = Math.max(0, PANES.indexOf(pane));
  const setIndex = (i) => onPane(PANES[i]);
  const { track, handlers, style } = usePager(index, setIndex);
  const day = trip.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] };
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEK[new Date(y, m - 1, d).getDay()];
  const inTrip = iso >= trip.startDate && iso <= trip.endDate;
  const dayN = inTrip ? dayCounter(trip, iso).n : null;
  const stats = dayStats(trip.expenses, iso);
  const strip = dayStrip({ n: dayN, title: day.title, hkd: stats.total });
  const hints = ['左滑看消費', '右滑回行程'];

  useEffect(() => { window.scrollTo(0, 0); }, [iso]);

  return (
    <div data-testid="day-view" className="px-4 pt-3">
      {/* Top bar */}
      <div className="relative rounded-card p-[5px] shadow-sm" style={mustardStripe}>
        <Tape tone="coral" className="-top-2 right-16 rotate-3" />
        <Sparkle className="absolute -left-1 -top-1 h-4 w-4" />
        <div className="flex items-center gap-1.5 rounded-[14px] bg-cream-soft/70 px-1.5 py-1.5">
          <button type="button" data-testid="back" onClick={onBack} className="flex items-center gap-1 whitespace-nowrap rounded-control border border-line bg-cream-soft px-2.5 py-2 text-[14px] font-bold text-ink shadow-sm">
            {Icon.chevL('h-4 w-4')}月曆
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <span className="whitespace-nowrap text-[15px] font-bold text-ink">{m}月{d}日 {weekday}</span>
            {dayN && <span className="whitespace-nowrap rounded-control border-[1.5px] border-dashed border-coral-ink bg-coral-soft px-1.5 font-script text-[15px] leading-6 text-coral-ink">Day {dayN}</span>}
          </div>
          <button type="button" aria-label="前一日" onClick={() => onDay(addDaysIso(iso, -1))} className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-cream-soft text-ink shadow-sm">{Icon.chevL()}</button>
          <button type="button" aria-label="後一日" onClick={() => onDay(addDaysIso(iso, 1))} className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-cream-soft text-ink shadow-sm">{Icon.chevR()}</button>
        </div>
      </div>

      {/* Two-segment control */}
      <div className="mt-3 flex rounded-card border border-line bg-beige/70 p-1" role="tablist">
        {[['itinerary', '行程手札', day.itinerary.length], ['expenses', '當日消費', stats.count]].map(([id, label, n], i) => (
          <button key={id} type="button" role="tab" aria-selected={index === i} data-testid={`tab-${id}`} onClick={() => setIndex(i)}
            className={`flex-1 whitespace-nowrap rounded-[14px] py-2.5 text-[15px] font-bold ${index === i ? 'border border-sage bg-cream-soft text-teal-strong shadow-sm' : 'text-ink-soft'}`}>
            {label} {n}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
        {PANES.map((p, i) => <span key={p} className={`h-2 rounded-full ${index === i ? 'w-5 bg-teal-strong' : 'w-2 bg-line'}`} />)}
        <span className="ml-1 whitespace-nowrap text-meta text-ink-muted">{hints[index]}</span>
      </div>

      {/* Pager */}
      <div className="-mx-4 mt-2 overflow-hidden">
        <div ref={track} className="flex touch-pan-y" style={style} {...handlers}>
          <section data-testid="pane-itinerary" ref={(el) => el && el.toggleAttribute('inert', index !== 0)} aria-hidden={index !== 0} className="w-full shrink-0 touch-pan-y px-4 pb-6">
            <DayStrip text={strip} />
            {editing
              ? <ItineraryEditor day={day} onChange={(patch) => onUpdateDay(iso, patch)} onDone={() => onEditToggle(false)} />
              : <ItineraryRead day={day} onEdit={() => onEditToggle(true)} />}
          </section>
          <section data-testid="pane-expenses" ref={(el) => el && el.toggleAttribute('inert', index !== 1)} aria-hidden={index !== 1} className="w-full shrink-0 touch-pan-y px-4 pb-6">
            <DayStrip text={strip} />
            <DayExpenses trip={trip} iso={iso} stats={stats} onAdd={onAdd} onEdit={onEditExpense} onDelete={onDeleteExpense} />
          </section>
        </div>
      </div>
    </div>
  );
}

function DayStrip({ text }) {
  return (
    <div data-testid="day-strip" className="mb-2.5 whitespace-nowrap rounded-control border border-dashed border-line bg-cream-soft/80 px-3 py-1.5 text-center text-[13px] font-bold text-ink-soft">
      {text}
    </div>
  );
}

function ItineraryRead({ day, onEdit }) {
  return (
    <div className="relative rounded-card border border-line p-4 shadow-sm" style={cardDots}>
      <Sparkle className="absolute right-3 top-3 h-4 w-4" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-meta text-ink-muted">當日標題</div>
          <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap font-display text-[21px] text-ink">
            {day.sticker && <span className="text-[20px]">{stickerEmoji(day.sticker)}</span>}
            {day.title || '未有標題'}
          </div>
          {day.note && <div className="mt-1 whitespace-nowrap text-meta text-ink-muted">月曆小字：{day.note}</div>}
        </div>
        <button type="button" data-testid="itinerary-edit" onClick={onEdit} className="mt-4 shrink-0 whitespace-nowrap rounded-pill border border-sage bg-teal-soft px-3 py-1.5 text-[14px] font-bold text-teal-strong">✎編輯</button>
      </div>
      <div className="mt-4 text-meta font-bold text-ink-soft">當日行程 · {day.itinerary.length} 站</div>
      <ol className="mt-1.5 space-y-1">
        {day.itinerary.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 rounded-control px-1 py-1.5">
            <span className="w-14 shrink-0 whitespace-nowrap rounded-control bg-mustard-soft py-0.5 text-center font-mono text-[13px] font-bold text-mustard-ink">{s.time || '—'}</span>
            <span className="whitespace-nowrap text-[15px] text-ink">{s.title}</span>
          </li>
        ))}
        {day.itinerary.length === 0 && <li className="text-[14px] text-ink-muted">未有行程，按 ✎編輯 加入。</li>}
      </ol>
      <div className="mt-4 rounded-control border border-line bg-cream-soft px-3 py-2.5">
        <div className="text-meta text-ink-muted">當日隨筆</div>
        <p className="mt-0.5 text-[15px] text-ink">{day.journal || '—'}</p>
      </div>
    </div>
  );
}

function ItineraryEditor({ day, onChange, onDone }) {
  const [time, setTime] = useState('09:30');
  const [what, setWhat] = useState('');
  const add = () => {
    if (!what.trim()) return;
    const next = [...day.itinerary, { id: `s${Date.now()}`, time, title: what.trim(), done: false }]
      .sort((a, b) => (a.time || '99') .localeCompare(b.time || '99'));
    onChange({ itinerary: next });
    setWhat('');
  };
  const input = 'w-full rounded-control border border-line bg-cream-soft px-3 py-2.5 text-[16px] text-ink outline-none focus:border-teal';
  return (
    <div data-testid="itinerary-editor" className="relative rounded-card border border-line p-4 shadow-sm" style={cardDots}>
      <div className="flex items-center justify-between">
        <label htmlFor="ref-title" className="text-[14px] text-ink-soft">當日標題</label>
        <button type="button" data-testid="itinerary-done" onClick={onDone} className="whitespace-nowrap rounded-pill bg-teal-strong px-3 py-1.5 text-[14px] font-bold text-white">完成</button>
      </div>
      <input id="ref-title" className={`${input} mt-1.5`} value={day.title} onChange={(e) => onChange({ title: e.target.value })} />

      <div className="mt-4 flex items-center justify-between">
        <span className="whitespace-nowrap text-[14px] text-ink-soft">貼紙 · 顯示在月曆格</span>
        <button type="button" onClick={() => onChange({ sticker: null })} className="whitespace-nowrap rounded-pill bg-beige px-2.5 py-1 text-meta font-bold text-ink-soft">清除</button>
      </div>
      {/* Approved refinement 3: the row scrolls; trailing padding keeps the last sticker whole. */}
      <div data-noswipe className="-mx-4 mt-2 flex gap-2.5 overflow-x-auto px-4 pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="貼紙">
        {STICKERS.map((s) => (
          <button key={s.id} type="button" role="radio" aria-checked={day.sticker === s.id} aria-label={s.label} onClick={() => onChange({ sticker: s.id })}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-beige text-[24px] ${day.sticker === s.id ? 'ring-[3px] ring-teal-strong ring-offset-2 ring-offset-cream-soft' : ''}`}>
            {s.emoji}
          </button>
        ))}
      </div>

      <label htmlFor="ref-note" className="mt-4 block whitespace-nowrap text-[14px] text-ink-soft">月曆小字（最多 4 字）</label>
      <input id="ref-note" className={`${input} mt-1.5 !w-32`} value={day.note} onChange={(e) => onChange({ note: capCellNote(e.target.value) })} />

      <div className="mt-4 text-[14px] text-ink-soft">時間行程</div>
      <ul className="mt-1 space-y-1">
        {day.itinerary.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 py-1.5">
            <span className="w-14 shrink-0 whitespace-nowrap rounded-control bg-teal-soft py-1 text-center text-[13px] font-bold text-teal-strong">{s.time || '—'}</span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-[15px] text-ink">{s.title}</span>
            <button type="button" aria-label={`刪除 ${s.title}`} onClick={() => onChange({ itinerary: day.itinerary.filter((x) => x.id !== s.id) })} className="flex h-8 w-8 items-center justify-center text-coral-ink">{Icon.x()}</button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-1.5">
        <input aria-label="時間" type="time" className={`${input} w-[88px] px-2`} value={time} onChange={(e) => setTime(e.target.value)} />
        <input aria-label="地點或活動" placeholder="地點／活動" className={`${input} min-w-0 flex-1`} value={what} onChange={(e) => setWhat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button type="button" onClick={add} className="shrink-0 whitespace-nowrap rounded-control border border-line bg-cream px-2.5 py-2.5 text-[14px] font-bold text-ink-soft">＋加入</button>
      </div>

      <label htmlFor="ref-journal" className="mt-4 block text-[14px] text-ink-soft">當日隨筆</label>
      <textarea id="ref-journal" rows={2} className={`${input} mt-1.5 resize-none`} value={day.journal} onChange={(e) => onChange({ journal: e.target.value })} />
    </div>
  );
}

function DayExpenses({ trip, iso, stats, onAdd, onEdit, onDelete }) {
  const [person, setPerson] = useState('全部');
  const list = useMemo(() => expensesOn(trip.expenses, iso), [trip.expenses, iso]);
  const counts = personCounts(list, REF_PEOPLE);
  const shown = list.filter((e) => matchesPerson(e, person, REF_PEOPLE));
  return (
    <div>
      <div className="rounded-card border border-line bg-mustard-soft/70 px-3.5 py-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[14px] text-ink-soft">當日合計</span>
          <span className="whitespace-nowrap rounded-pill bg-teal-soft px-2 py-0.5 text-meta font-bold text-teal-strong">掃描 {stats.scanned} · 手動 {stats.manual}</span>
          <button type="button" data-testid="day-add" aria-label="新增這日的消費" onClick={() => onAdd(iso)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-teal-strong text-white shadow-sm">{Icon.plus('h-5 w-5')}</button>
        </div>
        <div className="mt-0.5 whitespace-nowrap text-[24px] font-bold text-ink">{fmtHKD(stats.total)}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-[14px] text-ink-soft">篩選</span>
        <div className="min-w-0 flex-1">
          <ChipRow label="篩選人物">
            {['全部', ...REF_PEOPLE].map((p) => (
              <Chip key={p} active={person === p} onClick={() => setPerson(p)}>{p} {counts[p] || 0}</Chip>
            ))}
          </ChipRow>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {shown.map((e) => <ExpenseCard key={e.id} expense={e} onEdit={onEdit} onDelete={onDelete} />)}
        {shown.length === 0 && <p className="py-6 text-center text-[14px] text-ink-muted">這日未有消費，按 ＋ 記一筆。</p>}
      </div>
    </div>
  );
}
