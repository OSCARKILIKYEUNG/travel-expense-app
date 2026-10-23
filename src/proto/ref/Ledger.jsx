import { expenseDateKey } from '../../utils/date';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { REF_CATEGORIES } from './mockRefTrip';
import { Icon, Sparkle, mustardStripe } from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import { filterExpenses, fmtHKD, groupLedger, personCounts, undatedHint, zhDate } from './refLogic';
import { activeFilterCount, tripDates } from './refRules';

/** 帳本: full trip ledger with scan/add ribbon, row 1 search + 篩選 button, row 2 person chips, and 未有日期 group. */
export default function Ledger({ trip, highlightId, onScan, onAdd, onEdit, onDelete, onOpenDay }) {
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('全部');
  const [category, setCategory] = useState('全部');
  const [date, setDate] = useState('全部');
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterBtnRef = useRef(null);
  const undatedLabelRef = useRef(null);

  const people = trip.settings?.people || ['共同'];
  const allDates = useMemo(() => {
    const fromTrip = tripDates(trip);
    const fromExpenses = trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date));
    return [...new Set([...fromTrip, ...fromExpenses])].sort().reverse();
  }, [trip]);

  const counts = useMemo(() => personCounts(trip.expenses, people), [trip.expenses, people]);
  const shown = filterExpenses(trip.expenses, { person, category, date, query }, people);
  const groups = groupLedger(shown);
  const hint = undatedHint(groups);
  const total = shown.reduce((s, e) => s + e.hkdAmount, 0);
  const filterCount = activeFilterCount({ category, date });
  const hasAnyFilter = Boolean(query.trim()) || person !== '全部' || filterCount > 0;

  const jumpToUndated = () => {
    const el = document.querySelector('[data-testid="ledger-group-undated"]');
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    (undatedLabelRef.current || document.getElementById('ledger-undated-label'))?.focus?.({ preventScroll: true });
  };

  const clearAllFilters = () => {
    setQuery('');
    setPerson('全部');
    setCategory('全部');
    setDate('全部');
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => filterBtnRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  return (
    <div data-testid="ledger" className="space-y-3 px-4 pb-6 pt-4">
      <div className="relative flex items-baseline gap-2">
        <Sparkle className="absolute -left-1 top-1 h-3.5 w-3.5" />
        <h1 className="whitespace-nowrap pl-4 font-display text-2xl text-ink">帳本</h1>
        <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Ledger</span>
        <span className="ml-auto whitespace-nowrap text-meta font-bold text-ink-soft">
          {fmtHKD(total)} · {shown.length} 筆
        </span>
      </div>

      {hint && (
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="ledger-undated-hint"
            aria-label={`跳到未有日期（${hint.count} 筆）`}
            onClick={jumpToUndated}
            className="inline-flex min-h-11 min-w-11 items-center whitespace-nowrap rounded-pill border border-coral-ink/30 bg-coral-soft px-3 text-meta font-bold text-coral-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {hint.label} ›
          </button>
        </div>
      )}

      {/* Quick scan / manual add ribbon */}
      <div
        className="relative flex min-h-[56px] items-center justify-between gap-2 overflow-hidden rounded-2xl border border-mustard-ink/30 bg-mustard-soft px-2.5 py-1.5 shadow-sm"
        style={mustardStripe}
      >
        <button
          type="button"
          data-testid="ledger-scan"
          onClick={onScan}
          className="inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          {Icon.camera('h-[15px] w-[15px] shrink-0')}
          <span>掃描收據</span>
        </button>
        <button
          type="button"
          data-testid="ledger-add"
          onClick={onAdd}
          className="inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-white px-3 text-meta font-bold text-ink shadow-sm transition-colors hover:bg-cream-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="text-teal-strong">{Icon.plus('h-[15px] w-[15px] shrink-0')}</span>
          <span>記一筆</span>
        </button>
      </div>

      {/* Row 1: Search input with clear (×) + 篩選 button with active count badge */}
      <div className="flex items-center gap-2">
        <div className="relative flex min-h-11 flex-1 items-center rounded-pill border border-line bg-white pl-3.5 pr-1 text-ink-muted shadow-sm focus-within:ring-2 focus-within:ring-teal">
          {Icon.search('h-4 w-4 shrink-0')}
          <input
            aria-label="搜尋"
            data-testid="ledger-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋店舖、地點、類別…"
            className="h-11 min-h-11 w-full min-w-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-muted"
          />
          {query && (
            <button
              type="button"
              aria-label="清除搜尋"
              data-testid="ledger-search-clear"
              onClick={() => setQuery('')}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {Icon.x('h-4 w-4')}
            </button>
          )}
        </div>

        <button
          ref={filterBtnRef}
          type="button"
          data-testid="ledger-filter-btn"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          className={`inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 py-2 text-meta font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
            filterCount > 0
              ? 'border-teal-strong bg-teal-strong text-white shadow-sm'
              : 'border-line bg-cream-soft text-ink-soft hover:bg-beige'
          }`}
        >
          {Icon.filter('h-4 w-4 shrink-0')}
          <span>篩選</span>
          {filterCount > 0 && (
            <span
              data-testid="ledger-filter-badge"
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-meta font-extrabold leading-none text-teal-strong"
            >
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* Row 2: Person chips on one line */}
      <ChipRow label="篩選人物">
        {['全部', ...people].map((p) => (
          <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
            {p} ({counts[p] || 0})
          </Chip>
        ))}
      </ChipRow>

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.key} data-testid={`ledger-group-${g.key}`} className="scroll-mt-20 space-y-2">
            <div className="flex items-center gap-2.5 pt-1">
              {g.iso ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(g.iso)}
                  className="inline-flex min-h-11 min-w-11 items-center whitespace-nowrap rounded-pill bg-beige px-3.5 py-1.5 text-meta font-bold text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {zhDate(g.iso)}
                </button>
              ) : (
                <span
                  ref={undatedLabelRef}
                  id="ledger-undated-label"
                  tabIndex={-1}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-pill border border-coral-ink/30 bg-coral-soft px-3.5 py-1.5 text-meta font-bold text-coral-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {g.label}
                </span>
              )}
              <span className="h-px flex-1 bg-line" />
              <span className="whitespace-nowrap text-meta font-bold text-ink-soft">{fmtHKD(g.total)}</span>
            </div>
            <div className="space-y-2.5">
              {g.items.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  highlighted={e.id === highlightId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="space-y-3 py-8 text-center">
            <p className="whitespace-nowrap text-sm text-ink-muted">沒有符合的消費。</p>
            {hasAnyFilter && (
              <button
                type="button"
                data-testid="ledger-clear-empty"
                onClick={clearAllFilters}
                className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-4 py-2 text-meta font-bold text-teal-strong shadow-sm hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                清除篩選
              </button>
            )}
          </div>
        )}
      </div>

      {sheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="篩選消費"
            data-testid="ledger-filter-sheet"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSheet();
            }}
          >
            <div className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-card border border-line bg-cream-soft p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-card">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <h2 className="whitespace-nowrap font-display text-lg text-ink">篩選消費</h2>
                <button
                  type="button"
                  aria-label="關閉篩選"
                  onClick={closeSheet}
                  className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {Icon.x('h-4 w-4')}
                </button>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap text-meta font-bold text-ink-muted">類別</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="類別">
                  {['全部', ...REF_CATEGORIES].map((cat) => (
                    <Chip
                      key={cat}
                      testid={`filter-cat-${cat}`}
                      active={category === cat}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap text-meta font-bold text-ink-muted">日期</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="日期">
                  <Chip
                    testid="filter-date-全部"
                    active={date === '全部'}
                    onClick={() => setDate('全部')}
                  >
                    全部日期
                  </Chip>
                  <Chip
                    testid="filter-date-undated"
                    active={date === 'undated'}
                    onClick={() => setDate('undated')}
                  >
                    未有日期
                  </Chip>
                  {allDates.map((d) => (
                    <Chip
                      key={d}
                      testid={`filter-date-${d}`}
                      active={date === d}
                      onClick={() => setDate(d)}
                    >
                      {zhDate(d)}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 border-t border-line pt-3">
                <button
                  type="button"
                  data-testid="filter-sheet-clear"
                  onClick={() => {
                    setCategory('全部');
                    setDate('全部');
                  }}
                  className="btn-secondary min-h-11 flex-1 whitespace-nowrap !py-2.5 text-sm"
                >
                  清除篩選
                </button>
                <button
                  type="button"
                  data-testid="filter-sheet-done"
                  onClick={closeSheet}
                  className="btn-primary min-h-11 flex-1 whitespace-nowrap !py-2.5 text-sm"
                >
                  完成
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
