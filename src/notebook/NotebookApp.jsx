import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRefTrips } from '../proto/ref/mockRefTrip';
import { buildAddHash, parseRoute } from '../proto/ref/refLogic';
import {
  TOAST_DURATION_MS,
  applyUndo,
  defaultExpenseDate,
  defaultPayer,
  defaultPayment,
  makeUndo,
  postSaveTarget,
  resolveToday,
  saveToastMessage,
  shouldKeepToastOnRoute,
  switchTripRoute,
  tripMonth,
} from '../proto/ref/refRules';
import { ledgerHash } from '../proto/ref/refCharts';
import { normalizeDate } from '../utils/duplicates';
import { Icon, Sparkle, Toast, paperDots, washiNav } from '../proto/ref/parts';
import Home from '../proto/ref/Home';
import DayView from '../proto/ref/DayView';
import Ledger from '../proto/ref/Ledger';
import AddForm from '../proto/ref/AddForm';
import ChartsView from '../proto/ref/ChartsView';
import SettingsView from './SettingsView';
import { adaptTripForNotebook, mergeDayPatch } from './tripRate';

export const go = (hash, replace = false) => {
  if (typeof window === 'undefined') return;
  const url = `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ''}`;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState({ refPushed: true }, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

function currentWindowHash(initialHash = '') {
  if (typeof window === 'undefined') return initialHash;
  return window.location.hash;
}

function currentWindowSearch() {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

function useRoute(initialHash = '') {
  const [route, setRoute] = useState(() => parseRoute(currentWindowHash(initialHash)));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
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

/**
 * Presentation shell for the travel notebook redesign UI.
 * Used both by `NotebookShell` (with real `useApp()` data & handlers)
 * and by `?proto=notebook` (integrate preview mock without login) / unit tests.
 */
export default function NotebookApp({
  trip: controlledTrip,
  trips: controlledTrips,
  today: propToday,
  rate: propRate,
  initialHash = '',
  onSelectTrip,
  onUpdateDay,
  onSaveExpense,
  onDeleteExpense,
  onUndo,
  onUpdateTrip,
  onSaveBudget,
  onAddPerson,
  onRenamePerson,
  onRemovePerson,
  onSaveRate,
} = {}) {
  const isControlled = controlledTrip !== undefined;
  const today = useMemo(() => propToday || resolveToday(currentWindowSearch()), [propToday]);

  const [mockTrips, setMockTrips] = useState(() =>
    createRefTrips().map((t) => adaptTripForNotebook(t, { today })),
  );
  const [mockActiveTripId, setMockActiveTripId] = useState(() => createRefTrips()[0].id);

  const rawTrip = useMemo(() => {
    if (isControlled) return controlledTrip;
    return mockTrips.find((t) => String(t.id) === String(mockActiveTripId)) || mockTrips[0];
  }, [isControlled, controlledTrip, mockTrips, mockActiveTripId]);

  const trip = useMemo(() => adaptTripForNotebook(rawTrip, { today }), [rawTrip, today]);

  const trips = useMemo(() => {
    if (isControlled) {
      const list = Array.isArray(controlledTrips) && controlledTrips.length > 0 ? controlledTrips : [trip];
      return list.map((t) =>
        String(t?.id) === String(trip.id) ? trip : adaptTripForNotebook(t, { today }),
      );
    }
    return mockTrips.map((t) => (String(t.id) === String(trip.id) ? trip : adaptTripForNotebook(t, { today })));
  }, [isControlled, controlledTrips, mockTrips, trip, today]);

  const route = useRoute(initialHash);
  const [returnTo, setReturnTo] = useState('');
  const [addOrigin, setAddOrigin] = useState(() => ({ origin: 'home', originDay: null }));
  const [month, setMonth] = useState(() => tripMonth(trip, today));
  const [toast, setToast] = useState(null);
  const [toastHover, setToastHover] = useState(false);
  const [toastFocus, setToastFocus] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  const prevTripIdRef = useRef(String(trip.id));
  useEffect(() => {
    if (String(trip.id) !== prevTripIdRef.current) {
      prevTripIdRef.current = String(trip.id);
      setMonth(tripMonth(trip, today));
    }
  }, [trip, today]);

  const updateActiveMockTrip = useCallback(
    (updater) => {
      if (isControlled) {
        onUpdateTrip?.(updater);
        return;
      }
      setMockTrips((prev) =>
        prev.map((t) =>
          String(t.id) === String(mockActiveTripId)
            ? typeof updater === 'function'
              ? updater(t)
              : updater
            : t,
        ),
      );
    },
    [isControlled, mockActiveTripId, onUpdateTrip],
  );

  const showToast = useCallback((message, undo = null) => {
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now() + Math.random(), message, undo });
  }, []);

  const toastPaused = toastHover || toastFocus;
  const prevScreenRef = useRef(route.screen);

  useEffect(() => {
    const prevScreen = prevScreenRef.current;
    prevScreenRef.current = route.screen;
    if (!shouldKeepToastOnRoute(prevScreen, route.screen)) {
      setToast(null);
      setToastHover(false);
      setToastFocus(false);
    }
  }, [route.screen]);

  useEffect(() => {
    if (!toast || toastPaused) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, toastPaused]);

  useEffect(() => {
    if (route.screen === 'ledger' && route.focus) {
      const matched = trip.expenses.find((e) => String(e.id) === String(route.focus));
      setHighlightId(matched ? matched.id : route.focus);
    }
  }, [route.screen, route.focus, trip.expenses]);

  useEffect(() => {
    if (!highlightId || typeof window === 'undefined') return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
      const currentHash = currentWindowHash().replace(/^#/, '');
      const currentRoute = parseRoute(currentHash);
      if (!shouldKeepToastOnRoute(currentRoute.screen, 'add')) {
        setToast(null);
        setToastHover(false);
        setToastFocus(false);
      }
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
      const target = trips.find((t) => String(t.id) === String(nextTripId));
      if (!target) return;
      if (String(target.id) === String(trip.id)) return;
      if (onSelectTrip) {
        onSelectTrip(target.id);
      } else {
        setMockActiveTripId(target.id);
      }
      setMonth(tripMonth(target, today));
      const curHash = currentWindowHash();
      const nextHash = switchTripRoute(curHash, target);
      if (nextHash !== curHash.replace(/^#/, '')) {
        go(nextHash, true);
      }
      showToast(`已切換至 ${target.name}`);
    },
    [trips, trip.id, today, onSelectTrip, showToast],
  );

  const updateDay = useCallback(
    (iso, patch) => {
      if (onUpdateDay) {
        onUpdateDay(iso, patch);
        return;
      }
      updateActiveMockTrip((t) => ({
        ...t,
        days: mergeDayPatch(t.days, iso, patch),
      }));
    },
    [onUpdateDay, updateActiveMockTrip],
  );

  const deleteExpense = useCallback(
    (e) => {
      const tripId = trip.id;
      const idx = trip.expenses.findIndex((x) => String(x.id) === String(e.id));
      const undoOp = makeUndo('delete', {
        expense: e,
        index: idx >= 0 ? idx : trip.expenses.length,
      });
      if (onDeleteExpense) {
        onDeleteExpense(e);
      } else {
        updateActiveMockTrip((t) => ({
          ...t,
          expenses: t.expenses.filter((x) => String(x.id) !== String(e.id)),
        }));
      }
      showToast(saveToastMessage({ kind: 'delete', expense: e }), {
        ...undoOp,
        tripId,
        highlightId: e.id,
      });
    },
    [trip.id, trip.expenses, onDeleteExpense, updateActiveMockTrip, showToast],
  );

  const saveExpense = useCallback(
    (data) => {
      const tripId = trip.id;
      const isEdit = Boolean(data.id);
      const previousRecord = isEdit
        ? trip.expenses.find((x) => String(x.id) === String(data.id)) || null
        : null;
      const normalizedDate = data.date ? normalizeDate(data.date) || '' : '';

      let savedRecord;
      let savedId;

      if (onSaveExpense) {
        const res = onSaveExpense(data);
        savedRecord = res?.savedRecord || {
          ...(previousRecord || {}),
          ...data,
          id: previousRecord ? previousRecord.id : data.id || `n${Date.now()}`,
          date: normalizedDate,
        };
        savedId = savedRecord.id;
      } else {
        savedId = isEdit && previousRecord ? previousRecord.id : data.id || `n${Date.now()}`;
        savedRecord = isEdit
          ? {
              ...(previousRecord || {}),
              ...data,
              id: savedId,
              date: normalizedDate,
              ...(previousRecord?.createdAt !== undefined ? { createdAt: previousRecord.createdAt } : {}),
            }
          : { ...data, id: savedId, date: normalizedDate, createdAt: new Date().toISOString(), items: [] };

        const nextLastPayment =
          data.payment === 'cash' || data.payment === 'card' ? data.payment : undefined;

        updateActiveMockTrip((t) => {
          const patch = nextLastPayment ? { lastPayment: nextLastPayment } : {};
          if (isEdit) {
            return {
              ...t,
              ...patch,
              expenses: t.expenses.map((x) => (String(x.id) === String(savedId) ? savedRecord : x)),
            };
          }
          return { ...t, ...patch, expenses: [...t.expenses, savedRecord] };
        });
      }

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
    },
    [trip.id, trip.expenses, addOrigin.origin, onSaveExpense, updateActiveMockTrip, showToast],
  );

  const handleUndo = () => {
    if (!toast?.undo) return;
    if (typeof toast.undo === 'function') {
      toast.undo();
    } else if (onUndo) {
      onUndo(toast.undo);
      setHighlightId(toast.undo.highlightId ?? null);
    } else {
      const undoOp = toast.undo;
      const targetTripId = undoOp.tripId || trip.id;
      setMockTrips((all) =>
        all.map((t) =>
          String(t.id) === String(targetTripId) ? { ...t, expenses: applyUndo(t.expenses, undoOp) } : t,
        ),
      );
      setHighlightId(undoOp.highlightId ?? null);
    }
    setToastHover(false);
    setToastFocus(false);
    setToast({ id: Date.now(), message: '已撤銷操作', undo: null });
  };

  const effectiveRate = propRate || trip.settings?.rate || 0.0526;

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
        onBack={() =>
          typeof window !== 'undefined' && window.history.state?.refPushed ? window.history.back() : go('', true)
        }
        onDay={(iso) => go(`day=${iso}&pane=${route.pane}`, true)}
        onUpdateDay={updateDay}
        onScan={(date) => openAdd({ scan: true, date })}
        onAdd={(date) => openAdd({ date })}
        onEditExpense={(e) => openAdd({ id: e.id })}
        onDeleteExpense={deleteExpense}
      />
    );
  } else if (route.screen === 'add') {
    const initial = route.expenseId
      ? trip.expenses.find((e) => String(e.id) === String(route.expenseId)) || null
      : null;
    const effectiveDefaultDate = route.date || defaultExpenseDate(trip, today);
    const people = trip.settings?.people || ['共同'];
    body = (
      <AddForm
        key={`${trip.id}-${currentWindowHash(initialHash)}`}
        initial={initial}
        defaultDate={effectiveDefaultDate}
        startScan={route.scan}
        people={people}
        rate={effectiveRate}
        payerDefault={defaultPayer(people)}
        paymentDefault={defaultPayment(trip)}
        onCancel={() =>
          typeof window !== 'undefined' && window.history.state?.refPushed
            ? window.history.back()
            : go(returnTo, true)
        }
        onSave={saveExpense}
      />
    );
  } else if (route.screen === 'ledger') {
    body = (
      <Ledger
        key={currentWindowHash(initialHash)}
        trip={trip}
        initialFilters={route.filters}
        highlightId={highlightId}
        onScan={() => openAdd({ scan: true, date: defaultExpenseDate(trip, today) })}
        onAdd={() => openAdd({ date: defaultExpenseDate(trip, today) })}
        onEdit={(e) => openAdd({ id: e.id })}
        onDelete={deleteExpense}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
      />
    );
  } else if (route.screen === 'charts') {
    body = (
      <ChartsView
        trip={trip}
        today={today}
        onOpenDay={(iso) => openDay(iso, 'expenses')}
        onOpenLedger={(f) => go(ledgerHash(f))}
      />
    );
  } else if (route.screen === 'settings') {
    body = (
      <SettingsView
        trip={trip}
        trips={trips}
        onUpdateTrip={updateActiveMockTrip}
        onSelectTrip={selectTrip}
        onSaveBudget={onSaveBudget}
        onAddPerson={onAddPerson}
        onRenamePerson={onRenamePerson}
        onRemovePerson={onRemovePerson}
        onSaveRate={onSaveRate}
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
        aboveSaveBar={route.screen === 'add'}
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
    if (!open || typeof document === 'undefined') return undefined;
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
                const isActive = String(t.id) === String(trip.id);
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
