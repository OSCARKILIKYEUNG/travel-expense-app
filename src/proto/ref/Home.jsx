import { useState } from 'react'; // month state is lifted to index.jsx (interrogate F5)
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS, monthGridSunday } from './mockRefTrip';
import { HandRing, Icon, RoundStamp, Sakura, Sparkle, StickerGraphic, Tape, airmail, cardDots, mustardStripe } from './parts';
import { dayStats, fmtHKD, fmtJPY, shortenTitle } from './refLogic';
import { expenseDateKey } from '../../utils/date';

const hasSticker = (id) => STICKERS.some((s) => s.id === id);
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function Home({ trip, today, month, setMonth, onOpenDay, onScan, onAdd }) {
  const [showJpy, setShowJpy] = useState(false);
  const total = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0);
  const jpy = trip.expenses.filter((e) => e.currency === 'JPY').reduce((s, e) => s + e.originalAmount, 0);
  const counter = dayCounter(trip, today);
  const todaySpend = dayStats(trip.expenses, today).total;
  const todayDay = trip.days[today];
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = counter.phase === 'during'
    ? { top: `DAY ${pad(counter.n)}`, bottom: `${counter.total} DAYS` }
    : counter.phase === 'before' ? { top: '倒數', bottom: `${counter.n} 日` } : { top: '完成', bottom: `${counter.total} DAYS` };
  const [sy, sm, sd] = trip.startDate.split('-').map(Number);
  const [, em, ed] = trip.endDate.split('-').map(Number);

  return (
    <div data-testid="home" className="space-y-3.5 px-4 pt-3">
      {/* Summary card (airmail border) */}
      <div className="relative rounded-card p-[6px] shadow-md" style={airmail} data-testid="summary">
        <Tape tone="coral" className="-top-2.5 left-1/2 -translate-x-1/2 -rotate-2" />
        <Sparkle className="absolute right-2.5 top-2.5 z-10 h-4 w-4" />
        <div className={`relative flex items-center gap-3 px-4 py-3.5 ${counter.phase === 'during' ? 'rounded-t-[18px]' : 'rounded-[18px]'}`} style={cardDots}>
          <div className="min-w-0 flex-1">
            <div className="whitespace-nowrap text-[13px] font-bold text-ink-soft">{trip.name} · {sm}/{sd}–{em}/{ed}</div>
            <div className="mt-0.5 whitespace-nowrap text-[34px] font-bold leading-tight tracking-tight text-ink" data-testid="trip-total">{fmtHKD(total)}</div>
            <button type="button" onClick={() => setShowJpy((v) => !v)} aria-expanded={showJpy} className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-pill border border-sage bg-teal-soft px-2.5 py-0.5 text-meta font-bold text-teal-strong">
              {fmtJPY(jpy)} · {trip.expenses.length} 筆 {Icon.chevDown('h-3.5 w-3.5')}
            </button>
            {showJpy && <div className="mt-1 whitespace-nowrap text-meta text-ink-muted">匯率（示範）1 JPY ≈ 0.0526 HKD</div>}
            <div className="mt-1.5 whitespace-nowrap text-meta font-medium text-ink-soft" data-testid="today-line">
              {counter.label}{counter.phase === 'during' ? ` · 今日 ${fmtHKD(todaySpend)}` : ''}
            </div>
          </div>
          <RoundStamp top={stamp.top} bottom={stamp.bottom} />
        </div>
        {/* 今日手札 row: real today only (naming decision 08:50) */}
        {counter.phase === 'during' && (
          <button type="button" data-testid="today-row" onClick={() => onOpenDay(today)} className="flex w-full items-center gap-2 rounded-b-[18px] border-t border-dashed border-line bg-cream-soft px-3.5 py-2.5 text-left transition-colors active:bg-beige/60">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral-ink">{Icon.pin('h-3.5 w-3.5')}</span>
            <span className="whitespace-nowrap rounded-control border border-coral bg-coral-soft px-2 py-0.5 text-[13px] font-bold text-coral-ink">今日手札</span>
            <span className="min-w-0 flex-1 whitespace-nowrap text-[15px] font-medium text-ink">Day {counter.n} · {shortenTitle(todayDay?.title || '', 8)}</span>
            <span className="text-ink-muted">{Icon.chevR('h-4 w-4')}</span>
          </button>
        )}
      </div>

      {/* Scan / add pair */}
      <div className="rounded-card p-[5px] shadow-sm" style={mustardStripe}>
        <div className="flex gap-2 rounded-[19px] bg-cream-soft/75 p-1.5">
          <button type="button" data-testid="home-scan" onClick={onScan} className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control bg-teal-strong py-3 text-[16px] font-bold text-white shadow-sm">{Icon.camera()}掃描收據</button>
          <button type="button" data-testid="home-add" onClick={onAdd} className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-cream-soft py-3 text-[16px] font-bold text-ink shadow-sm">{Icon.plus()}記一筆</button>
        </div>
      </div>

      <Calendar trip={trip} today={today} month={month} setMonth={setMonth} onOpenDay={onOpenDay} />

      <div className="pb-3 text-center text-meta text-ink-muted">Ref build · gemini-4-argon-high</div>
    </div>
  );
}

function Calendar({ trip, today, month, setMonth, onOpenDay }) {
  const [y, m] = month.split('-').map(Number);
  const weeks = monthGridSunday(`${month}-01`);
  const shift = (n) => {
    const t = new Date(y, m - 1 + n, 1);
    setMonth(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`);
  };
  const inTrip = (iso) => iso >= trip.startDate && iso <= trip.endDate;
  const spent = new Set(trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date)));
  return (
    <div data-testid="calendar" className="relative rounded-card border border-line p-3 shadow-sm" style={cardDots}>
      <Tape tone="sage" className="-top-2.5 right-7 rotate-2" />
      <Sakura className="absolute -bottom-2 -right-1 h-7 w-7" />
      <div className="flex items-center justify-between px-1">
        <button type="button" aria-label="上個月" onClick={() => shift(-1)} className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-cream-soft text-ink-soft shadow-sm">{Icon.chevL()}</button>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="font-display text-[20px] text-ink">{y}年{m}月</span>
          <span className="font-script text-[21px] font-bold text-teal-strong">· {MONTH_EN[m - 1]}</span>
        </div>
        <button type="button" aria-label="下個月" onClick={() => shift(1)} className="flex h-9 w-9 items-center justify-center rounded-control border border-line bg-cream-soft text-ink-soft shadow-sm">{Icon.chevR()}</button>
      </div>
      <div className="-mx-2 mt-2 grid grid-cols-7 border-b border-line pb-1 text-center text-meta font-bold">
        {['日', '一', '二', '三', '四', '五', '六'].map((w, i) => (
          <div key={w} className={i === 0 ? 'text-coral-ink' : i === 6 ? 'text-teal-strong' : 'text-ink-soft'}>{w}</div>
        ))}
      </div>
      <div className="-mx-2 mt-1.5 space-y-1">
        {weeks.map((week) => (
          <div key={week[0].iso} className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
            {week.map((c, i) => {
              const day = trip.days[c.iso];
              const t = inTrip(c.iso);
              const startSeg = t && (i === 0 || !inTrip(week[i - 1].iso));
              const endSeg = t && (i === 6 || !inTrip(week[i + 1].iso));
              const isToday = c.iso === today;
              const note = day?.note ? capCellNote(day.note) : '';
              const stickerId = day?.sticker && hasSticker(day.sticker) ? day.sticker : '';
              const n = Number(c.iso.slice(8));
              return (
                <button key={c.iso} type="button" data-testid={`day-cell-${c.iso}`} onClick={() => onOpenDay(c.iso)}
                  aria-label={`${Number(c.iso.slice(5, 7))}月${n}日${day?.title ? ` ${day.title}` : ''}`}
                  className={`relative flex h-[54px] min-w-0 flex-col items-center justify-start pt-1 ${t ? 'border-y border-sage bg-teal-soft/70' : ''} ${startSeg ? 'rounded-l-control border-l' : ''} ${endSeg ? 'rounded-r-control border-r' : ''}`}>
                  {isToday && <HandRing />}
                  <span className={`relative z-10 text-[15px] font-bold leading-5 ${c.inMonth ? (i === 0 ? 'text-coral-ink' : i === 6 ? 'text-teal-strong' : 'text-ink') : 'text-ink-muted/55'} ${t ? '' : 'font-medium'}`}>{n}</span>
                  {note && <span data-cell-note className="relative z-10 mt-0.5 whitespace-nowrap text-meta leading-4 tracking-[-0.02em] text-ink">{note}</span>}
                  {!note && stickerId && (
                    <span className="relative z-10 mt-0.5 flex h-5 w-5 items-center justify-center" aria-hidden="true">
                      <StickerGraphic id={stickerId} className="h-4 w-4" />
                    </span>
                  )}
                  {spent.has(c.iso) && <span className="absolute bottom-0.5 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-coral" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
