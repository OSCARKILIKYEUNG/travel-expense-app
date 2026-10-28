import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { capCellNote, dayCounter } from '../shared/display';
import { STICKERS, monthGridSunday } from './mockRefTrip';
import {
  HandRing,
  Icon,
  RoundStamp,
  Sakura,
  Sparkle,
  StickerGraphic,
  Tape,
  airmail,
  cardDots,
  mustardStripe,
  ruledPaper,
} from './parts';
import { dayStats, fmtHKD, fmtJPY, shortenTitle } from './refLogic';
import { expenseDateKey } from '../../utils/date';

const hasSticker = (id) => STICKERS.some((s) => s.id === id);
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

export default function Home({
  trip,
  today,
  month,
  setMonth,
  selectedDay = null,
  onOpenDay,
  onScan,
  onAdd,
}) {
  const { t } = useTranslation();
  const [showJpy, setShowJpy] = useState(false);
  const total = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0);
  const jpy = trip.expenses.filter((e) => e.currency === 'JPY').reduce((s, e) => s + e.originalAmount, 0);
  const counter = dayCounter(trip, today, { t });
  const todaySpend = dayStats(trip.expenses, today).total;
  const todayDay = trip.days[today];
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    counter.phase === 'during'
      ? { top: `DAY ${pad(counter.n)}`, bottom: `${counter.total} DAYS` }
      : counter.phase === 'before'
        ? { top: t('notebook.home.stampBefore'), bottom: `${counter.total} DAYS` }
        : { top: t('notebook.home.stampAfter'), bottom: `${counter.total} DAYS` };
  const [, sm, sd] = trip.startDate.split('-').map(Number);
  const [, em, ed] = trip.endDate.split('-').map(Number);

  return (
    <div data-testid="home" className="space-y-4 px-4 pb-6 pt-5">
      {/* Airmail summary postcard */}
      <section data-testid="summary" className="relative rounded-card p-[5px] shadow-sm" style={airmail}>
        <Tape tone="coral" className="-top-2.5 left-1/2 z-20 h-5 w-28 -translate-x-1/2 -rotate-2" />
        <div className="relative overflow-hidden rounded-[20px] border border-line bg-cream-soft">
          <div className="relative p-4">
            <Sparkle className="absolute right-24 top-3 h-3.5 w-3.5 opacity-75" />
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="whitespace-nowrap text-meta font-medium tracking-[0.06em] text-ink-muted">
                  {trip.name} · {sm}/{sd}–{em}/{ed}
                </p>
                <h2
                  data-testid="trip-total"
                  className="whitespace-nowrap font-display text-[26px] leading-[1.1] text-ink"
                >
                  {fmtHKD(total)}
                </h2>
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowJpy((v) => !v)}
                    aria-expanded={showJpy}
                    className="inline-flex min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-beige/85 px-3 py-2 text-meta font-semibold text-ink-soft transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <span>
                      {fmtJPY(jpy)} · {t('notebook.home.recordsCount', { count: trip.expenses.length })}
                    </span>
                    <span className={`shrink-0 transition-transform ${showJpy ? 'rotate-180' : ''}`}>
                      {Icon.chevDown('h-3.5 w-3.5')}
                    </span>
                  </button>
                </div>
                <div
                  data-testid="today-line"
                  className="whitespace-nowrap pt-0.5 text-meta font-medium text-ink-soft"
                >
                  {counter.label}
                  {counter.phase === 'during'
                    ? ` · ${t('notebook.home.todaySpend', { amount: fmtHKD(todaySpend) })}`
                    : ''}
                </div>
              </div>
              <RoundStamp top={stamp.top} bottom={stamp.bottom} className="mt-0.5" />
            </div>

            {showJpy && (
              <div className="mt-2.5 flex items-center justify-between border-t border-dashed border-line pt-2 text-meta">
                <span className="whitespace-nowrap font-medium text-ink-muted">
                  {t('notebook.home.jpyOriginalTotal')}
                </span>
                <span className="whitespace-nowrap font-mono font-semibold text-ink">{fmtJPY(jpy)}</span>
              </div>
            )}
          </div>

          {counter.phase === 'during' && (
            <div className="border-t border-line bg-cream/70" style={ruledPaper}>
              <button
                type="button"
                data-testid="today-row"
                onClick={() => onOpenDay(today)}
                className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-beige/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
              >
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="shrink-0 text-coral-ink">{Icon.pin('h-[15px] w-[15px]')}</span>
                  <span className="shrink-0 whitespace-nowrap rounded-md border border-coral-ink/25 bg-coral-soft px-2 py-0.5 text-meta font-bold text-coral-ink">
                    {t('notebook.home.todayJournal')}
                  </span>
                  <span className="min-w-0 truncate whitespace-nowrap font-display text-xs text-ink">
                    Day {counter.n} · {shortenTitle(todayDay?.title || '', 8)}
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-meta font-semibold text-teal-strong">›</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Quick scan / manual add ribbon */}
      <div
        className="relative flex min-h-[56px] items-center justify-between gap-2 overflow-hidden rounded-2xl border border-mustard-ink/30 bg-mustard-soft px-2.5 py-1.5 shadow-sm"
        style={mustardStripe}
      >
        <button
          type="button"
          data-testid="home-scan"
          onClick={onScan}
          className="inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {Icon.camera('h-[15px] w-[15px] shrink-0')}
          <span>{t('notebook.home.scanReceipt')}</span>
        </button>
        <button
          type="button"
          data-testid="home-add"
          onClick={onAdd}
          className="inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-white px-3 text-meta font-bold text-ink shadow-sm transition-colors hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="text-teal-strong">{Icon.plus('h-[15px] w-[15px] shrink-0')}</span>
          <span>{t('notebook.home.addEntry')}</span>
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
  const spent = new Set(trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date)));
  const tripStartMonth = trip.startDate.slice(0, 7);
  const hasTripInMonth = weeks.some((w) => w.some((c) => c.inMonth && inTrip(c.iso)));
  const monthEn = MONTH_EN[m - 1];
  const monthTitle = t('notebook.home.monthTitle', { year: y, month: m, monthEn });
  const showMonthEnGloss = Boolean(monthEn) && !monthTitle.includes(monthEn);

  return (
    <div data-testid="calendar" className="relative rounded-card border border-line p-3 shadow-sm" style={cardDots}>
      <Tape tone="teal" className="-top-2 right-8 h-4 w-20 rotate-1 opacity-85" />
      <Sakura className="absolute -bottom-2 -right-2 h-8 w-8 opacity-60" />

      <div className="mb-2.5 flex min-w-0 items-center justify-between gap-1.5">
        <button
          type="button"
          aria-label={t('notebook.home.prevMonthAria')}
          onClick={() => shift(-1)}
          className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-cream-soft text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <h3 className="whitespace-nowrap font-display text-base text-ink">
            {monthTitle}
            {showMonthEnGloss && (
              <span className="font-script text-teal-strong"> · {monthEn}</span>
            )}
          </h3>
          {!hasTripInMonth && month !== tripStartMonth && (
            <button
              type="button"
              onClick={() => setMonth(tripStartMonth)}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-3 py-1.5 text-meta font-bold text-teal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {t('notebook.home.backToTripMonth')}
            </button>
          )}
        </div>
        <button
          type="button"
          aria-label={t('notebook.home.nextMonthAria')}
          onClick={() => shift(1)}
          className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-cream-soft text-base font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          ›
        </button>
      </div>

      <div className="-mx-2 mb-1 grid grid-cols-7 border-b border-line/70 pb-1 text-center text-meta font-bold">
        {WEEKDAY_KEYS.map((wKey, i) => (
          <div key={wKey} className={i === 0 ? 'text-coral-ink' : i === 6 ? 'text-teal-strong' : 'text-ink-muted'}>
            {t(wKey)}
          </div>
        ))}
      </div>

      <div className="-mx-2 space-y-1">
        {weeks.map((week) => (
          <div key={week[0].iso} className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
            {week.map((c, i) => {
              const day = trip.days[c.iso];
              const isTripDay = inTrip(c.iso);
              const startSeg = isTripDay && (i === 0 || c.iso === trip.startDate || !inTrip(week[i - 1].iso));
              const endSeg = isTripDay && (i === 6 || c.iso === trip.endDate || !inTrip(week[i + 1].iso));
              const isToday = c.iso === today;
              const isSelected = Boolean(selectedDay && c.iso === selectedDay);
              const note = day?.note ? capCellNote(day.note) : '';
              const stickerId = day?.sticker && hasSticker(day.sticker) ? day.sticker : '';
              const cellMonth = Number(c.iso.slice(5, 7));
              const n = Number(c.iso.slice(8));
              const cellDateLabel = t('notebook.home.dayCellDate', {
                month: cellMonth,
                day: n,
                monthEn: MONTH_EN[cellMonth - 1],
              });
              const dayTone = isToday
                ? 'font-extrabold text-mustard-ink'
                : isTripDay
                  ? 'font-bold text-ink'
                  : c.inMonth
                    ? 'font-bold text-ink-muted opacity-75'
                    : 'font-bold text-ink-muted opacity-45';

              return (
                <button
                  key={c.iso}
                  type="button"
                  data-testid={`day-cell-${c.iso}`}
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={() => onOpenDay(c.iso)}
                  aria-label={`${cellDateLabel}${day?.title ? ` ${day.title}` : ''}`}
                  className={`relative flex h-12 min-w-0 flex-col items-stretch justify-between pb-1.5 pt-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                    isSelected ? 'rounded-xl ring-2 ring-teal-strong/70' : ''
                  }`}
                >
                  {isTripDay && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-0 inset-y-0.5 border-y border-teal/35 bg-teal-soft/80 ${
                        startSeg ? 'ml-0.5 rounded-l-xl border-l' : ''
                      } ${endSeg ? 'mr-0.5 rounded-r-xl border-r' : ''}`}
                    />
                  )}
                  {isToday && <HandRing className="z-20" />}
                  <span className={`relative z-10 pl-1.5 text-meta leading-none ${dayTone}`}>{n}</span>
                  {note ? (
                    <span
                      data-cell-note
                      className="relative z-10 block w-full whitespace-nowrap text-center text-meta leading-tight tracking-[-0.02em] text-ink-soft"
                    >
                      {note}
                    </span>
                  ) : stickerId ? (
                    <span className="relative z-10 flex items-center justify-center">
                      <StickerGraphic id={stickerId} className="text-sm leading-none" />
                    </span>
                  ) : (
                    <span className="block h-3" aria-hidden="true" />
                  )}
                  {spent.has(c.iso) && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0.5 left-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-coral"
                    />
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
