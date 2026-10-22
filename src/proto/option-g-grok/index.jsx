import { useEffect, useMemo, useRef, useState } from 'react';
import { createMockTrip, DEMO_TODAY, MOCK_CATEGORIES, MOCK_PEOPLE } from '../shared/mockTrip';
import { monthGrid, parseISODate } from '../shared/dates';
import { capCellNote, dayCounter, spendOnDate } from '../shared/display';
import { palette } from '../../theme/tokens';

/*
 * Option G · "方格手帳 Grid Notebook".
 * Graph-paper pages, sticky-note day cells, a ticket-stub summary and a
 * pager ordered 支出 ← 總覽 → 行程 (swipe LEFT = itinerary, swipe RIGHT = expenses).
 */

const RATES = { JPY: 0.052, HKD: 1, USD: 7.8, TWD: 0.24 };
const PANES = ['expenses', 'overview', 'itinerary'];
const PANE_LABEL = { expenses: '支出', overview: '總覽', itinerary: '行程' };
const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
const KIND_ICON = { transport: '🚃', sight: '⛩️', food: '🍣', stay: '♨️', shop: '🛍️' };
const CAT_TONE = {
  飲食: 'bg-coral-soft text-coral-ink',
  交通: 'bg-teal-soft text-teal-strong',
  購物: 'bg-sakura-soft text-sakura-ink',
  住宿: 'bg-mustard-soft text-mustard-ink',
  娛樂: 'bg-sakura-soft text-sakura-ink',
  其他: 'bg-beige text-ink-soft',
};

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const gridPaper = {
  backgroundImage: `linear-gradient(${palette.line}55 1px, transparent 1px), linear-gradient(90deg, ${palette.line}55 1px, transparent 1px)`,
  backgroundSize: '18px 18px',
};

function readHash() {
  const p = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return { day: p.get('day'), pane: p.get('pane'), add: window.location.hash.includes('add') };
}

function todayFromUrl() {
  const t = new URLSearchParams(window.location.search).get('today');
  return /^\d{4}-\d{2}-\d{2}$/.test(t || '') ? t : DEMO_TODAY;
}

function mainItem(day) {
  const list = [...(day?.itinerary || [])].sort((a, b) => a.time.localeCompare(b.time));
  return list.find((i) => !i.done) || list[list.length - 1] || null;
}

/* ---------- doodles (inline SVG, palette only) ---------- */
const TAPE = {
  mustard: 'bg-mustard-soft border-mustard/40',
  sakura: 'bg-sakura-soft border-sakura/60',
  teal: 'bg-teal-soft border-teal/40',
};
function Tape({ className = '', tone = 'mustard' }) {
  return <span aria-hidden className={`absolute h-4 w-14 rotate-[-6deg] border opacity-90 ${TAPE[tone]} ${className}`} />;
}
function Plane({ className = '' }) {
  return (
    <svg aria-hidden viewBox="0 0 64 32" className={className}>
      <path d="M2 26 C 18 30, 30 10, 46 14" fill="none" stroke={palette['ink-muted']} strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M46 8 l14 6 -14 6 3 -6z" fill={palette.coral} stroke={palette.ink} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
function Maple({ className = '' }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path d="M12 2l2 5 4-2-1 5 5 1-4 3 2 4-5-1-1 5-2-4-2 4-1-5-5 1 2-4-4-3 5-1-1-5 4 2z" fill={palette.coral} stroke={palette['coral-ink']} strokeWidth="0.8" />
    </svg>
  );
}
function Scribble({ className = '' }) {
  return (
    <svg aria-hidden viewBox="0 0 44 44" className={className}>
      <path d="M22 3c11 0 19 8 18 19s-10 19-20 18S3 32 4 21 12 4 24 5" fill="none" stroke={palette.coral} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- home ---------- */
function Summary({ trip, today, onOpenToday }) {
  const total = trip.expenses.reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
  const todaySpend = spendOnDate(trip.expenses, today);
  const counter = dayCounter(trip, today);
  const item = mainItem(trip.days[today]);
  return (
    <section className="relative mx-3 mt-3 rounded-card border-2 border-ink bg-cream-soft shadow-[3px_3px_0_0_rgb(var(--c-ink))]">
      <Tape className="-top-2 left-6" />
      <Tape className="-top-2 right-8 rotate-[5deg]" tone="sakura" />
      <div className="flex items-end justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <p className="whitespace-nowrap text-meta text-ink-muted">全程總支出</p>
          <p className="whitespace-nowrap font-display text-[32px] leading-none text-ink">
            <span className="mr-1 text-base">HK$</span>{fmt(total)}
          </p>
          <p className="mt-1 whitespace-nowrap text-meta text-ink-soft">今日支出 HK$ {fmt(todaySpend)}</p>
        </div>
        <div className="shrink-0 rotate-[3deg] rounded-control border-2 border-dashed border-coral bg-coral-soft px-2 py-1 text-center">
          <p className="whitespace-nowrap font-display text-sm text-coral-ink">{counter.label}</p>
        </div>
      </div>
      <div className="mx-4 mt-3 border-t-2 border-dashed border-line" />
      <button type="button" onClick={onOpenToday} className="flex w-full min-w-0 items-center gap-2 px-4 py-3 text-left">
        <span className="shrink-0 rounded-pill bg-teal px-2 py-0.5 text-meta text-cream-soft">今日主行程</span>
        {item ? (
          <span className="min-w-0 whitespace-nowrap text-sm text-ink">
            <span className="font-mono text-meta text-ink-muted">{item.time}</span> {item.title}
          </span>
        ) : (
          <span className="whitespace-nowrap text-sm text-ink-muted">今日未有行程</span>
        )}
        <span className="ml-auto shrink-0 text-teal-strong">›</span>
      </button>
    </section>
  );
}

function Calendar({ trip, today, month, onPick, onMonth }) {
  const weeks = monthGrid(month);
  const d = parseISODate(month);
  const title = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
  return (
    <section data-testid="calendar" className="mx-3 mt-4">
      <div className="mb-2 flex items-center justify-between px-1">
        <button type="button" aria-label="上個月" onClick={() => onMonth(-1)} className="h-9 w-9 rounded-pill border-2 border-ink bg-cream-soft font-display">‹</button>
        <h2 className="relative whitespace-nowrap font-display text-xl text-ink">
          {title}
          <Maple className="absolute -right-6 -top-2 h-5 w-5" />
        </h2>
        <button type="button" aria-label="下個月" onClick={() => onMonth(1)} className="h-9 w-9 rounded-pill border-2 border-ink bg-cream-soft font-display">›</button>
      </div>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] gap-[3px]">
        {WEEK.map((w, i) => (
          <div key={w} className={`whitespace-nowrap text-center text-meta ${i > 4 ? 'text-coral-ink' : 'text-ink-muted'}`}>{w}</div>
        ))}
        {weeks.flat().map((iso, i) => {
          if (!iso) return <div key={`b${i}`} />;
          const inTrip = iso >= trip.startDate && iso <= trip.endDate;
          const note = trip.days[iso]?.note;
          const spent = spendOnDate(trip.expenses, iso);
          const isToday = iso === today;
          const tilt = ['rotate-[-1deg]', 'rotate-[1deg]', 'rotate-0'][i % 3];
          return (
            <button
              key={iso}
              type="button"
              data-testid={`day-cell-${iso}`}
              onClick={() => onPick(iso)}
              className={`relative flex h-[62px] min-w-0 flex-col items-center overflow-hidden rounded-[6px] px-0 pt-1 ${
                inTrip ? `border border-ink/70 bg-mustard-soft ${tilt}` : 'bg-cream-soft/60'
              }`}
            >
              {isToday && <Scribble className="pointer-events-none absolute left-1/2 top-[-4px] h-8 w-8 -translate-x-1/2" />}
              <span className={`relative font-display text-sm leading-tight ${isToday ? 'text-coral-ink' : 'text-ink'}`}>{Number(iso.slice(8))}</span>
              {note && <span className="mt-0.5 whitespace-nowrap text-meta leading-tight text-ink-soft">{capCellNote(note)}</span>}
              {spent > 0 && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-pill bg-coral" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- day view ---------- */
function Pager({ pane, setPane, children }) {
  const idx = PANES.indexOf(pane);
  const ref = useRef(null);
  const drag = useRef(null);
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);

  const down = (e) => {
    if (e.target.closest('input,textarea,select,[data-noswipe]')) return;
    drag.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (d.axis === 'x') ref.current?.setPointerCapture?.(d.id);
    }
    if (d.axis === 'x') { dxRef.current = mx; setDx(mx); }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    const dx = dxRef.current;
    dxRef.current = 0;
    if (d?.axis === 'x') {
      const w = ref.current?.offsetWidth || 390;
      if (dx < -w * 0.18 && idx < PANES.length - 1) setPane(PANES[idx + 1]);
      else if (dx > w * 0.18 && idx > 0) setPane(PANES[idx - 1]);
    }
    setDx(0);
  };

  return (
    <div
      ref={ref}
      className="relative flex-1 overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div
        className="flex h-full"
        style={{
          width: `${PANES.length * 100}%`,
          transform: `translateX(calc(${(-idx * 100) / PANES.length}% + ${dx}px))`,
          transition: dx ? 'none' : 'transform 280ms cubic-bezier(.2,.8,.2,1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DayView({ trip, iso, today, pane, setPane, onBack, onAdd, onEdit }) {
  const day = trip.days[iso] || {};
  const list = trip.expenses.filter((e) => e.date === iso);
  const spent = spendOnDate(trip.expenses, iso);
  const d = parseISODate(iso);
  const inTrip = iso >= trip.startDate && iso <= trip.endDate;
  const n = inTrip ? dayCounter(trip, iso).n : null;
  const itin = [...(day.itinerary || [])].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div data-testid="day-view" className="flex h-[100dvh] flex-col bg-cream" style={gridPaper}>
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <button type="button" data-testid="back" onClick={onBack} className="h-10 shrink-0 rounded-pill border-2 border-ink bg-cream-soft px-3 font-display text-sm text-ink">‹ 日曆</button>
        <div className="min-w-0 flex-1 text-center">
          <p className="whitespace-nowrap font-display text-lg text-ink">{d.getMonth() + 1} 月 {d.getDate()} 日 · 週{WEEK[(d.getDay() + 6) % 7]}</p>
          <p className="whitespace-nowrap font-script text-base text-teal-strong">{n ? `Day ${n} of ${dayCounter(trip, iso).total}` : '旅程以外'}{iso === today ? ' · today' : ''}</p>
        </div>
        <button type="button" onClick={onAdd} className="h-10 shrink-0 rounded-pill bg-coral px-3 font-display text-sm text-cream-soft">＋ 記帳</button>
      </header>

      <nav className="mx-3 mb-2 grid grid-cols-3 rounded-pill border-2 border-ink bg-cream-soft p-1" aria-label="分頁">
        {PANES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPane(p)}
            className={`whitespace-nowrap rounded-pill py-1.5 text-sm ${pane === p ? 'bg-teal text-cream-soft font-display' : 'text-ink-soft'}`}
          >
            {p === 'expenses' ? '‹ ' : ''}{PANE_LABEL[p]}{p === 'itinerary' ? ' ›' : ''}
          </button>
        ))}
      </nav>

      <Pager pane={pane} setPane={setPane}>
        {/* LEFT pane: scanned expenses (reached by swiping RIGHT) */}
        <section data-testid="pane-expenses" inert={pane !== 'expenses' ? '' : undefined} className="h-full w-1/3 touch-pan-y overflow-y-auto px-3 pb-28">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="whitespace-nowrap font-display text-lg text-ink">掃描收據</h3>
            <p className="whitespace-nowrap text-sm text-ink-soft">共 HK$ {fmt(spent)}</p>
          </div>
          {list.length === 0 && <p className="rounded-control border-2 border-dashed border-line bg-cream-soft p-4 text-center text-sm text-ink-muted">今日未有收據，撳「＋ 記帳」掃描一張</p>}
          <ul className="space-y-3">
            {list.map((e, i) => (
              <li key={e.id}>
                <button type="button" onClick={() => onEdit(e)} className={`relative w-full bg-cream-soft px-3 pb-3 pt-2 text-left shadow-[2px_2px_0_0_rgb(var(--c-line))] ${i % 2 ? 'rotate-[0.6deg]' : 'rotate-[-0.6deg]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 whitespace-nowrap font-display text-base text-ink">{e.store}</span>
                    <span className="shrink-0 whitespace-nowrap font-mono text-sm text-ink">HK$ {fmt(e.hkdAmount)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-meta">
                    <span className={`whitespace-nowrap rounded-pill px-2 ${CAT_TONE[e.category] || CAT_TONE.其他}`}>{e.category}</span>
                    <span className="whitespace-nowrap text-ink-muted">¥{fmt(e.originalAmount)} · {e.assignedTo}</span>
                    {e.scanned && <span className="ml-auto whitespace-nowrap text-teal-strong">✓ 已掃描</span>}
                  </div>
                  {e.items?.length > 0 && (
                    <ul className="mt-2 border-t border-dashed border-line pt-1 text-meta text-ink-soft">
                      {e.items.map((it) => (
                        <li key={it.name} className="flex justify-between whitespace-nowrap"><span>{it.name}</span><span>¥{fmt(it.price)}</span></li>
                      ))}
                    </ul>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* CENTRE pane: overview (opens first) */}
        <section data-testid="pane-overview" inert={pane !== 'overview' ? '' : undefined} className="h-full w-1/3 touch-pan-y overflow-y-auto px-3 pb-28">
          <div className="relative rounded-card border-2 border-ink bg-cream-soft p-4">
            <Tape className="-top-2 left-1/2 -translate-x-1/2" tone="teal" />
            <p className="whitespace-nowrap text-meta text-ink-muted">今日筆記</p>
            <p className="mt-1 font-display text-2xl text-ink">{day.note || '（未寫）'}</p>
            <Plane className="mt-2 h-8 w-24" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPane('expenses')} className="rounded-control bg-coral-soft p-3 text-left">
                <p className="whitespace-nowrap text-meta text-coral-ink">‹ 支出 {list.length} 張</p>
                <p className="whitespace-nowrap font-display text-lg text-ink">HK$ {fmt(spent)}</p>
              </button>
              <button type="button" onClick={() => setPane('itinerary')} className="rounded-control bg-teal-soft p-3 text-left">
                <p className="whitespace-nowrap text-meta text-teal-strong">行程 {itin.length} 項 ›</p>
                <p className="whitespace-nowrap font-display text-lg text-ink">{mainItem(day)?.title || '—'}</p>
              </button>
            </div>
          </div>
          <p className="mt-4 whitespace-nowrap text-center font-script text-lg text-ink-muted">← 右掃睇收據 · 左掃睇行程 →</p>
        </section>

        {/* RIGHT pane: itinerary (reached by swiping LEFT) */}
        <section data-testid="pane-itinerary" inert={pane !== 'itinerary' ? '' : undefined} className="h-full w-1/3 touch-pan-y overflow-y-auto px-3 pb-28">
          <h3 className="mb-2 whitespace-nowrap font-display text-lg text-ink">行程</h3>
          {itin.length === 0 && <p className="rounded-control border-2 border-dashed border-line bg-cream-soft p-4 text-center text-sm text-ink-muted">今日未有行程</p>}
          <ol className="relative ml-3 border-l-2 border-dashed border-teal pl-4">
            {itin.map((it) => (
              <li key={it.id} className="relative mb-3">
                <span className={`absolute -left-[27px] top-2 flex h-5 w-5 items-center justify-center rounded-pill border-2 border-ink text-meta ${it.done ? 'bg-teal text-cream-soft' : 'bg-cream-soft'}`}>{it.done ? '✓' : ''}</span>
                <div className={`rounded-control border-2 border-ink bg-cream-soft px-3 py-2 ${it.done ? 'opacity-70' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-sm text-ink-muted">{it.time}</span>
                    <span className="min-w-0 whitespace-nowrap font-display text-base text-ink">{KIND_ICON[it.kind] || '📍'} {it.title}</span>
                  </div>
                  <p className="whitespace-nowrap text-meta text-ink-muted">{it.place}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Pager>
    </div>
  );
}

/* ---------- add / edit form ---------- */
function ExpenseForm({ initial, date, onSave, onClose }) {
  const [amount, setAmount] = useState(initial ? String(initial.originalAmount) : '');
  const [currency, setCurrency] = useState(initial?.originalCurrency || 'JPY');
  const [day, setDay] = useState(initial?.date || date);
  const [store, setStore] = useState(initial?.store || '');
  const [category, setCategory] = useState(initial?.category || '飲食');
  const [payer, setPayer] = useState(initial?.assignedTo || '共同');
  const [items, setItems] = useState(initial?.items || []);
  const [scanning, setScanning] = useState(false);
  const hkd = (Number(amount) || 0) * RATES[currency];

  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setStore('7-Eleven 銀座店');
      setAmount('1280');
      setCurrency('JPY');
      setCategory('飲食');
      setItems([{ name: '炸雞', price: 280 }, { name: '咖啡', price: 160 }]);
    }, 700);
  };

  const save = () => {
    if (!(Number(amount) > 0)) return;
    onSave({
      id: initial?.id || `p${Date.now()}`,
      date: day,
      store: store || category,
      category,
      currency,
      originalCurrency: currency,
      originalAmount: Number(amount),
      hkdAmount: Math.round(hkd * 10) / 10,
      assignedTo: payer,
      items,
      scanned: initial?.scanned ?? false,
    });
  };

  const chip = (on) => `whitespace-nowrap rounded-pill border-2 px-3 py-1 text-sm ${on ? 'border-ink bg-ink text-cream-soft' : 'border-line bg-cream-soft text-ink-soft'}`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-ink/40" onClick={onClose}>
      <div data-testid="expense-form" onClick={(e) => e.stopPropagation()} className="relative flex max-h-[92dvh] flex-col rounded-t-card border-t-2 border-ink bg-cream" style={gridPaper}>
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <button type="button" onClick={onClose} className="whitespace-nowrap text-sm text-ink-muted">取消</button>
          <h2 className="whitespace-nowrap font-display text-lg text-ink">{initial ? '修改一筆' : '記一筆'}</h2>
          <span className="w-8" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <button type="button" onClick={scan} className="mb-3 flex w-full items-center justify-center gap-2 rounded-control border-2 border-dashed border-teal bg-teal-soft py-3 font-display text-teal-strong">
            {scanning ? '掃描中…' : '📷 掃描收據（模擬）'}
          </button>
          <div className="rounded-card border-2 border-ink bg-cream-soft p-3">
            <div className="flex gap-1">
              {Object.keys(RATES).map((c) => (
                <button key={c} type="button" onClick={() => setCurrency(c)} className={chip(currency === c)}>{c}</button>
              ))}
            </div>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0"
              aria-label="金額"
              className="mt-2 w-full bg-transparent font-display text-[40px] leading-none text-ink outline-none"
            />
            <p className="whitespace-nowrap text-meta text-ink-muted">≈ HK$ {fmt(hkd)}</p>
          </div>
          <label className="mt-3 block text-meta text-ink-muted">日期
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 block w-full rounded-control border-2 border-line bg-cream-soft px-3 py-2 text-base text-ink" />
          </label>
          <label className="mt-3 block text-meta text-ink-muted">商店
            <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="例如：一蘭拉麵" className="mt-1 block w-full rounded-control border-2 border-line bg-cream-soft px-3 py-2 text-base text-ink" />
          </label>
          <p className="mt-3 text-meta text-ink-muted">類別</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MOCK_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>{c}</button>
            ))}
          </div>
          <p className="mt-3 text-meta text-ink-muted">邊個俾</p>
          <div className="mt-1 flex gap-1.5">
            {MOCK_PEOPLE.map((p) => (
              <button key={p} type="button" onClick={() => setPayer(p)} className={chip(payer === p)}>{p}</button>
            ))}
          </div>
          <details className="mt-3 rounded-control border-2 border-line bg-cream-soft px-3 py-2" open={items.length > 0}>
            <summary className="whitespace-nowrap text-sm text-ink-soft">明細（{items.length}）</summary>
            <ul className="mt-1 text-sm text-ink">
              {items.map((it, i) => (
                <li key={`${it.name}${i}`} className="flex justify-between whitespace-nowrap border-b border-dashed border-line py-1"><span>{it.name}</span><span>{fmt(it.price)}</span></li>
              ))}
            </ul>
            <button type="button" onClick={() => setItems([...items, { name: `項目 ${items.length + 1}`, price: 0 }])} className="mt-1 text-sm text-teal-strong">＋ 加一項</button>
          </details>
        </div>
        <div className="border-t-2 border-ink bg-cream-soft px-4 pb-5 pt-3">
          <button type="button" data-testid="form-save" onClick={save} className="w-full rounded-pill bg-coral py-3 font-display text-lg text-cream-soft shadow-[2px_2px_0_0_rgb(var(--c-ink))]">
            儲存 · HK$ {fmt(hkd)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- nav ---------- */
function BottomNav({ onHome, onToday, onAdd, onStub }) {
  const item = 'flex min-w-0 flex-col items-center gap-0.5 py-1 text-meta text-ink-soft whitespace-nowrap';
  return (
    <nav data-testid="nav" className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t-2 border-ink bg-cream-soft px-2 pb-3 pt-1">
      <div className="grid grid-cols-5 items-end">
        <button type="button" className={item} onClick={onHome}><span className="text-lg">📔</span>手帳</button>
        <button type="button" className={item} onClick={onToday}><span className="text-lg">🗺️</span>今日</button>
        <button type="button" data-testid="nav-add" aria-label="記一筆" onClick={onAdd} className="mx-auto -mt-6 flex h-14 w-14 rotate-[-4deg] items-center justify-center rounded-pill border-2 border-ink bg-coral font-display text-3xl text-cream-soft shadow-[2px_2px_0_0_rgb(var(--c-ink))]">＋</button>
        <button type="button" className={item} onClick={() => onStub('統計')}><span className="text-lg">📊</span>統計</button>
        <button type="button" className={item} onClick={() => onStub('更多')}><span className="text-lg">⚙️</span>更多</button>
      </div>
    </nav>
  );
}

/* ---------- root ---------- */
export default function OptionGrok() {
  const today = useMemo(todayFromUrl, []);
  const [trip, setTrip] = useState(createMockTrip);
  const initial = useMemo(readHash, []);
  const [day, setDay] = useState(initial.day);
  const [pane, setPane] = useState(PANES.includes(initial.pane) ? initial.pane : 'overview');
  const [form, setForm] = useState(initial.add ? { initial: null } : null);
  const [month, setMonth] = useState(today.slice(0, 8) + '01');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const h = form && !form.initial ? (day ? `day=${day}&pane=${pane}&add` : 'add') : day ? `day=${day}&pane=${pane}` : '';
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${h ? `#${h}` : ''}`);
  }, [day, pane, form]);

  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      setDay(h.day);
      setPane(PANES.includes(h.pane) ? h.pane : 'overview');
      setForm(h.add ? { initial: null } : null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const openDay = (iso) => { setDay(iso); setPane('overview'); };
  const shiftMonth = (n) => {
    const d = parseISODate(month);
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  };
  const saveExpense = (e) => {
    setTrip((t) => ({ ...t, expenses: t.expenses.some((x) => x.id === e.id) ? t.expenses.map((x) => (x.id === e.id ? e : x)) : [...t.expenses, e] }));
    setForm(null);
    setToast('已記低 ✓');
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[480px] bg-cream text-ink" style={gridPaper}>
      {day ? (
        <DayView
          trip={trip}
          iso={day}
          today={today}
          pane={pane}
          setPane={setPane}
          onBack={() => setDay(null)}
          onAdd={() => setForm({ initial: null })}
          onEdit={(e) => setForm({ initial: e })}
        />
      ) : (
        <main data-testid="home" className="pb-28">
          <header className="flex items-center justify-between px-4 pt-4">
            <div className="min-w-0">
              <p className="whitespace-nowrap font-script text-lg leading-none text-teal-strong">my travel notebook</p>
              <h1 className="whitespace-nowrap font-display text-2xl text-ink">{trip.name}</h1>
            </div>
            <Plane className="h-8 w-16 shrink-0" />
          </header>
          <Summary trip={trip} today={today} onOpenToday={() => openDay(today)} />
          <Calendar trip={trip} today={today} month={month} onPick={openDay} onMonth={shiftMonth} />
          <p className="mt-4 whitespace-nowrap text-center text-meta text-ink-muted">Option G · executor takeover · grok-4.7-high stalled ×3</p>
        </main>
      )}
      {!day && <BottomNav onHome={() => setDay(null)} onToday={() => openDay(today)} onAdd={() => setForm({ initial: null })} onStub={(n) => setToast(`${n}：原型未包含`)} />}
      {form && <ExpenseForm initial={form.initial} date={day || today} onSave={saveExpense} onClose={() => setForm(null)} />}
      {toast && <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 whitespace-nowrap rounded-pill bg-ink px-4 py-2 text-sm text-cream-soft">{toast}</div>}
    </div>
  );
}
