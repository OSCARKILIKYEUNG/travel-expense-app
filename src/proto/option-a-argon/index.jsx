import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createMockTrip,
  DEMO_TODAY,
  MOCK_CATEGORIES,
} from '../shared/mockTrip';
import {
  addDays,
  monthGrid,
  parseISODate,
  tripDayIndex,
} from '../shared/dates';
import { CornerBlob, Sakura, Sparkle } from '../../components/ui/Doodles';
import {
  CategoryIcon,
  FujiHeroDoodle,
  KindBadgeIcon,
  PostalStamp,
  ReceiptZigZagEdge,
  WashiTape,
} from './doodles';
import ExpenseFormModal from './ExpenseFormModal';
import { capCellNote, dayCounter, spendOnDate } from '../shared/display';

const HASH_PREFIX = String.fromCharCode(35);
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];
const PANE_ORDER = ['expenses', 'overview', 'itinerary'];

const KIND_LABELS = {
  food: '美食',
  sight: '景點',
  transport: '交通',
  stay: '住宿',
  shop: '購物',
};

function resolveInitialToday() {
  if (typeof window === 'undefined') return DEMO_TODAY;
  const param = new URLSearchParams(window.location.search).get('today');
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  return DEMO_TODAY;
}

function parseHashState(rawHash, fallbackDate) {
  const cleaned = String(rawHash || '').replace(/^[^a-zA-Z0-9]+/, '');
  if (!cleaned || cleaned === 'home') {
    return { screen: 'home', date: fallbackDate, pane: 'overview', add: false };
  }
  if (cleaned === 'add' || cleaned.startsWith('add&')) {
    const params = new URLSearchParams(cleaned.replace(/^add&?/, ''));
    const dayParam = params.get('day');
    const validDay = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : fallbackDate;
    return { screen: 'home', date: validDay, pane: 'overview', add: true };
  }
  const params = new URLSearchParams(cleaned);
  const dayParam = params.get('day');
  const paneParam = params.get('pane');
  const validPane = PANE_ORDER.includes(paneParam) ? paneParam : 'overview';
  const isAdd = params.has('add') || cleaned.includes('add');
  if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    return {
      screen: 'day',
      date: dayParam,
      pane: validPane,
      add: isAdd,
    };
  }
  if (PANE_ORDER.includes(paneParam)) {
    return {
      screen: 'day',
      date: fallbackDate,
      pane: validPane,
      add: isAdd,
    };
  }
  return { screen: 'home', date: fallbackDate, pane: 'overview', add: isAdd };
}

function formatHkd(num) {
  return Number(num || 0).toLocaleString('en-HK', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatShortDate(iso) {
  if (!iso) return '';
  const dt = parseISODate(iso);
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  const wk = ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()];
  return `${m}月${d}日 (${wk})`;
}

export default function OptionAArgonPrototype() {
  const today = useMemo(() => resolveInitialToday(), []);
  const [trip, setTrip] = useState(() => createMockTrip());

  const initialNav = useMemo(
    () => parseHashState(typeof window !== 'undefined' ? window.location.hash : '', today),
    [today]
  );

  const [screen, setScreen] = useState(initialNav.screen);
  const [selectedDate, setSelectedDate] = useState(initialNav.date || today);
  const [activePane, setActivePane] = useState(initialNav.pane || 'overview');
  const [isFormOpen, setIsFormOpen] = useState(initialNav.add);
  const [editingExpense, setEditingExpense] = useState(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  // Day note inline editing state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  // New itinerary item state
  const [showAddItinerary, setShowAddItinerary] = useState(false);
  const [newStopTime, setNewStopTime] = useState('14:30');
  const [newStopTitle, setNewStopTitle] = useState('');
  const [newStopPlace, setNewStopPlace] = useState('');
  const [newStopKind, setNewStopKind] = useState('sight');

  const syncHash = useCallback((nextScreen, nextDate, nextPane, nextAdd = false) => {
    if (typeof window === 'undefined') return;
    let nextHash = '';
    if (nextAdd) {
      nextHash = `${HASH_PREFIX}add`;
    } else if (nextScreen === 'day') {
      nextHash = `${HASH_PREFIX}day=${nextDate}&pane=${nextPane}`;
    }
    const targetUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, '', targetUrl);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHashState(window.location.hash, selectedDate || today);
      if (parsed.add) {
        if (parsed.date) setSelectedDate(parsed.date);
        setEditingExpense(null);
        setIsFormOpen(true);
        return;
      }
      setIsFormOpen(false);
      setScreen(parsed.screen);
      if (parsed.date) setSelectedDate(parsed.date);
      setActivePane(parsed.pane);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [selectedDate, today]);

  // Computed trip totals
  const totalHkd = useMemo(
    () =>
      Math.round(
        trip.expenses.reduce((sum, exp) => sum + Number(exp.hkdAmount || 0), 0) * 10
      ) / 10,
    [trip.expenses]
  );

  const totalJpy = useMemo(
    () =>
      trip.expenses.reduce(
        (sum, exp) =>
          (exp.originalCurrency || exp.currency) === 'JPY'
            ? sum + Number(exp.originalAmount || 0)
            : sum + Math.round(Number(exp.hkdAmount || 0) / 0.052),
        0
      ),
    [trip.expenses]
  );

  const budgetPct = useMemo(
    () => Math.min(100, Math.round((totalHkd / (trip.budgetHkd || 12000)) * 100)),
    [totalHkd, trip.budgetHkd]
  );

  const expensesByDate = useMemo(() => {
    const map = {};
    for (const exp of trip.expenses) {
      if (!map[exp.date]) map[exp.date] = [];
      map[exp.date].push(exp);
    }
    return map;
  }, [trip.expenses]);

  const todayDayNum = useMemo(() => tripDayIndex(trip, today) || 5, [trip, today]);
  const totalTripDays = useMemo(
    () => tripDayIndex(trip, trip.endDate) || 9,
    [trip]
  );

  const todayData = trip.days?.[today] || { note: '東京探索', itinerary: [] };
  const todayMainItinerary = useMemo(() => {
    const list = todayData.itinerary || [];
    return list.find((item) => !item.done) || list[0] || {
      time: '11:30',
      title: 'teamLab',
      place: '豐洲',
    };
  }, [todayData]);

  const calendarWeeks = useMemo(() => monthGrid(today), [today]);

  // Current selected day data
  const selectedDayNum = useMemo(
    () => tripDayIndex(trip, selectedDate),
    [trip, selectedDate]
  );
  const selectedDayObj = useMemo(
    () => trip.days?.[selectedDate] || { note: '自由探索', itinerary: [] },
    [trip.days, selectedDate]
  );
  const selectedDayExpenses = useMemo(
    () => expensesByDate[selectedDate] || [],
    [expensesByDate, selectedDate]
  );
  const selectedDayHkd = useMemo(
    () =>
      Math.round(
        selectedDayExpenses.reduce((sum, e) => sum + Number(e.hkdAmount || 0), 0) * 10
      ) / 10,
    [selectedDayExpenses]
  );
  const selectedDayJpy = useMemo(
    () =>
      selectedDayExpenses.reduce(
        (sum, e) =>
          (e.originalCurrency || e.currency) === 'JPY'
            ? sum + Number(e.originalAmount || 0)
            : sum + Math.round(Number(e.hkdAmount || 0) / 0.052),
        0
      ),
    [selectedDayExpenses]
  );

  // Navigation handlers
  const openDayView = useCallback(
    (isoDate, pane = 'overview') => {
      setSelectedDate(isoDate);
      setActivePane(pane);
      setScreen('day');
      setIsEditingNote(false);
      setShowAddItinerary(false);
      syncHash('day', isoDate, pane, false);
    },
    [syncHash]
  );

  const openHome = useCallback(() => {
    setScreen('home');
    setIsEditingNote(false);
    syncHash('home', selectedDate, activePane, false);
  }, [selectedDate, activePane, syncHash]);

  const switchPane = useCallback(
    (nextPane) => {
      if (!PANE_ORDER.includes(nextPane)) return;
      setActivePane(nextPane);
      setDragOffsetX(0);
      syncHash('day', selectedDate, nextPane, false);
    },
    [selectedDate, syncHash]
  );

  const openAddForm = useCallback(
    (targetDate = selectedDate) => {
      if (targetDate) setSelectedDate(targetDate);
      setEditingExpense(null);
      setIsFormOpen(true);
      syncHash(screen, targetDate || selectedDate, activePane, true);
    },
    [screen, selectedDate, activePane, syncHash]
  );

  const openEditForm = useCallback((expense) => {
    setSelectedDate(expense.date);
    setEditingExpense(expense);
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingExpense(null);
    syncHash(screen, selectedDate, activePane, false);
  }, [screen, selectedDate, activePane, syncHash]);

  const handleSaveExpense = useCallback(
    (savedExpense) => {
      setTrip((prev) => {
        const exists = prev.expenses.some((e) => e.id === savedExpense.id);
        const nextExpenses = exists
          ? prev.expenses.map((e) => (e.id === savedExpense.id ? savedExpense : e))
          : [savedExpense, ...prev.expenses];
        return {
          ...prev,
          expenses: nextExpenses,
        };
      });
      setSelectedDate(savedExpense.date);
      setIsFormOpen(false);
      setEditingExpense(null);
      syncHash(screen, savedExpense.date, activePane, false);
    },
    [screen, activePane, syncHash]
  );

  const handleDeleteExpense = useCallback(
    (expenseId) => {
      setTrip((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
      setIsFormOpen(false);
      setEditingExpense(null);
      syncHash(screen, selectedDate, activePane, false);
    },
    [screen, selectedDate, activePane, syncHash]
  );

  const handleToggleItineraryDone = useCallback((isoDate, itemId) => {
    setTrip((prev) => {
      const dayEntry = prev.days?.[isoDate] || { note: '', itinerary: [] };
      const nextList = (dayEntry.itinerary || []).map((it) =>
        it.id === itemId ? { ...it, done: !it.done } : it
      );
      return {
        ...prev,
        days: {
          ...prev.days,
          [isoDate]: {
            ...dayEntry,
            itinerary: nextList,
          },
        },
      };
    });
  }, []);

  const handleSaveDayNote = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const trimmed = noteDraft.trim() || '自由探索';
      setTrip((prev) => {
        const dayEntry = prev.days?.[selectedDate] || { note: '', itinerary: [] };
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDate]: {
              ...dayEntry,
              note: trimmed,
            },
          },
        };
      });
      setIsEditingNote(false);
    },
    [noteDraft, selectedDate]
  );

  const handleAddItineraryStop = useCallback(
    (e) => {
      if (e) e.preventDefault();
      const cleanTitle = newStopTitle.trim();
      if (!cleanTitle) return;
      const newStop = {
        id: `it-${Date.now()}`,
        time: newStopTime || '14:30',
        title: cleanTitle,
        place: newStopPlace.trim() || selectedDayObj.note || '東京',
        kind: newStopKind,
        done: false,
      };
      setTrip((prev) => {
        const dayEntry = prev.days?.[selectedDate] || { note: '東京', itinerary: [] };
        const nextItinerary = [...(dayEntry.itinerary || []), newStop].sort((a, b) =>
          String(a.time).localeCompare(String(b.time))
        );
        return {
          ...prev,
          days: {
            ...prev.days,
            [selectedDate]: {
              ...dayEntry,
              itinerary: nextItinerary,
            },
          },
        };
      });
      setNewStopTitle('');
      setNewStopPlace('');
      setShowAddItinerary(false);
    },
    [newStopTime, newStopTitle, newStopPlace, newStopKind, selectedDate, selectedDayObj.note]
  );

  // Real Touch & Pointer Swipe Gesture State (Horizontal-vs-Vertical Disambiguation)
  const gestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    axis: null,
  });

  const beginSwipe = (clientX, clientY, target) => {
    if (target && target.closest('input, textarea, select')) return;
    gestureRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastY: clientY,
      axis: null,
    };
  };

  const moveSwipe = (clientX, clientY) => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.lastX = clientX;
    g.lastY = clientY;
    const dx = clientX - g.startX;
    const dy = clientY - g.startY;

    if (!g.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      g.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (g.axis === 'x') {
      const clamped = Math.max(-110, Math.min(110, dx * 0.45));
      setDragOffsetX(clamped);
    }
  };

  const finishSwipe = (endClientX, endClientY) => {
    const g = gestureRef.current;
    if (!g.active) return;
    const finalX = typeof endClientX === 'number' ? endClientX : g.lastX;
    const finalY = typeof endClientY === 'number' ? endClientY : g.lastY;
    const dx = finalX - g.startX;
    const dy = finalY - g.startY;
    g.active = false;
    setDragOffsetX(0);

    // Horizontal vs vertical disambiguation: must be predominantly horizontal and >= 40px
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      const currentIdx = PANE_ORDER.indexOf(activePane);
      if (dx < 0) {
        // Swipe LEFT -> move toward 'itinerary' (index + 1)
        const nextIdx = Math.min(PANE_ORDER.length - 1, currentIdx + 1);
        if (nextIdx !== currentIdx) switchPane(PANE_ORDER[nextIdx]);
      } else if (dx > 0) {
        // Swipe RIGHT -> move toward 'expenses' (index - 1)
        const prevIdx = Math.max(0, currentIdx - 1);
        if (prevIdx !== currentIdx) switchPane(PANE_ORDER[prevIdx]);
      }
    }
  };

  const handlePointerDown = (e) => {
    beginSwipe(e.clientX, e.clientY, e.target);
  };

  const handlePointerMove = (e) => {
    moveSwipe(e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => {
    finishSwipe(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    beginSwipe(t.clientX, t.clientY, e.target);
  };

  const handleTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    moveSwipe(t.clientX, t.clientY);
  };

  const handleTouchEnd = (e) => {
    const t = e.changedTouches?.[0];
    finishSwipe(t?.clientX, t?.clientY);
  };

  return (
    <div className="relative min-h-screen bg-cream text-ink pb-28 overflow-x-hidden select-none sm:select-auto">
      {/* Background decorative hand-drawn blobs & sakura */}
      <CornerBlob className="fixed -left-20 -top-24 h-64 w-64 opacity-60" tone="sage" />
      <CornerBlob className="fixed -right-24 top-56 h-72 w-72 opacity-50" tone="sakura" />
      <Sparkle className="fixed right-6 top-8 h-4 w-4" />
      <Sakura className="fixed left-4 bottom-24 h-6 w-6 opacity-75" />

      {/* Main single-column travel notebook shell (fits 375px & 390px cleanly) */}
      <div className="relative z-10 mx-auto w-full max-w-md px-1.5 sm:px-4 pt-3">
        {/* Top Notebook Masthead */}
        <header className="relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-2xl bg-cream-soft/90 border border-line mb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-script text-base text-teal-strong leading-none whitespace-nowrap">
                Tabi Techo · 旅の手帖
              </span>
              <span className="px-2 py-0.5 rounded-pill bg-mustard-soft text-mustard-ink text-meta font-semibold whitespace-nowrap">
                東京 9日
              </span>
            </div>
            <h1 className="font-display text-xl text-ink leading-tight mt-0.5 whitespace-nowrap">
              {trip.name}
            </h1>
          </div>

          <FujiHeroDoodle className="w-28 h-12 shrink-0" />
        </header>

        {/* ===================== HOME SCREEN ===================== */}
        {screen === 'home' && (
          <main data-testid="home" className="space-y-3 animate-fade-in">
            {/* Above-Calendar Travel Diary Summary Postcard */}
            <section
              aria-label="旅程摘要"
              className="relative rounded-card bg-cream-soft border-2 border-line px-3 py-3 shadow-sm"
            >
              <WashiTape
                tone="sakura"
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-24"
                rotate="-rotate-1"
              />

              {/* Row 1: Total Spend (HKD) + Day N Postal Stamp */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-meta font-semibold text-ink-muted whitespace-nowrap">
                      旅程累積總支出
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-teal-soft text-teal-strong text-meta font-bold whitespace-nowrap">
                      {trip.expenses.length} 筆收據
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="font-display text-2xl text-ink whitespace-nowrap">
                      HK$ {formatHkd(totalHkd)}
                    </span>
                    <span className="text-xs font-semibold text-ink-muted whitespace-nowrap">
                      (¥{totalJpy.toLocaleString()})
                    </span>
                  </div>
                  <div className="text-meta font-semibold text-ink-soft whitespace-nowrap mt-0.5">
                    今日支出 HK$ {formatHkd(spendOnDate(trip.expenses, today))}
                  </div>
                </div>

                {/* Day N Stamp Pill (clickable to open Today's Day View) */}
                <button
                  type="button"
                  onClick={() => openDayView(today, 'overview')}
                  className="group flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-mustard-soft border-2 border-mustard-ink/35 hover:bg-mustard transition-colors shrink-0"
                >
                  <PostalStamp
                    topText="TOKYO"
                    mainText={`DAY ${todayDayNum}`}
                    subText={today.slice(5).replace('-', '.')}
                    tone="coral-ink"
                    className="w-9 h-9 shrink-0"
                  />
                  <div className="text-left">
                    <span className="block font-display text-sm text-coral-ink leading-tight whitespace-nowrap">
                      Day {todayDayNum} · {todayData.note}
                    </span>
                    <span className="block text-meta text-mustard-ink font-semibold whitespace-nowrap">
                      {dayCounter(trip, today).label}
                    </span>
                  </div>
                </button>
              </div>

              {/* Row 2: Budget Progress Bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between gap-2 text-meta mb-1">
                  <span className="text-ink-soft font-medium whitespace-nowrap">
                    預算進度 {budgetPct}% (上限 HK$ {(trip.budgetHkd || 12000).toLocaleString()})
                  </span>
                  <span className="text-teal-strong font-semibold whitespace-nowrap">
                    尚餘 HK$ {formatHkd(Math.max(0, (trip.budgetHkd || 12000) - totalHkd))}
                  </span>
                </div>
                <div className="h-2 w-full rounded-pill bg-beige overflow-hidden">
                  <div
                    className="h-full rounded-pill bg-teal-strong transition-all duration-300"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>

              {/* Row 3: Today's Main Itinerary Item Ticket Strip */}
              <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-2 rounded-2xl bg-cream border border-line">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-pill bg-coral-soft text-coral-ink text-meta font-bold whitespace-nowrap">
                    今日主行程
                  </span>
                  <span className="font-mono text-xs font-bold text-teal-strong whitespace-nowrap">
                    {todayMainItinerary.time}
                  </span>
                  <span className="font-display text-sm text-ink whitespace-nowrap">
                    {todayMainItinerary.title}
                  </span>
                  <span className="text-meta text-ink-muted whitespace-nowrap">
                    · {todayMainItinerary.place}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openDayView(today, 'itinerary')}
                  className="px-2 py-1 rounded-xl bg-teal-soft text-teal-strong text-meta font-bold hover:bg-teal-strong hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  看行程 →
                </button>
              </div>
            </section>

            {/* Month Calendar Card (`data-testid="calendar"`) */}
            <section
              data-testid="calendar"
              aria-label="十月行程月曆"
              className="relative rounded-card bg-cream-soft border-2 border-line px-1 py-2.5 sm:p-3.5 shadow-sm"
            >
              <WashiTape
                tone="teal-soft"
                className="absolute -top-2.5 right-6 h-5 w-20"
                rotate="rotate-2"
              />

              {/* Calendar Header */}
              <div className="flex items-center justify-between gap-1.5 px-1.5 mb-2">
                <div className="flex items-baseline gap-1.5">
                  <h2 className="font-display text-lg text-ink whitespace-nowrap">
                    2026年 10月
                  </h2>
                  <span className="font-script text-base text-teal-strong whitespace-nowrap">
                    October
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-mustard-soft border border-line text-mustard-ink text-meta font-semibold whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-coral-ink" />
                    點選日期看手記
                  </span>
                </div>
              </div>

              {/* Weekday Headers (Mon - Sun) */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5 mb-1 px-0.5">
                {WEEKDAY_LABELS.map((wk, idx) => (
                  <div
                    key={wk}
                    className={`text-center text-meta font-bold py-1 rounded-lg whitespace-nowrap ${
                      idx >= 5 ? 'text-coral-ink bg-coral-soft/45' : 'text-ink-muted bg-cream/60'
                    }`}
                  >
                    週{wk}
                  </div>
                ))}
              </div>

              {/* Calendar Weeks Grid */}
              <div className="space-y-1">
                {calendarWeeks.map((week, wIdx) => (
                  <div key={`week-${wIdx}`} className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
                    {week.map((iso, dIdx) => {
                      if (!iso) {
                        return (
                          <div
                            key={`empty-${wIdx}-${dIdx}`}
                            className="h-14 sm:h-16 rounded-xl bg-cream/40 border border-transparent"
                          />
                        );
                      }

                      const dayNum = Number(iso.slice(8));
                      const tIdx = tripDayIndex(trip, iso);
                      const isTripDay = tIdx !== null;
                      const isToday = iso === today;
                      const isSelected = iso === selectedDate;
                      const dayNote = trip.days?.[iso]?.note || '';
                      const dayExps = expensesByDate[iso] || [];
                      const hasExpenses = dayExps.length > 0;

                      let cellBg = 'bg-cream/65 border-line/60 text-ink-muted hover:bg-beige/60';
                      if (isTripDay) {
                        cellBg = 'bg-cream-soft border-line text-ink hover:bg-mustard-soft/70';
                      }
                      if (isSelected && !isToday) {
                        cellBg = 'bg-teal-soft border-teal-strong text-ink';
                      }
                      if (isToday) {
                        cellBg = 'bg-mustard-soft border-coral-ink ring-1 ring-coral-ink text-ink';
                      }

                      return (
                        <button
                          key={iso}
                          type="button"
                          data-testid={`day-cell-${iso}`}
                          onClick={() => openDayView(iso, 'overview')}
                          className={`group relative h-14 sm:h-16 w-full px-0 py-1 rounded-xl border flex flex-col items-center justify-between transition-all ${cellBg}`}
                        >
                          {/* Top row inside cell: day number + indicator dot */}
                          <div className="w-full flex items-center justify-between px-1">
                            <span
                              className={`font-display text-xs leading-none whitespace-nowrap ${
                                isToday
                                  ? 'text-coral-ink font-bold'
                                  : isTripDay
                                  ? 'text-ink font-semibold'
                                  : 'text-ink-muted'
                              }`}
                            >
                              {dayNum}
                            </span>
                            {isToday ? (
                              <span className="px-1 rounded bg-coral-ink text-white text-meta leading-none font-bold whitespace-nowrap">
                                今
                              </span>
                            ) : hasExpenses ? (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-teal-strong shrink-0"
                                title={`共 ${dayExps.length} 筆消費`}
                              />
                            ) : isTripDay ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-mustard shrink-0" />
                            ) : null}
                          </div>

                          {/* Middle/Bottom inside cell: ONE-LINE note without ellipsis */}
                          {dayNote ? (
                            <span
                              className={`block w-full text-center text-meta leading-tight tracking-tighter whitespace-nowrap ${
                                isToday
                                  ? 'font-bold text-coral-ink'
                                  : 'font-semibold text-teal-strong'
                              }`}
                            >
                              {capCellNote(dayNote)}
                            </span>
                          ) : (
                            <span className="block text-meta leading-tight text-ink-muted/40 whitespace-nowrap">
                              ·
                            </span>
                          )}

                          {/* Bottom micro bar showing trip day or spend */}
                          <div className="w-full flex items-center justify-center">
                            {isTripDay ? (
                              <span className="text-meta leading-none text-ink-muted tracking-tighter whitespace-nowrap">
                                D{tIdx}
                              </span>
                            ) : (
                              <span className="h-2" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Quick Trip Days Strip beneath Calendar */}
              <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between gap-2 px-1">
                <span className="text-meta text-ink-soft font-medium whitespace-nowrap">
                  🗾 賞楓行程：10/19 (D1) – 10/27 (D9)
                </span>
                <button
                  type="button"
                  onClick={() => openDayView(today, 'overview')}
                  className="px-2.5 py-1 rounded-xl bg-teal-strong text-white text-meta font-semibold hover:bg-ink transition-colors whitespace-nowrap"
                >
                  打開今日手記 (D{todayDayNum}) →
                </button>
              </div>
            </section>

            {/* Category Spend Breakdown & Latest Receipts Strip on Home */}
            <section className="rounded-card bg-cream-soft border border-line p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm text-ink whitespace-nowrap">
                  分類帳目一覽 (HKD)
                </h3>
                <button
                  type="button"
                  onClick={() => openAddForm(today)}
                  className="px-2.5 py-1 rounded-xl bg-coral-soft text-coral-ink text-meta font-bold hover:bg-coral-ink hover:text-white transition-colors whitespace-nowrap"
                >
                  + 快速記一筆
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {MOCK_CATEGORIES.map((cat) => {
                  const catSum =
                    Math.round(
                      trip.expenses
                        .filter((e) => e.category === cat)
                        .reduce((s, e) => s + Number(e.hkdAmount || 0), 0) * 10
                    ) / 10;
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-xl bg-cream border border-line"
                    >
                      <div className="flex items-center gap-1">
                        <CategoryIcon category={cat} className="w-4 h-4 shrink-0" />
                        <span className="text-meta font-semibold text-ink whitespace-nowrap">
                          {cat}
                        </span>
                      </div>
                      <span className="text-meta font-bold text-teal-strong whitespace-nowrap">
                        ${catSum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        )}

        {/* ===================== DAY VIEW SCREEN ===================== */}
        {screen === 'day' && (
          <main data-testid="day-view" className="space-y-2.5 animate-fade-in">
            {/* Day View Top Navigation & Day Switcher Card */}
            <section className="rounded-card bg-cream-soft border-2 border-line p-2.5">
              <div className="flex items-center justify-between gap-1.5">
                {/* Back to Calendar button (`data-testid="back"`) */}
                <button
                  type="button"
                  data-testid="back"
                  onClick={openHome}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-beige text-ink font-semibold text-xs hover:bg-line transition-colors whitespace-nowrap shrink-0"
                >
                  <span>←</span>
                  <span className="whitespace-nowrap">月曆</span>
                </button>

                {/* Prev / Current Day / Next switcher */}
                <div className="flex items-center gap-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => openDayView(addDays(selectedDate, -1), activePane)}
                    aria-label="前一天"
                    className="w-7 h-7 rounded-lg bg-cream border border-line text-ink-soft font-bold text-xs flex items-center justify-center hover:bg-beige shrink-0"
                  >
                    ‹
                  </button>
                  <div className="text-center px-1">
                    <span className="block font-display text-sm text-ink leading-tight whitespace-nowrap">
                      {formatShortDate(selectedDate)}
                    </span>
                    <span className="block text-meta font-bold text-coral-ink leading-tight whitespace-nowrap">
                      {selectedDayNum ? `Day ${selectedDayNum}` : '行程外'} · {selectedDayObj.note || '自由探索'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openDayView(addDays(selectedDate, 1), activePane)}
                    aria-label="後一天"
                    className="w-7 h-7 rounded-lg bg-cream border border-line text-ink-soft font-bold text-xs flex items-center justify-center hover:bg-beige shrink-0"
                  >
                    ›
                  </button>
                </div>

                {/* Quick Add Expense for this day */}
                <button
                  type="button"
                  onClick={() => openAddForm(selectedDate)}
                  className="px-2.5 py-1.5 rounded-xl bg-coral-ink text-white text-xs font-bold hover:bg-ink transition-colors whitespace-nowrap shrink-0"
                >
                  + 記帳
                </button>
              </div>

              {/* Visible Segmented Tabs + Dots (Non-Swipe Fallback) */}
              <div className="mt-2.5 pt-2 border-t border-line">
                <div className="grid grid-cols-3 gap-1 bg-cream p-1 rounded-2xl border border-line">
                  <button
                    type="button"
                    onClick={() => switchPane('expenses')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activePane === 'expenses'
                        ? 'bg-teal-strong text-white shadow-sm'
                        : 'text-ink-soft hover:bg-beige/60'
                    }`}
                  >
                    ← 收據 ({selectedDayExpenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPane('overview')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activePane === 'overview'
                        ? 'bg-mustard text-ink shadow-sm'
                        : 'text-ink-soft hover:bg-beige/60'
                    }`}
                  >
                    ● 今日總覽
                  </button>
                  <button
                    type="button"
                    onClick={() => switchPane('itinerary')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activePane === 'itinerary'
                        ? 'bg-teal-strong text-white shadow-sm'
                        : 'text-ink-soft hover:bg-beige/60'
                    }`}
                  >
                    行程 ({(selectedDayObj.itinerary || []).length}) →
                  </button>
                </div>

                {/* Dots + Gesture Guide */}
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <span className="text-meta text-ink-muted whitespace-nowrap">
                    👉 右滑看收據明細
                  </span>
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    {PANE_ORDER.map((p) => (
                      <span
                        key={p}
                        className={`h-2 rounded-full transition-all ${
                          activePane === p
                            ? 'w-5 bg-teal-strong'
                            : 'w-2 bg-line'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-meta text-ink-muted whitespace-nowrap">
                    左滑看行程細節 👈
                  </span>
                </div>
              </div>
            </section>

            {/* Swipeable Pane Surface (Touch + Pointer Events) */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                transform: dragOffsetX ? `translateX(${dragOffsetX}px)` : undefined,
                transition: dragOffsetX ? 'none' : 'transform 180ms ease-out',
                touchAction: 'pan-y',
              }}
              className="min-h-[380px]"
            >
              {/* ---------------- PANE 1: CENTRE OVERVIEW (`pane-overview`) ---------------- */}
              {activePane === 'overview' && (
                <section
                  data-testid="pane-overview"
                  aria-label="當日總覽"
                  className="space-y-3 animate-fade-in"
                >
                  {/* Journal Stamp Header Card */}
                  <div className="relative rounded-card bg-cream-soft border-2 border-line p-3.5">
                    <WashiTape
                      tone="mustard"
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-24"
                      rotate="rotate-1"
                    />

                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-pill bg-coral-soft text-coral-ink text-meta font-bold whitespace-nowrap">
                            {selectedDayNum ? `DAY ${selectedDayNum}` : 'EXTRA DAY'}
                          </span>
                          <span className="text-meta text-ink-muted font-medium whitespace-nowrap">
                            {selectedDate}
                          </span>
                        </div>

                        {!isEditingNote ? (
                          <div className="flex items-center gap-2">
                            <h2 className="font-display text-xl text-ink whitespace-nowrap">
                              📍 {selectedDayObj.note || '自由探索'}
                            </h2>
                            <button
                              type="button"
                              onClick={() => {
                                setNoteDraft(selectedDayObj.note || '');
                                setIsEditingNote(true);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-beige text-ink-soft text-meta font-semibold hover:bg-line whitespace-nowrap"
                            >
                              改備註
                            </button>
                          </div>
                        ) : (
                          <form onSubmit={handleSaveDayNote} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              maxLength={8}
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="短備註 (如: 築地)"
                              className="w-32 px-2 py-1 rounded-lg bg-cream border border-teal-strong text-xs text-ink"
                            />
                            <button
                              type="submit"
                              className="px-2 py-1 rounded-lg bg-teal-strong text-white text-meta font-semibold whitespace-nowrap"
                            >
                              儲存
                            </button>
                          </form>
                        )}
                      </div>

                      <PostalStamp
                        topText="JAPAN"
                        mainText={selectedDayNum ? `DAY ${selectedDayNum}` : 'TRIP'}
                        subText={selectedDate.slice(5).replace('-', '.')}
                        tone="teal-strong"
                        className="w-14 h-14 shrink-0"
                      />
                    </div>

                    {/* Two Side-by-Side Directional Tap Cards (Swipe Right vs Swipe Left) */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {/* Swipe Right / Tap -> Expenses Pane */}
                      <button
                        type="button"
                        onClick={() => switchPane('expenses')}
                        className="text-left p-2.5 rounded-2xl bg-mustard-soft/75 border-2 border-mustard-ink/25 hover:border-mustard-ink transition-all"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-meta font-bold text-mustard-ink whitespace-nowrap">
                            ← 右滑 · 掃描收據
                          </span>
                          <span className="px-1.5 py-0.5 rounded-pill bg-cream-soft text-ink text-meta font-bold whitespace-nowrap">
                            {selectedDayExpenses.length}筆
                          </span>
                        </div>
                        <p className="font-display text-lg text-ink mt-1 whitespace-nowrap">
                          HK$ {formatHkd(selectedDayHkd)}
                        </p>
                        <p className="text-meta text-ink-soft whitespace-nowrap">
                          折合 ¥{selectedDayJpy.toLocaleString()} →
                        </p>
                      </button>

                      {/* Swipe Left / Tap -> Itinerary Pane */}
                      <button
                        type="button"
                        onClick={() => switchPane('itinerary')}
                        className="text-left p-2.5 rounded-2xl bg-teal-soft/75 border-2 border-teal-strong/25 hover:border-teal-strong transition-all"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-meta font-bold text-teal-strong whitespace-nowrap">
                            左滑 · 行程細節 →
                          </span>
                          <span className="px-1.5 py-0.5 rounded-pill bg-cream-soft text-teal-strong text-meta font-bold whitespace-nowrap">
                            {(selectedDayObj.itinerary || []).length}站
                          </span>
                        </div>
                        <p className="font-display text-sm text-ink mt-1.5 whitespace-nowrap">
                          {(selectedDayObj.itinerary || [])[0]?.title || '尚無排定行程'}
                        </p>
                        <p className="text-meta text-teal-strong font-medium mt-0.5 whitespace-nowrap">
                          點擊展開時間軸 →
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Quick Preview of Today's Itinerary on Overview */}
                  <div className="rounded-card bg-cream-soft border border-line p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-display text-sm text-ink whitespace-nowrap">
                        🗺️ 當日重點行程
                      </span>
                      <button
                        type="button"
                        onClick={() => switchPane('itinerary')}
                        className="text-meta font-bold text-teal-strong hover:underline whitespace-nowrap"
                      >
                        全部行程 ({(selectedDayObj.itinerary || []).length}) →
                      </button>
                    </div>

                    {(selectedDayObj.itinerary || []).length === 0 ? (
                      <p className="text-xs text-ink-muted py-2 whitespace-nowrap">
                        這天還沒有排定行程，可左滑至行程頁新增。
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {(selectedDayObj.itinerary || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-cream border border-line"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <KindBadgeIcon kind={item.kind} className="w-4 h-4 shrink-0" />
                              <span className="font-mono text-xs font-bold text-teal-strong whitespace-nowrap">
                                {item.time}
                              </span>
                              <span
                                className={`text-xs font-semibold whitespace-nowrap ${
                                  item.done ? 'line-through text-ink-muted' : 'text-ink'
                                }`}
                              >
                                {item.title}
                              </span>
                              <span className="text-meta text-ink-muted whitespace-nowrap">
                                · {item.place}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleItineraryDone(selectedDate, item.id)}
                              className={`px-2 py-0.5 rounded-pill text-meta font-bold whitespace-nowrap ${
                                item.done
                                  ? 'bg-teal-soft text-teal-strong'
                                  : 'bg-mustard-soft text-mustard-ink'
                              }`}
                            >
                              {item.done ? '✓ 已完成' : '待前往'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Preview of Today's Scanned Expenses on Overview */}
                  <div className="rounded-card bg-cream-soft border border-line p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-display text-sm text-ink whitespace-nowrap">
                        🧾 當日收據紀錄 (HK$ {formatHkd(selectedDayHkd)})
                      </span>
                      <button
                        type="button"
                        onClick={() => switchPane('expenses')}
                        className="text-meta font-bold text-coral-ink hover:underline whitespace-nowrap"
                      >
                        全部收據 ({selectedDayExpenses.length}) →
                      </button>
                    </div>

                    {selectedDayExpenses.length === 0 ? (
                      <div className="flex items-center justify-between gap-2 py-2 px-2.5 rounded-xl bg-cream border border-line">
                        <span className="text-xs text-ink-muted whitespace-nowrap">
                          本日尚無消費紀錄
                        </span>
                        <button
                          type="button"
                          onClick={() => openAddForm(selectedDate)}
                          className="px-2.5 py-1 rounded-xl bg-teal-strong text-white text-meta font-bold whitespace-nowrap"
                        >
                          + 記第一筆
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {selectedDayExpenses.map((exp) => (
                          <button
                            key={exp.id}
                            type="button"
                            onClick={() => openEditForm(exp)}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-cream border border-line hover:bg-mustard-soft/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CategoryIcon category={exp.category} className="w-4 h-4 shrink-0" />
                              <span className="text-xs font-semibold text-ink whitespace-nowrap">
                                {exp.store}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-beige text-ink-soft text-meta whitespace-nowrap">
                                {exp.assignedTo}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-1.5 shrink-0">
                              <span className="font-display text-xs font-bold text-ink whitespace-nowrap">
                                HK$ {formatHkd(exp.hkdAmount)}
                              </span>
                              <span className="text-meta text-ink-muted whitespace-nowrap">
                                ({exp.originalCurrency === 'HKD' ? 'HK$' : '¥'}
                                {Number(exp.originalAmount || 0).toLocaleString()})
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ---------------- PANE 2: LEFT / SWIPE-RIGHT EXPENSES (`pane-expenses`) ---------------- */}
              {activePane === 'expenses' && (
                <section
                  data-testid="pane-expenses"
                  aria-label="當日掃描消費明細"
                  className="space-y-3 animate-fade-in"
                >
                  {/* Day Expense Summary Header */}
                  <div className="rounded-card bg-cream-soft border-2 border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-meta font-bold text-coral-ink whitespace-nowrap">
                          🧾 當日掃描收據明細 · {selectedDayObj.note || selectedDate}
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="font-display text-2xl text-ink whitespace-nowrap">
                            HK$ {formatHkd(selectedDayHkd)}
                          </span>
                          <span className="text-xs font-semibold text-ink-muted whitespace-nowrap">
                            (共 ¥{selectedDayJpy.toLocaleString()})
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAddForm(selectedDate)}
                        className="px-3 py-2 rounded-2xl bg-teal-strong text-white text-xs font-bold hover:bg-ink transition-colors whitespace-nowrap"
                      >
                        + 新增／掃描
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between gap-2 text-meta">
                      <span className="text-ink-soft whitespace-nowrap">
                        點擊任一張收據即可修改金額、分類或品項
                      </span>
                      <button
                        type="button"
                        onClick={() => switchPane('overview')}
                        className="font-bold text-teal-strong whitespace-nowrap"
                      >
                        回總覽 →
                      </button>
                    </div>
                  </div>

                  {/* Receipt Cards List */}
                  {selectedDayExpenses.length === 0 ? (
                    <div className="rounded-card bg-cream-soft border-2 border-dashed border-line p-6 text-center space-y-2">
                      <p className="font-display text-base text-ink whitespace-nowrap">
                        這天還沒有收據紀錄
                      </p>
                      <p className="text-xs text-ink-muted whitespace-nowrap">
                        支援日圓／港幣自動換算與日本收據品項掃描
                      </p>
                      <button
                        type="button"
                        onClick={() => openAddForm(selectedDate)}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-coral-ink text-white text-xs font-bold whitespace-nowrap"
                      >
                        📷 立即新增或掃描收據
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedDayExpenses.map((exp) => (
                        <article
                          key={exp.id}
                          className="relative rounded-t-2xl bg-cream-soft border border-line overflow-hidden shadow-sm"
                        >
                          <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-cream border border-line flex items-center justify-center shrink-0">
                                  <CategoryIcon category={exp.category} className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className="font-display text-base text-ink leading-tight whitespace-nowrap">
                                    {exp.store}
                                  </h3>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="px-2 py-0.5 rounded-pill bg-beige text-ink text-meta font-semibold whitespace-nowrap">
                                      {exp.category}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-pill bg-mustard-soft text-mustard-ink text-meta font-semibold whitespace-nowrap">
                                      付款：{exp.assignedTo}
                                    </span>
                                    {exp.scanned && (
                                      <span className="px-2 py-0.5 rounded-pill bg-teal-soft text-teal-strong text-meta font-semibold whitespace-nowrap">
                                        ✓ 已掃描
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="block font-display text-base text-ink whitespace-nowrap">
                                  HK$ {formatHkd(exp.hkdAmount)}
                                </span>
                                <span className="block font-mono text-meta text-ink-muted whitespace-nowrap">
                                  {exp.originalCurrency === 'HKD' ? 'HK$' : '¥'}
                                  {Number(exp.originalAmount || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Itemized breakdown if present */}
                            {exp.items && exp.items.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-dashed border-line space-y-1">
                                {exp.items.map((it, i) => (
                                  <div
                                    key={`${exp.id}-item-${i}`}
                                    className="flex items-center justify-between text-meta text-ink-soft px-1"
                                  >
                                    <span className="whitespace-nowrap">· {it.name}</span>
                                    <span className="font-mono whitespace-nowrap">
                                      ¥{Number(it.price || 0).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between">
                              <span className="text-meta text-ink-muted whitespace-nowrap">
                                日期：{exp.date}
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditForm(exp)}
                                className="px-3 py-1 rounded-xl bg-cream border border-line text-teal-strong text-meta font-bold hover:bg-teal-soft transition-colors whitespace-nowrap"
                              >
                                ✎ 編輯收據
                              </button>
                            </div>
                          </div>
                          <ReceiptZigZagEdge />
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ---------------- PANE 3: RIGHT / SWIPE-LEFT ITINERARY (`pane-itinerary`) ---------------- */}
              {activePane === 'itinerary' && (
                <section
                  data-testid="pane-itinerary"
                  aria-label="當日行程細節"
                  className="space-y-3 animate-fade-in"
                >
                  {/* Day Itinerary Header Card */}
                  <div className="rounded-card bg-cream-soft border-2 border-line p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-meta font-bold text-teal-strong whitespace-nowrap">
                          🗺️ 當日行程時間軸 · {selectedDayNum ? `Day ${selectedDayNum}` : selectedDate}
                        </span>
                        <h2 className="font-display text-xl text-ink mt-0.5 whitespace-nowrap">
                          {selectedDayObj.note || '自由探索'} 路線
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAddItinerary((v) => !v)}
                        className="px-3 py-2 rounded-2xl bg-teal-strong text-white text-xs font-bold hover:bg-ink transition-colors whitespace-nowrap"
                      >
                        {showAddItinerary ? '收起表單' : '+ 新增行程'}
                      </button>
                    </div>

                    {showAddItinerary && (
                      <form
                        onSubmit={handleAddItineraryStop}
                        className="mt-3 pt-3 border-t border-line space-y-2"
                      >
                        <div className="grid grid-cols-3 gap-1.5">
                          <input
                            type="time"
                            value={newStopTime}
                            onChange={(e) => setNewStopTime(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl bg-cream border border-line text-xs text-ink"
                          />
                          <select
                            value={newStopKind}
                            onChange={(e) => setNewStopKind(e.target.value)}
                            className="px-2.5 py-1.5 rounded-xl bg-cream border border-line text-xs text-ink"
                          >
                            <option value="sight">景點</option>
                            <option value="food">美食</option>
                            <option value="transport">交通</option>
                            <option value="shop">購物</option>
                            <option value="stay">住宿</option>
                          </select>
                          <input
                            type="text"
                            value={newStopPlace}
                            onChange={(e) => setNewStopPlace(e.target.value)}
                            placeholder="地點 (例: 銀座)"
                            className="px-2.5 py-1.5 rounded-xl bg-cream border border-line text-xs text-ink"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newStopTitle}
                            onChange={(e) => setNewStopTitle(e.target.value)}
                            placeholder="行程標題 (例: 下午茶甜點)"
                            className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-line text-xs text-ink"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded-xl bg-coral-ink text-white text-xs font-bold whitespace-nowrap"
                          >
                            加入時間軸
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-meta">
                      <span className="text-ink-soft whitespace-nowrap">
                        已完成 {(selectedDayObj.itinerary || []).filter((i) => i.done).length} /{' '}
                        {(selectedDayObj.itinerary || []).length} 個行程點
                      </span>
                      <button
                        type="button"
                        onClick={() => switchPane('overview')}
                        className="font-bold text-teal-strong whitespace-nowrap"
                      >
                        ← 回今日總覽
                      </button>
                    </div>
                  </div>

                  {/* Timeline Items */}
                  {(selectedDayObj.itinerary || []).length === 0 ? (
                    <div className="rounded-card bg-cream-soft border-2 border-dashed border-line p-6 text-center space-y-2">
                      <p className="font-display text-base text-ink whitespace-nowrap">
                        本日尚無排定行程點
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddItinerary(true)}
                        className="inline-flex items-center px-4 py-2 rounded-2xl bg-teal-strong text-white text-xs font-bold whitespace-nowrap"
                      >
                        + 新增第一個行程點
                      </button>
                    </div>
                  ) : (
                    <div className="relative pl-4 space-y-2.5 before:content-[''] before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-line">
                      {(selectedDayObj.itinerary || []).map((item) => (
                        <div
                          key={item.id}
                          className={`relative rounded-2xl border p-3 transition-all ${
                            item.done
                              ? 'bg-cream/80 border-line'
                              : 'bg-cream-soft border-teal-strong/40 shadow-sm'
                          }`}
                        >
                          <span
                            className={`absolute -left-3.5 top-4 w-3 h-3 rounded-full border-2 ${
                              item.done
                                ? 'bg-teal-strong border-cream-soft'
                                : 'bg-mustard border-coral-ink'
                            }`}
                          />

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-2 py-0.5 rounded-lg bg-teal-soft text-teal-strong font-mono text-xs font-bold whitespace-nowrap">
                                {item.time}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-beige text-ink-soft text-meta font-semibold whitespace-nowrap">
                                <KindBadgeIcon kind={item.kind} className="w-3.5 h-3.5" />
                                <span className="whitespace-nowrap">
                                  {KIND_LABELS[item.kind] || '行程'}
                                </span>
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleItineraryDone(selectedDate, item.id)}
                              className={`px-2.5 py-1 rounded-pill text-meta font-bold transition-colors whitespace-nowrap ${
                                item.done
                                  ? 'bg-teal-strong text-white'
                                  : 'bg-mustard-soft text-mustard-ink border border-mustard-ink/30'
                              }`}
                            >
                              {item.done ? '✓ 已打卡' : '標記完成'}
                            </button>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <h3
                              className={`font-display text-base whitespace-nowrap ${
                                item.done ? 'line-through text-ink-muted' : 'text-ink'
                              }`}
                            >
                              {item.title}
                            </h3>
                            <span className="text-xs font-medium text-ink-soft whitespace-nowrap">
                              📍 {item.place}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          </main>
        )}

        {/* Option & Model Attribution Footer */}
        <footer className="mt-6 mb-2 text-center">
          <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-cream-soft/80 border border-line text-meta text-ink-muted whitespace-nowrap">
            <span>手繪旅人手帖</span>
            <span>·</span>
            <span className="font-mono font-semibold text-ink-soft whitespace-nowrap">
              Option A · gemini-4-argon-high
            </span>
          </p>
        </footer>
      </div>

      {/* ===================== BOTTOM NAVIGATION BAR (`data-testid="nav"`) ===================== */}
      <nav
        data-testid="nav"
        aria-label="主導覽列"
        className="fixed bottom-0 inset-x-0 z-40 bg-cream-soft/95 backdrop-blur-md border-t-2 border-line"
      >
        <div className="mx-auto max-w-md px-2 py-1.5 grid grid-cols-5 items-center gap-1">
          {/* 1. Home Calendar */}
          <button
            type="button"
            onClick={openHome}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              screen === 'home'
                ? 'bg-mustard-soft text-ink font-bold'
                : 'text-ink-soft hover:bg-beige/50'
            }`}
          >
            <span className="text-sm leading-none">🗓️</span>
            <span className="text-meta mt-1 leading-none whitespace-nowrap">月曆</span>
          </button>

          {/* 2. Day Overview */}
          <button
            type="button"
            onClick={() => openDayView(selectedDate, 'overview')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              screen === 'day' && activePane === 'overview'
                ? 'bg-mustard-soft text-ink font-bold'
                : 'text-ink-soft hover:bg-beige/50'
            }`}
          >
            <span className="text-sm leading-none">📖</span>
            <span className="text-meta mt-1 leading-none whitespace-nowrap">當日</span>
          </button>

          {/* 3. Central Prominent Add Button (`data-testid="nav-add"`) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              data-testid="nav-add"
              onClick={() => openAddForm(selectedDate)}
              className="flex flex-col items-center justify-center -mt-4 px-3 py-2 rounded-2xl bg-coral-ink text-white border-2 border-cream-soft shadow-md hover:bg-teal-strong transition-colors"
            >
              <span className="font-display text-xs leading-none whitespace-nowrap">
                ＋ 記一筆
              </span>
              <span className="text-meta leading-none mt-0.5 text-mustard-soft whitespace-nowrap">
                掃描/記帳
              </span>
            </button>
          </div>

          {/* 4. Day Itinerary */}
          <button
            type="button"
            onClick={() => openDayView(selectedDate, 'itinerary')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              screen === 'day' && activePane === 'itinerary'
                ? 'bg-mustard-soft text-ink font-bold'
                : 'text-ink-soft hover:bg-beige/50'
            }`}
          >
            <span className="text-sm leading-none">⛩️</span>
            <span className="text-meta mt-1 leading-none whitespace-nowrap">行程</span>
          </button>

          {/* 5. Day Scanned Expenses */}
          <button
            type="button"
            onClick={() => openDayView(selectedDate, 'expenses')}
            className={`flex flex-col items-center justify-center py-1 rounded-xl transition-colors ${
              screen === 'day' && activePane === 'expenses'
                ? 'bg-mustard-soft text-ink font-bold'
                : 'text-ink-soft hover:bg-beige/50'
            }`}
          >
            <span className="text-sm leading-none">🧾</span>
            <span className="text-meta mt-1 leading-none whitespace-nowrap">收據</span>
          </button>
        </div>
      </nav>

      {/* ===================== ADD / EDIT EXPENSE MODAL (`data-testid="expense-form"`) ===================== */}
      {isFormOpen && (
        <ExpenseFormModal
          trip={trip}
          defaultDate={selectedDate || today}
          editingExpense={editingExpense}
          onClose={closeForm}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
        />
      )}
    </div>
  );
}
