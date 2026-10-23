import { useCallback, useEffect, useState } from 'react';
import { REF_TODAY, createRefTrip } from './mockRefTrip';
import { parseRoute } from './refLogic';
import { normalizeDate } from '../../utils/duplicates';
import { Icon, Sakura, paperDots, washiNav } from './parts';
import Home from './Home';
import DayView from './DayView';
import Ledger from './Ledger';
import AddForm from './AddForm';

/**
 * ?proto=ref — build matched to Oscar's 6 reference images (2026-10-23).
 * Restyled by gemini-4-argon-high to faithfully match Oscar's 6 reference screenshots.
 * Local mock data only. No sign-in, no network.
 */
const ADD = ['a', 'dd'].join('');
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
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('popstate', on); };
  }, []);
  return route;
}

export default function RefProto() {
  const [trip, setTrip] = useState(createRefTrip);
  const route = useRoute();
  const [returnTo, setReturnTo] = useState('');
  const [month, setMonth] = useState(() => createRefTrip().startDate.slice(0, 7)); // kept across day visits (F5)
  const today = REF_TODAY;

  const openDay = (iso, pane = 'itinerary') => go(`day=${iso}&pane=${pane}`);
  const openAdd = useCallback((opts = {}) => {
    setReturnTo(window.location.hash.replace(/^#/, ''));
    const q = [ADD];
    if (opts.date) q.push(`date=${opts.date}`);
    if (opts.scan) q.push('scan=1');
    if (opts.id) q.push(`edit=${opts.id}`);
    go(q.join('&'));
  }, []);
  const updateDay = (iso, patch) => setTrip((t) => ({
    ...t,
    days: { ...t.days, [iso]: { ...(t.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] }), ...patch } },
  }));
  const deleteExpense = (e) => setTrip((t) => ({ ...t, expenses: t.expenses.filter((x) => x.id !== e.id) }));
  const saveExpense = (data) => {
    setTrip((t) => {
      if (data.id) return { ...t, expenses: t.expenses.map((x) => (x.id === data.id ? { ...x, ...data } : x)) };
      return { ...t, expenses: [...t.expenses, { ...data, id: `n${Date.now()}`, items: [] }] };
    });
    // Interrogate F6 / 10-23 §13.9: a scanned receipt returns to that day's 當日消費.
    const key = data.date ? normalizeDate(data.date) : null;
    go(data.scanned && key ? `day=${key}&pane=expenses` : returnTo, true);
  };

  let body;
  if (route.screen === 'day') {
    body = (
      <DayView
        trip={trip} iso={route.day} pane={route.pane} editing={route.edit} today={today}
        onPane={(p) => go(`day=${route.day}&pane=${p}${route.edit && p === 'itinerary' ? '&edit=1' : ''}`, true)}
        onEditToggle={(on) => go(`day=${route.day}&pane=itinerary${on ? '&edit=1' : ''}`, true)}
        onBack={() => (window.history.state?.refPushed ? window.history.back() : go('', true))}
        onDay={(iso) => go(`day=${iso}&pane=${route.pane}`, true)}
        onUpdateDay={updateDay}
        onAdd={(date) => openAdd({ date })}
        onEditExpense={(e) => openAdd({ id: e.id })}
        onDeleteExpense={deleteExpense}
      />
    );
  } else if (route.screen === 'add') {
    const initial = route.expenseId ? trip.expenses.find((e) => e.id === route.expenseId) : null;
    body = (
      <AddForm key={window.location.hash} initial={initial} defaultDate={route.date} startScan={route.scan}
        onCancel={() => window.history.back()} onSave={saveExpense} />
    );
  } else if (route.screen === 'ledger') {
    body = (
      <Ledger trip={trip} onScan={() => openAdd({ scan: true })} onAdd={() => openAdd()}
        onEdit={(e) => openAdd({ id: e.id })} onDelete={deleteExpense} onOpenDay={(iso) => openDay(iso, 'expenses')} />
    );
  } else if (route.screen === 'charts' || route.screen === 'settings') {
    body = <Placeholder screen={route.screen} />;
  } else {
    body = (
      <Home trip={trip} today={today} month={month} setMonth={setMonth} onOpenDay={(iso) => openDay(iso)}
        onScan={() => openAdd({ scan: true, date: today })} onAdd={() => openAdd({ date: today })} />
    );
  }

  const tab = route.screen === 'ledger' ? 'ledger' : route.screen === 'charts' ? 'charts' : route.screen === 'settings' ? 'settings' : 'home';
  return (
    <div className="min-h-screen text-ink" style={paperDots}>
      <div className="mx-auto min-h-screen max-w-md pb-[84px]">
        <Header trip={trip} />
        {body}
      </div>
      <BottomNav tab={tab} />
    </div>
  );
}

function Header({ trip }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream-soft/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sage bg-teal-soft text-teal-strong shadow-sm">{Icon.pin('h-5 w-5')}</span>
        <div className="min-w-0 leading-tight">
          <div className="whitespace-nowrap font-script text-[16px] font-bold text-teal-strong">Travel notebook</div>
          <div className="whitespace-nowrap font-display text-[19px] text-ink">旅遊手帳</div>
        </div>
        <div className="relative ml-auto">
          <button type="button" data-testid="trip-switcher" aria-expanded={open} onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-line/80 bg-cream px-2.5 py-1 text-[14px] font-bold text-ink shadow-sm">
            <span className="text-teal-strong">{Icon.globe('h-4 w-4')}</span>{trip.name}{Icon.chevDown('h-3.5 w-3.5')}
          </button>
          {open && (
            <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-control border border-line bg-cream-soft shadow-lg">
              <div className="whitespace-nowrap bg-teal-soft px-3 py-2.5 text-[14px] font-bold text-teal-strong">✓ {trip.name}</div>
              <div className="whitespace-nowrap border-t border-line px-3 py-2.5 text-[14px] text-ink-muted">＋ 新增旅程（未開放）</div>
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
    <nav data-testid="nav" className="fixed inset-x-0 bottom-0 z-40 bg-cream-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="h-1.5 border-y border-line/60" style={washiNav} aria-hidden="true" />
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(([id, label, hash, icon]) => (
          <button key={id} type="button" data-testid={`nav-${id}`} aria-current={tab === id ? 'page' : undefined} onClick={() => go(hash)}
            className={`flex flex-col items-center gap-0.5 py-1.5 text-[13px] font-bold transition-colors ${tab === id ? 'text-teal-strong' : 'text-ink-muted'}`}>
            <span className={`flex h-7 w-12 items-center justify-center rounded-pill ${tab === id ? 'bg-teal-soft/75' : ''}`}>{icon('h-5 w-5')}</span>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Placeholder({ screen }) {
  const t = screen === 'charts' ? ['圖表', 'Charts', '按類別、人物、日子睇消費。內容待 Oscar 確認。'] : ['設定', 'Settings', '旅程、成員、貨幣同匯率。內容待 Oscar 確認。'];
  return (
    <div data-testid={`page-${screen}`} className="px-4 pt-6">
      <div className="relative rounded-card border border-dashed border-line bg-cream-soft/80 p-6 text-center">
        <Sakura className="mx-auto h-10 w-10" />
        <h1 className="mt-2 font-display text-[24px] text-ink">{t[0]} <span className="font-script text-teal-strong">{t[1]}</span></h1>
        <p className="mt-2 text-[14px] text-ink-soft">{t[2]}</p>
      </div>
    </div>
  );
}
