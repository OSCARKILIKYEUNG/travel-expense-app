import { useCallback, useEffect, useMemo, useState } from 'react';
import { REF_CATEGORIES, REF_PEOPLE, REF_RATE, REF_TODAY, createRefTrip } from './mockRefTrip';
import {
  buildAddHash,
  filterExpenses,
  fmtHKD,
  fmtJPY,
  groupLedger,
  matchesPerson,
  parseRoute,
  personCounts,
  zhDate,
} from './refLogic';
import { normalizeDate } from '../../utils/duplicates';
import { CATEGORY_DOT, Icon, Sakura, Sparkle, Tape, paperDots, washiNav } from './parts';
import Home from './Home';
import DayView from './DayView';
import Ledger from './Ledger';
import AddForm from './AddForm';
import { Chip, ChipRow } from './ExpenseCard';

/**
 * ?proto=ref — Travel notebook prototype matched to the 390px reference screenshots.
 * Local mock data only. No sign-in, no network.
 */
const go = (hash, replace = false) => {
  const url = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState({ refPushed: true }, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return route;
}

export default function RefProto() {
  const [trip, setTrip] = useState(createRefTrip);
  const route = useRoute();
  const [returnTo, setReturnTo] = useState('');
  const [month, setMonth] = useState(() => createRefTrip().startDate.slice(0, 7));
  const today = REF_TODAY;

  const openDay = (iso, pane = 'itinerary') => go(`day=${iso}&pane=${pane}`);
  const openAdd = useCallback((opts = {}) => {
    setReturnTo(window.location.hash.replace(/^#/, ''));
    go(buildAddHash(opts));
  }, []);

  const updateDay = (iso, patch) =>
    setTrip((t) => ({
      ...t,
      days: {
        ...t.days,
        [iso]: { ...(t.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] }), ...patch },
      },
    }));

  const deleteExpense = (e) => setTrip((t) => ({ ...t, expenses: t.expenses.filter((x) => x.id !== e.id) }));

  const saveExpense = (data) => {
    setTrip((t) => {
      if (data.id) return { ...t, expenses: t.expenses.map((x) => (x.id === data.id ? { ...x, ...data } : x)) };
      return { ...t, expenses: [...t.expenses, { ...data, id: `n${Date.now()}`, items: [] }] };
    });
    const key = data.date ? normalizeDate(data.date) : null;
    go(data.scanned && key ? `day=${key}&pane=expenses` : returnTo, true);
  };

  let body;
  if (route.screen === 'day') {
    body = (
      <DayView
        trip={trip}
        iso={route.day}
        pane={route.pane}
        editing={route.edit}
        today={today}
        onPane={(p) => go(`day=${route.day}&pane=${p}${route.edit && p === 'itinerary' ? '&edit=1' : ''}`, true)}
        onEditToggle={(on) => go(`day=${route.day}&pane=itinerary${on ? '&edit=1' : ''}`, true)}
        onBack={() => (window.history.state?.refPushed ? window.history.back() : go('', true))}
        onDay={(iso) => go(`day=${iso}&pane=${route.pane}`, true)}
        onUpdateDay={updateDay}
        onScan={(date) => openAdd({ scan: true, date })}
        onAdd={(date) => openAdd({ date })}
        onEditExpense={(e) => openAdd({ id: e.id })}
        onDeleteExpense={deleteExpense}
      />
    );
  } else if (route.screen === 'add') {
    const initial = route.expenseId ? trip.expenses.find((e) => e.id === route.expenseId) : null;
    body = (
      <AddForm
        key={window.location.hash}
        initial={initial}
        defaultDate={route.date}
        startScan={route.scan}
        onCancel={() => (window.history.state?.refPushed ? window.history.back() : go(returnTo, true))}
        onSave={saveExpense}
      />
    );
  } else if (route.screen === 'ledger') {
    body = (
      <Ledger
        trip={trip}
        onScan={() => openAdd({ scan: true })}
        onAdd={() => openAdd()}
        onEdit={(e) => openAdd({ id: e.id })}
        onDelete={deleteExpense}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
      />
    );
  } else if (route.screen === 'charts') {
    body = <ChartsView trip={trip} onOpenDay={(iso) => openDay(iso, 'expenses')} />;
  } else if (route.screen === 'settings') {
    body = <SettingsView trip={trip} />;
  } else {
    body = (
      <Home
        trip={trip}
        today={today}
        month={month}
        setMonth={setMonth}
        onOpenDay={(iso) => openDay(iso)}
        onScan={() => openAdd({ scan: true, date: today })}
        onAdd={() => openAdd({ date: today })}
      />
    );
  }

  let tab = null;
  if (route.screen === 'home' || route.screen === 'day') tab = 'home';
  else if (route.screen === 'ledger') tab = 'ledger';
  else if (route.screen === 'charts') tab = 'charts';
  else if (route.screen === 'settings') tab = 'settings';
  else if (route.screen === 'add') tab = returnTo === 'ledger' ? 'ledger' : null;

  return (
    <div className="min-h-screen text-ink" style={paperDots}>
      <Header trip={trip} />
      <main className="mx-auto max-w-5xl pb-20">{body}</main>
      <BottomNav tab={tab} />
    </div>
  );
}

function Header({ trip }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream-soft/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button
          type="button"
          onClick={() => go('')}
          className="relative flex min-w-0 shrink items-center gap-3 rounded-2xl px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <Sparkle className="absolute left-0.5 top-0 h-3.5 w-3.5" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-teal-soft text-teal-strong">
            {Icon.pin('h-[18px] w-[18px]')}
          </span>
          <span className="min-w-0 leading-none">
            <span className="block whitespace-nowrap font-script text-lg font-semibold leading-none text-teal-strong">
              Travel notebook
            </span>
            <span className="block whitespace-nowrap font-display text-base tracking-[-0.03em] text-ink">
              旅遊手帳
            </span>
          </span>
        </button>

        <div className="relative">
          <button
            type="button"
            data-testid="trip-switcher"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 text-meta text-ink-soft transition-colors hover:bg-white/40 hover:text-ink"
          >
            {Icon.globe('h-3.5 w-3.5 shrink-0')}
            <span>{trip.name}</span>
            {Icon.chevDown('h-3.5 w-3.5 shrink-0')}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-2 min-w-[220px] rounded-card border border-line bg-cream-soft py-2 text-ink shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between whitespace-nowrap bg-teal-soft px-4 py-2 text-left text-sm font-semibold text-teal-strong"
              >
                <span>{trip.name}</span>
                <span className="ml-2 shrink-0 rounded-pill bg-teal-soft px-1.5 py-0.5 text-meta text-teal-strong">
                  當前
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-between whitespace-nowrap px-4 py-2 text-left text-sm text-ink hover:bg-white/50"
              >
                <span>大阪週末</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const NAV = [
  ['home', '日曆', '', Icon.home],
  ['ledger', '帳本', 'ledger', Icon.book],
  ['charts', '圖表', 'charts', Icon.chart],
  ['settings', '設定', 'settings', Icon.gear],
];

function BottomNav({ tab }) {
  return (
    <nav
      data-testid="nav"
      aria-label="導航"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={washiNav} />
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {NAV.map(([id, label, hash, icon]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              data-testid={`nav-${id}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(hash)}
              className={`flex min-w-0 flex-col items-center gap-0.5 py-2 transition-colors ${
                active ? 'text-teal-strong' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {icon('h-[22px] w-[22px]')}
              <span className="whitespace-nowrap text-meta font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ChartsView({ trip, onOpenDay }) {
  const [person, setPerson] = useState('全部');
  const counts = useMemo(() => personCounts(trip.expenses, REF_PEOPLE), [trip.expenses]);
  const list = useMemo(() => filterExpenses(trip.expenses, { person }, REF_PEOPLE), [trip.expenses, person]);
  const total = list.reduce((s, e) => s + e.hkdAmount, 0);

  const byCat = useMemo(() => {
    const map = {};
    for (const c of REF_CATEGORIES) map[c] = { total: 0, count: 0 };
    for (const e of list) {
      const k = map[e.category] ? e.category : '其他';
      map[k].total += e.hkdAmount;
      map[k].count += 1;
    }
    return REF_CATEGORIES.map((c) => ({ cat: c, ...map[c] })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
  }, [list]);

  const byPerson = useMemo(
    () =>
      REF_PEOPLE.map((p) => {
        const items = trip.expenses.filter((e) => matchesPerson(e, p, REF_PEOPLE));
        return { person: p, count: items.length, total: items.reduce((s, e) => s + e.hkdAmount, 0) };
      }),
    [trip.expenses],
  );

  const byDay = useMemo(() => groupLedger(list).filter((g) => g.iso).reverse(), [list]);
  const dayCount = byDay.length || 1;
  const avg = Math.round(total / dayCount);
  const maxDay = Math.max(...byDay.map((d) => d.total), 1);
  const allTotal = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0) || 1;

  return (
    <div data-testid="page-charts" className="space-y-4 px-4 pb-6 pt-4">
      <div className="relative flex items-baseline gap-2">
        <Sparkle className="absolute -left-1 top-1 h-4 w-4" />
        <h1 className="whitespace-nowrap pl-4 font-display text-2xl text-ink">統計圖表</h1>
        <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Charts</span>
      </div>

      {/* Top stats summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">總花費</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-teal-strong">{fmtHKD(total)}</p>
        </div>
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">天數</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-ink">{byDay.length} 日</p>
        </div>
        <div className="paper-panel p-3 text-center">
          <p className="whitespace-nowrap text-meta font-medium text-ink-muted">日均</p>
          <p className="mt-0.5 whitespace-nowrap text-sm font-bold tabular-nums text-ink">{fmtHKD(avg)}</p>
        </div>
      </div>

      {/* Person filter */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">篩選:</span>
        <div className="min-w-0 flex-1">
          <ChipRow label="篩選人物">
            {['全部', ...REF_PEOPLE].map((p) => (
              <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
                {p} ({counts[p] || 0})
              </Chip>
            ))}
          </ChipRow>
        </div>
      </div>

      {/* By Category */}
      <section className="paper-panel relative space-y-2.5 p-4">
        <Tape tone="coral" className="-top-2 right-6 z-10 h-4 w-16 rotate-1" />
        <h2 className="whitespace-nowrap font-display text-lg text-ink">類別花費分佈</h2>
        <div className="space-y-2.5">
          {byCat.map((row) => {
            const pct = total > 0 ? Math.round((row.total / total) * 100) : 0;
            const barTone = CATEGORY_DOT[row.cat] || 'bg-teal';
            return (
              <div key={row.cat} className="space-y-1">
                <div className="flex items-center justify-between text-meta">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-ink">
                    <span className={`h-2.5 w-2.5 rounded-full ${barTone}`} />
                    {row.cat} · {row.count} 筆
                  </span>
                  <span className="whitespace-nowrap font-mono font-semibold text-ink-soft">
                    {fmtHKD(row.total)} ({pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-beige">
                  <div className={`h-full rounded-pill ${barTone}`} style={{ width: `${Math.max(6, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* By Person */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">人物花費分配</h2>
        <div className="space-y-2.5">
          {byPerson.map((row, idx) => {
            const pct = Math.round((row.total / allTotal) * 100);
            const barTone = idx === 0 ? 'bg-teal-strong' : idx === 1 ? 'bg-coral' : 'bg-mustard';
            return (
              <div key={row.person} className="space-y-1">
                <div className="flex items-center justify-between text-meta">
                  <span className="whitespace-nowrap font-bold text-ink">
                    {row.person} ({row.count} 筆)
                  </span>
                  <span className="whitespace-nowrap font-mono font-semibold text-ink-soft">
                    {fmtHKD(row.total)} ({pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-beige">
                  <div className={`h-full rounded-pill ${barTone}`} style={{ width: `${Math.max(6, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* By Day */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">每日花費趨勢</h2>
        <div className="space-y-2">
          {byDay.map((d) => {
            const pct = Math.round((d.total / maxDay) * 100);
            const dayTitle = trip.days[d.iso]?.title || '';
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => onOpenDay(d.iso)}
                className="block w-full space-y-1 rounded-xl border border-line/60 bg-cream px-3 py-2 text-left transition-colors hover:bg-beige/50"
              >
                <div className="flex items-center justify-between text-meta">
                  <span className="whitespace-nowrap font-bold text-ink">
                    {zhDate(d.iso)}
                    {dayTitle ? ` · ${dayTitle}` : ''}
                  </span>
                  <span className="whitespace-nowrap font-mono font-semibold text-teal-strong">{fmtHKD(d.total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-pill bg-beige">
                  <div className="h-full rounded-pill bg-teal-strong" style={{ width: `${Math.max(8, pct)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SettingsView({ trip }) {
  const [copied, setCopied] = useState('');
  const totalHKD = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0);
  const totalJPY = trip.expenses.filter((e) => e.currency === 'JPY').reduce((s, e) => s + e.originalAmount, 0);
  const counts = personCounts(trip.expenses, REF_PEOPLE);

  return (
    <div data-testid="page-settings" className="space-y-4 px-4 pb-6 pt-4">
      <div className="relative space-y-1">
        <Sparkle className="absolute right-2 top-2 h-4 w-4" />
        <p className="whitespace-nowrap text-meta font-medium tracking-[0.12em] text-ink-muted">旅遊手帳設定</p>
        <div className="flex items-baseline gap-2">
          <h1 className="whitespace-nowrap font-display text-2xl text-ink">設定</h1>
          <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Settings</span>
        </div>
      </div>

      {/* Trip management */}
      <section className="paper-panel relative space-y-2.5 p-4">
        <Tape tone="teal" className="-top-2 left-6 z-10 h-4 w-16 -rotate-1" />
        <div className="flex items-center justify-between">
          <h2 className="whitespace-nowrap font-display text-lg text-ink">旅程管理</h2>
          <span className="whitespace-nowrap rounded-pill bg-teal-soft px-2.5 py-0.5 text-meta font-bold text-teal-strong">
            當前旅程
          </span>
        </div>
        <div className="rounded-2xl border border-teal/35 bg-teal-soft/65 p-3">
          <div className="flex items-center justify-between">
            <span className="whitespace-nowrap text-sm font-bold text-teal-strong">{trip.name}</span>
            <span className="whitespace-nowrap text-meta font-semibold text-teal-strong">
              {trip.expenses.length} 筆記錄
            </span>
          </div>
          <p className="mt-1 whitespace-nowrap text-meta text-ink-soft">
            {trip.startDate} – {trip.endDate} · {fmtHKD(totalHKD)}
          </p>
        </div>
      </section>

      {/* People / Members */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">人物管理</h2>
        <div className="space-y-1.5">
          {REF_PEOPLE.map((p) => (
            <div
              key={p}
              className="flex items-center justify-between rounded-xl border border-line bg-cream px-3 py-2 text-sm"
            >
              <span className="whitespace-nowrap font-semibold text-ink">{p}</span>
              <span className="whitespace-nowrap text-meta font-medium text-ink-muted">{counts[p] || 0} 筆記錄</span>
            </div>
          ))}
        </div>
      </section>

      {/* Currency & Exchange Rate */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">貨幣與匯率</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-line bg-cream p-2.5">
            <p className="whitespace-nowrap text-meta text-ink-muted">旅程主要外幣</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">JPY 日元</p>
          </div>
          <div className="rounded-xl border border-line bg-cream p-2.5">
            <p className="whitespace-nowrap text-meta text-ink-muted">記帳貨幣</p>
            <p className="mt-0.5 whitespace-nowrap text-sm font-bold text-ink">HKD 港幣</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line bg-cream px-3 py-2">
          <span className="whitespace-nowrap font-mono text-meta font-semibold text-ink">
            1 JPY = {REF_RATE} HKD
          </span>
          <span className="whitespace-nowrap rounded-md bg-mustard-soft px-2 py-0.5 text-meta font-bold text-mustard-ink">
            示範匯率
          </span>
        </div>
      </section>

      {/* Data & Export */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">資料管理</h2>
        <div className="grid grid-cols-3 gap-2">
          {['匯出 JSON', '完整備份', '複製報告'].map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setCopied(`已預備：${label}`)}
              className="whitespace-nowrap rounded-xl border border-line bg-cream py-2 text-meta font-semibold text-ink-soft hover:bg-beige"
            >
              {label}
            </button>
          ))}
        </div>
        {copied && <p className="whitespace-nowrap text-meta font-semibold text-teal-strong">{copied}</p>}
      </section>

      {/* About */}
      <section className="paper-panel relative space-y-1 p-4">
        <Sakura className="absolute right-3 top-3 h-6 w-6 opacity-70" />
        <h2 className="whitespace-nowrap font-display text-base text-ink">關於旅遊手帳</h2>
        <p className="whitespace-nowrap text-meta text-ink-soft">
          原幣合計 {fmtJPY(totalJPY)} · 離線手札示範模式
        </p>
      </section>
    </div>
  );
}
