import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REF_CATEGORIES, createRefTrips } from './mockRefTrip';
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
import {
  TOAST_DURATION_MS,
  addPerson,
  applyUndo,
  buildReport,
  countRecomputed,
  defaultExpenseDate,
  exportBackupJSON,
  exportTripJSON,
  makeUndo,
  parseRate,
  postSaveTarget,
  removePerson,
  renamePerson,
  resolveToday,
  saveToastMessage,
  setRate,
  switchTripRoute,
  tripMonth,
} from './refRules';
import { normalizeDate } from '../../utils/duplicates';
import { CATEGORY_DOT, Icon, Sakura, Sparkle, Tape, Toast, paperDots, washiNav } from './parts';
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

function downloadTextFile({ filename, text }) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function copyTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to textarea fallback
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
}

export default function RefProto() {
  const [trips, setTrips] = useState(createRefTrips);
  const [activeTripId, setActiveTripId] = useState(() => createRefTrips()[0].id);
  const trip = useMemo(() => trips.find((t) => t.id === activeTripId) || trips[0], [trips, activeTripId]);

  const route = useRoute();
  const today = useMemo(() => resolveToday(window.location.search), []);
  const [returnTo, setReturnTo] = useState('');
  const [addOrigin, setAddOrigin] = useState(() => ({ origin: 'home', originDay: null }));
  const [month, setMonth] = useState(() => tripMonth(createRefTrips()[0], resolveToday(window.location.search)));
  const [toast, setToast] = useState(null);
  const [toastHover, setToastHover] = useState(false);
  const [toastFocus, setToastFocus] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const updateActiveTrip = useCallback(
    (updater) => {
      setTrips((prev) => prev.map((t) => (t.id === activeTripId ? (typeof updater === 'function' ? updater(t) : updater) : t)));
    },
    [activeTripId],
  );

  const showToast = useCallback((message, undo = null) => {
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now() + Math.random(), message, undo });
  }, []);

  const toastPaused = toastHover || toastFocus;

  useEffect(() => {
    if (!toast || toastPaused) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, toastPaused]);

  useEffect(() => {
    if (!highlightId) return undefined;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-expense-id="${highlightId}"]`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      }
    });
    const timer = setTimeout(() => setHighlightId(null), 1600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [highlightId, route.screen, route.day, route.pane]);

  const openDay = (iso, pane = 'itinerary') => go(`day=${iso}&pane=${pane}`);

  const openAdd = useCallback(
    (opts = {}) => {
      const currentHash = window.location.hash.replace(/^#/, '');
      const currentRoute = parseRoute(currentHash);
      setReturnTo(currentHash);
      const origin =
        currentRoute.screen === 'ledger' ? 'ledger' : currentRoute.screen === 'day' ? 'day' : 'home';
      setAddOrigin({ origin, originDay: currentRoute.screen === 'day' ? currentRoute.day : null });

      const resolvedDate =
        opts.id
          ? undefined
          : opts.date !== undefined
            ? opts.date
            : defaultExpenseDate(trip, today);

      go(buildAddHash({ ...opts, date: resolvedDate }));
    },
    [trip, today],
  );

  const selectTrip = useCallback(
    (nextTripId) => {
      const target = trips.find((t) => t.id === nextTripId);
      if (!target) return;
      if (target.id === activeTripId) return;
      setActiveTripId(target.id);
      setMonth(tripMonth(target, today));
      const nextHash = switchTripRoute(window.location.hash, target);
      if (nextHash !== window.location.hash.replace(/^#/, '')) {
        go(nextHash, true);
      }
      showToast(`已切換至 ${target.name}`);
    },
    [trips, activeTripId, today, showToast],
  );

  const updateDay = (iso, patch) =>
    updateActiveTrip((t) => ({
      ...t,
      days: {
        ...t.days,
        [iso]: { ...(t.days[iso] || { title: '', note: '', sticker: null, journal: '', itinerary: [] }), ...patch },
      },
    }));

  const deleteExpense = (e) => {
    const tripId = trip.id;
    const idx = trip.expenses.findIndex((x) => x.id === e.id);
    const undoOp = makeUndo('delete', {
      expense: e,
      index: idx >= 0 ? idx : trip.expenses.length,
    });
    updateActiveTrip((t) => ({ ...t, expenses: t.expenses.filter((x) => x.id !== e.id) }));
    showToast(saveToastMessage({ kind: 'delete', expense: e }), {
      ...undoOp,
      tripId,
      highlightId: e.id,
    });
  };

  const saveExpense = (data) => {
    const tripId = trip.id;
    const isEdit = Boolean(data.id);
    const savedId = isEdit ? data.id : `n${Date.now()}`;
    const previousRecord = isEdit ? trip.expenses.find((x) => x.id === data.id) || null : null;
    const normalizedDate = data.date ? normalizeDate(data.date) || '' : '';
    const savedRecord = isEdit
      ? { ...(previousRecord || {}), ...data, id: savedId, date: normalizedDate }
      : { ...data, id: savedId, date: normalizedDate, items: [] };

    updateActiveTrip((t) => {
      if (isEdit) {
        return { ...t, expenses: t.expenses.map((x) => (x.id === savedId ? savedRecord : x)) };
      }
      return { ...t, expenses: [...t.expenses, savedRecord] };
    });

    const targetHash = postSaveTarget({ origin: addOrigin.origin, savedDate: normalizedDate });
    go(targetHash, true);
    setHighlightId(savedId);

    const undoOp = isEdit
      ? makeUndo('edit', { expense: savedRecord, previous: previousRecord })
      : makeUndo('add', { expense: savedRecord });

    showToast(saveToastMessage({ kind: isEdit ? 'edit' : 'add', expense: savedRecord }), {
      ...undoOp,
      tripId,
      highlightId: isEdit ? savedId : null,
    });
  };

  const handleUndo = () => {
    if (!toast?.undo) return;
    if (typeof toast.undo === 'function') {
      toast.undo();
    } else {
      const undoOp = toast.undo;
      const targetTripId = undoOp.tripId || activeTripId;
      setTrips((all) =>
        all.map((t) => (t.id === targetTripId ? { ...t, expenses: applyUndo(t.expenses, undoOp) } : t)),
      );
      setHighlightId(undoOp.highlightId ?? null);
    }
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now(), message: '已撤銷操作', undo: null });
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
        highlightId={highlightId}
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
    const effectiveDefaultDate = route.date || defaultExpenseDate(trip, today);
    body = (
      <AddForm
        key={`${trip.id}-${window.location.hash}`}
        initial={initial}
        defaultDate={effectiveDefaultDate}
        startScan={route.scan}
        people={trip.settings?.people || ['共同']}
        rate={trip.settings?.rate || 0.0526}
        onCancel={() => (window.history.state?.refPushed ? window.history.back() : go(returnTo, true))}
        onSave={saveExpense}
      />
    );
  } else if (route.screen === 'ledger') {
    body = (
      <Ledger
        trip={trip}
        highlightId={highlightId}
        onScan={() => openAdd({ scan: true, date: defaultExpenseDate(trip, today) })}
        onAdd={() => openAdd({ date: defaultExpenseDate(trip, today) })}
        onEdit={(e) => openAdd({ id: e.id })}
        onDelete={deleteExpense}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
      />
    );
  } else if (route.screen === 'charts') {
    body = <ChartsView trip={trip} onOpenDay={(iso) => openDay(iso, 'expenses')} />;
  } else if (route.screen === 'settings') {
    body = (
      <SettingsView
        trip={trip}
        trips={trips}
        onUpdateTrip={updateActiveTrip}
        onSelectTrip={selectTrip}
        onToast={showToast}
      />
    );
  } else {
    const homeDefaultDate = defaultExpenseDate(trip, today);
    body = (
      <Home
        trip={trip}
        today={today}
        month={month}
        setMonth={setMonth}
        onOpenDay={(iso) => openDay(iso)}
        onScan={() => openAdd({ scan: true, date: homeDefaultDate })}
        onAdd={() => openAdd({ date: homeDefaultDate })}
      />
    );
  }

  let tab = null;
  if (route.screen === 'home' || route.screen === 'day') tab = 'home';
  else if (route.screen === 'ledger') tab = 'ledger';
  else if (route.screen === 'charts') tab = 'charts';
  else if (route.screen === 'settings') tab = 'settings';
  else if (route.screen === 'add') tab = addOrigin.origin === 'ledger' ? 'ledger' : 'home';

  return (
    <div className="min-h-screen text-ink" style={paperDots}>
      <Header trip={trip} trips={trips} onSelectTrip={selectTrip} />
      <main className="mx-auto max-w-5xl pb-24">{body}</main>
      <Toast
        toast={toast}
        onUndo={handleUndo}
        onDismiss={() => setToast(null)}
        onHoverChange={setToastHover}
        onFocusChange={setToastFocus}
      />
      <BottomNav tab={tab} />
    </div>
  );
}

function Header({ trip, trips, onSelectTrip }) {
  const [open, setOpen] = useState(false);
  const menuWrapRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream-soft/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <button
          type="button"
          onClick={() => go('')}
          className="relative flex min-h-11 min-w-0 shrink items-center gap-3 rounded-2xl px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
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

        <div className="relative" ref={menuWrapRef}>
          <button
            ref={btnRef}
            type="button"
            data-testid="trip-switcher"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 min-h-11 min-w-11 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2 text-meta font-semibold text-ink-soft transition-colors hover:bg-white/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {Icon.globe('h-3.5 w-3.5 shrink-0')}
            <span>{trip.name}</span>
            {Icon.chevDown('h-3.5 w-3.5 shrink-0')}
          </button>

          {open && (
            <div
              role="menu"
              data-testid="trip-switcher-menu"
              className="absolute right-0 top-full z-40 mt-2 min-w-[230px] overflow-hidden rounded-card border border-line bg-cream-soft py-1.5 text-ink shadow-xl"
            >
              {trips.map((t) => {
                const isActive = t.id === trip.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    data-testid={`switch-trip-${t.id}`}
                    onClick={() => {
                      setOpen(false);
                      onSelectTrip(t.id);
                    }}
                    className={`flex min-h-11 w-full items-center justify-between whitespace-nowrap px-4 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
                      isActive ? 'bg-teal-soft font-semibold text-teal-strong' : 'text-ink hover:bg-beige/60'
                    }`}
                  >
                    <span>{t.name}</span>
                    {isActive && (
                      <span className="ml-2 shrink-0 rounded-pill bg-teal-soft px-2 py-0.5 text-meta font-bold text-teal-strong">
                        當前
                      </span>
                    )}
                  </button>
                );
              })}
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
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal ${
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
  const people = trip.settings?.people || ['共同'];
  const counts = useMemo(() => personCounts(trip.expenses, people), [trip.expenses, people]);
  const list = useMemo(() => filterExpenses(trip.expenses, { person }, people), [trip.expenses, person, people]);
  const total = list.reduce((s, e) => s + e.hkdAmount, 0);

  const byCat = useMemo(() => {
    const map = {};
    for (const c of REF_CATEGORIES) map[c] = { total: 0, count: 0 };
    for (const e of list) {
      const k = map[e.category] ? e.category : '其他';
      map[k].total += e.hkdAmount;
      map[k].count += 1;
    }
    return REF_CATEGORIES.map((c) => ({ cat: c, ...map[c] }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [list]);

  const byPerson = useMemo(
    () =>
      people.map((p) => {
        const items = trip.expenses.filter((e) => matchesPerson(e, p, people));
        return { person: p, count: items.length, total: items.reduce((s, e) => s + e.hkdAmount, 0) };
      }),
    [trip.expenses, people],
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
            {['全部', ...people].map((p) => (
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
                className="block min-h-11 w-full space-y-1 rounded-xl border border-line/60 bg-cream px-3 py-2.5 text-left transition-colors hover:bg-beige/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <div className="flex items-center justify-between text-meta">
                  <span className="truncate whitespace-nowrap font-bold text-ink">
                    {zhDate(d.iso)}
                    {dayTitle ? ` · ${dayTitle}` : ''}
                  </span>
                  <span className="ml-2 shrink-0 whitespace-nowrap font-mono font-semibold text-teal-strong">
                    {fmtHKD(d.total)}
                  </span>
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

function SettingsView({ trip, trips, onUpdateTrip, onSelectTrip, onToast }) {
  const people = trip.settings?.people || ['共同'];
  const currentRate = trip.settings?.rate || 0.0526;

  const [editingPerson, setEditingPerson] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [newPerson, setNewPerson] = useState('');
  const [personError, setPersonError] = useState('');
  const [rateInput, setRateInput] = useState(() => String(currentRate));
  const [rateError, setRateError] = useState('');

  useEffect(() => {
    setRateInput(String(currentRate));
    setRateError('');
  }, [currentRate, trip.id]);

  const totalHKD = trip.expenses.reduce((s, e) => s + e.hkdAmount, 0);
  const totalJPY = trip.expenses
    .filter((e) => (e.currency || e.originalCurrency) === 'JPY')
    .reduce((s, e) => s + e.originalAmount, 0);
  const counts = personCounts(trip.expenses, people);

  const handleRenameSubmit = (from) => {
    const clean = editingName.trim();
    if (!clean) {
      setPersonError('名稱不能為空');
      return;
    }
    if (clean !== from && people.includes(clean)) {
      setPersonError('人物名稱已存在');
      return;
    }
    const next = renamePerson(trip, from, clean);
    onUpdateTrip(next);
    setEditingPerson(null);
    setEditingName('');
    setPersonError('');
    if (clean !== from) onToast(`已將「${from}」改名為「${clean}」`);
  };

  const handleAddPerson = (e) => {
    if (e) e.preventDefault();
    const clean = newPerson.trim();
    if (!clean) {
      setPersonError('請輸入人物名稱');
      return;
    }
    if (people.includes(clean)) {
      setPersonError('人物名稱已存在');
      return;
    }
    onUpdateTrip((t) => addPerson(t, clean));
    setNewPerson('');
    setPersonError('');
    onToast(`已新增成員「${clean}」`);
  };

  const handleRemovePerson = (name) => {
    if (name === '共同') return;
    onUpdateTrip((t) => removePerson(t, name));
    setPersonError('');
    onToast(`已移除「${name}」，其消費已歸入共同`);
  };

  const parsedRate = parseRate(rateInput);
  const isRateInvalid = parsedRate === null;

  const handleSaveRate = (e) => {
    if (e) e.preventDefault();
    const r = parseRate(rateInput);
    if (r === null) {
      setRateError('請輸入大於 0 的匯率');
      return;
    }
    const recomputed = countRecomputed(trip);
    onUpdateTrip((t) => setRate(t, r));
    setRateError('');
    onToast(`匯率已更新 · 已重新計算 ${recomputed} 筆`);
  };

  const handleExportTrip = () => {
    const payload = exportTripJSON(trip);
    downloadTextFile(payload);
    onToast(`已下載 ${payload.filename}`);
  };

  const handleExportBackup = () => {
    const payload = exportBackupJSON(trips, new Date());
    downloadTextFile(payload);
    onToast(`已下載完整備份 ${payload.filename}`);
  };

  const handleCopyReport = async () => {
    const report = buildReport(trip);
    const ok = await copyTextToClipboard(report);
    if (ok) onToast('已複製報告');
    else onToast('複製報告失敗，請重試');
  };

  return (
    <div data-testid="page-settings" className="space-y-4 px-4 pb-10 pt-4">
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
        <div className="space-y-2">
          {trips.map((t) => {
            const active = t.id === trip.id;
            const tTotal = t.expenses.reduce((s, e) => s + e.hkdAmount, 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTrip(t.id)}
                className={`block min-h-11 w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                  active
                    ? 'border-teal/45 bg-teal-soft/65'
                    : 'border-line bg-cream hover:bg-beige/55'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="whitespace-nowrap text-sm font-bold text-teal-strong">{t.name}</span>
                  <span className="whitespace-nowrap text-meta font-semibold text-teal-strong">
                    {t.expenses.length} 筆記錄
                  </span>
                </div>
                <p className="mt-1 whitespace-nowrap text-meta text-ink-soft">
                  {t.startDate} – {t.endDate} · {fmtHKD(tTotal)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* People / Members */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">人物管理</h2>
        <div className="space-y-2">
          {people.map((p) => {
            const isShared = p === '共同';
            const isEditing = editingPerson === p;
            return (
              <div
                key={p}
                data-testid={`person-row-${p}`}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-line bg-cream px-3 py-1.5 text-sm"
              >
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <input
                      aria-label={`修改 ${p} 名稱`}
                      data-testid={`rename-input-${p}`}
                      value={editingName}
                      onChange={(e) => {
                        setEditingName(e.target.value);
                        setPersonError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRenameSubmit(p);
                        } else if (e.key === 'Escape') {
                          setEditingPerson(null);
                          setPersonError('');
                        }
                      }}
                      className="h-11 min-h-11 min-w-0 flex-1 rounded-xl border border-teal-strong bg-white px-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal"
                    />
                    <button
                      type="button"
                      data-testid={`rename-save-${p}`}
                      onClick={() => handleRenameSubmit(p)}
                      className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white"
                    >
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPerson(null);
                        setPersonError('');
                      }}
                      className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-2.5 text-meta font-semibold text-ink-soft"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <span className="whitespace-nowrap font-semibold text-ink">{p}</span>
                      <span className="ml-2 whitespace-nowrap text-meta font-medium text-ink-muted">
                        {counts[p] || 0} 筆記錄
                      </span>
                    </div>
                    {isShared ? (
                      <span className="whitespace-nowrap rounded-pill bg-beige px-2.5 py-1 text-meta font-semibold text-ink-muted">
                        預設
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          data-testid={`person-edit-${p}`}
                          aria-label={`改名 ${p}`}
                          onClick={() => {
                            setEditingPerson(p);
                            setEditingName(p);
                            setPersonError('');
                          }}
                          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                        >
                          改名
                        </button>
                        <button
                          type="button"
                          data-testid={`person-remove-${p}`}
                          aria-label={`移除 ${p}`}
                          onClick={() => handleRemovePerson(p)}
                          className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-coral-ink/30 bg-coral-soft px-2.5 text-meta font-semibold text-coral-ink hover:bg-coral-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink"
                        >
                          移除
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddPerson} className="flex items-center gap-2 pt-1">
          <input
            aria-label="新增人物名稱"
            data-testid="add-person-input"
            value={newPerson}
            onChange={(e) => {
              setNewPerson(e.target.value);
              setPersonError('');
            }}
            placeholder="新增成員名稱…"
            className="h-11 min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal"
          />
          <button
            type="submit"
            data-testid="add-person-btn"
            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-teal-strong px-4 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            ＋新增
          </button>
        </form>
        {personError && (
          <p role="alert" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
            {personError}
          </p>
        )}
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
        <form onSubmit={handleSaveRate} noValidate className="space-y-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-cream px-3 py-2">
            <label htmlFor="ref-rate-input" className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">
              1 JPY =
            </label>
            <input
              id="ref-rate-input"
              data-testid="rate-input"
              aria-label="匯率"
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => {
                const nextVal = e.target.value;
                setRateInput(nextVal);
                setRateError(parseRate(nextVal) === null ? '請輸入大於 0 的匯率' : '');
              }}
              className="h-11 min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-2.5 font-mono text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-teal"
            />
            <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-ink">HKD</span>
            <button
              type="submit"
              data-testid="rate-save"
              disabled={isRateInvalid}
              className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-50"
            >
              更新匯率
            </button>
          </div>
          {(isRateInvalid || rateError) && (
            <p role="alert" data-testid="rate-error" className="whitespace-nowrap text-meta font-semibold text-coral-ink">
              {rateError || '請輸入大於 0 的匯率'}
            </p>
          )}
        </form>
      </section>

      {/* Data & Export */}
      <section className="paper-panel space-y-2.5 p-4">
        <h2 className="whitespace-nowrap font-display text-lg text-ink">資料管理</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            data-testid="export-json"
            onClick={handleExportTrip}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            匯出 JSON
          </button>
          <button
            type="button"
            data-testid="export-backup"
            onClick={handleExportBackup}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            完整備份
          </button>
          <button
            type="button"
            data-testid="copy-report"
            onClick={handleCopyReport}
            className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream px-2 py-2.5 text-meta font-semibold text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            複製報告
          </button>
        </div>
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
