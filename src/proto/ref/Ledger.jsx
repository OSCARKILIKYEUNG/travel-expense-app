import { expenseDateKey } from '../../utils/date';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { REF_CATEGORIES } from './mockRefTrip';
import {
  CATEGORY_DOT,
  CategorySticker,
  DoodleSticker,
  Icon,
  NotchedTabBg,
  cardDots,
} from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import LedgerTotalCard from './LedgerTotalCard';
import { settleUp } from './refCharts';
import { ledgerTotalSummary } from './refLedgerTotal';
import {
  filterExpenses,
  fmtHKD,
  formatNotebookDate,
  groupLedger,
  matchesPerson,
  personCounts,
  undatedHint,
} from './refLogic';
import RepaymentForm from './RepaymentForm';
import {
  filterSettlements,
  hasUnknownParticipant,
  mergeGroupsWithSettlements,
  resolveTripAccountingCurrency,
  resolveTripForeignCurrency,
  resolveTripRefRate,
} from './refRepayment';
import { activeFilterCount, defaultExpenseDate, resolveToday, tripDates } from './refRules';

const hk = (n) => `HK$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/** 帳本: full trip ledger with scan/add ribbon, row 1 search + 篩選 button, row 2 person chips, and 無日期 group. */
export default function Ledger({
  trip,
  today,
  initialFilters,
  highlightId,
  exchangeRates,
  defaultAssignee,
  settlementActions,
  onScan,
  onAdd,
  onEdit,
  onDelete,
  onOpenDay,
}) {
  const { t, i18n: activeI18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState(() => initialFilters?.person || '全部');
  const [category, setCategory] = useState(() => initialFilters?.category || '全部');
  const [date, setDate] = useState(() => initialFilters?.date || '全部');
  const [payment, setPayment] = useState(() => initialFilters?.payment || '全部');
  const [payer, setPayer] = useState(() => initialFilters?.payer || '全部');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [repaymentModal, setRepaymentModal] = useState(null);
  const filterBtnRef = useRef(null);
  const undatedLabelRef = useRef(null);

  const people = trip.settings?.people || ['共同'];
  const nonSharedPeople = useMemo(() => people.filter((p) => p && p !== '共同'), [people]);
  const accountingCurrency = useMemo(() => resolveTripAccountingCurrency(trip), [trip]);
  const tripCurrency = useMemo(() => resolveTripForeignCurrency(trip), [trip]);
  const activeRate = useMemo(() => resolveTripRefRate(trip), [trip]);
  const effectiveToday = useMemo(() => today || resolveToday(''), [today]);
  const settlements = useMemo(() => trip.settlements || [], [trip.settlements]);
  const displayPerson = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const displayCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });
  const fmtDate = (iso) => formatNotebookDate(iso, { t, lang: activeI18n.language });

  const allDates = useMemo(() => {
    const fromTrip = tripDates(trip);
    const fromExpenses = trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date));
    return [...new Set([...fromTrip, ...fromExpenses])].sort().reverse();
  }, [trip]);

  const countSource = useMemo(
    () => filterExpenses(trip.expenses, { person: '全部', category, date, query, payment, payer }, people),
    [trip.expenses, people, category, date, query, payment, payer],
  );
  const counts = useMemo(() => personCounts(countSource, people), [countSource, people]);
  const showExtraShared =
    !people.includes('共同') && countSource.some((e) => matchesPerson(e, '共同', people));
  const extraSharedCount = showExtraShared
    ? countSource.filter((e) => matchesPerson(e, '共同', people)).length
    : 0;
  const shown = filterExpenses(trip.expenses, { person, category, date, query, payment, payer }, people);
  const groups = groupLedger(shown);
  const filteredSettlements = useMemo(
    () => filterSettlements(settlements, { person, category, date, query, payment, payer }),
    [settlements, person, category, date, query, payment, payer],
  );
  const displayGroups = useMemo(
    () => mergeGroupsWithSettlements(groups, filteredSettlements),
    [groups, filteredSettlements],
  );
  const settlement = useMemo(
    () =>
      settleUp(
        trip.expenses,
        people,
        exchangeRates || trip.exchangeRates || null,
        settlements,
      ),
    [trip.expenses, people, exchangeRates, trip.exchangeRates, settlements],
  );
  const hint = undatedHint(groups);
  const filterCount = activeFilterCount({ category, date, payment, payer });
  const hasAnyFilter = Boolean(query.trim()) || person !== '全部' || filterCount > 0;
  const summary = ledgerTotalSummary({
    shown,
    all: trip.expenses,
    budget: trip.settings?.budget,
    filtered: hasAnyFilter,
    person,
    people,
    exchangeRates: exchangeRates || trip.exchangeRates || null,
    defaultAssignee,
  });

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
    setPayment('全部');
    setPayer('全部');
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

  useEffect(() => {
    if (!repaymentModal || typeof document === 'undefined') return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setRepaymentModal(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [repaymentModal]);

  const ledgerTitle = t('notebook.ledger.title');
  const ledgerTitleScript = t('notebook.ledger.titleScript');
  const showLedgerTitleScript = Boolean(ledgerTitleScript) && ledgerTitleScript !== ledgerTitle;

  return (
    <div
      data-testid="ledger"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-3 px-4 pb-6 pt-4 lg:mx-auto lg:max-w-6xl lg:overflow-visible"
    >
      <div className="min-w-0 space-y-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:space-y-0">
        {/* Right column at lg: sticky rail with total card, repayment action, scan/add, search/filter, and person chips */}
        <aside className="min-w-0 space-y-3 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:sticky lg:top-20">
          <div className="relative flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              {showLedgerTitleScript && (
                <p className="whitespace-nowrap font-serif-display text-[15px] lg:text-base font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  {ledgerTitleScript}
                </p>
              )}
              <h1 className="whitespace-nowrap font-hand text-2xl text-ink">{ledgerTitle}</h1>
            </div>

            {nonSharedPeople.length >= 2 && (
              <button
                type="button"
                data-testid="ledger-add-repayment"
                onClick={() =>
                  setRepaymentModal({
                    mode: 'add',
                    initial: {
                      from: '',
                      to: '',
                      amount: '',
                      currency: accountingCurrency,
                      date: defaultExpenseDate(trip, effectiveToday) || effectiveToday,
                      note: '',
                    },
                  })
                }
                className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-3.5 py-2 text-sm font-bold text-teal-strong shadow-sm transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                <span aria-hidden="true">⇄</span>
                <span>{t('notebook.settle.recordRepayment')}</span>
              </button>
            )}
          </div>

          <LedgerTotalCard summary={summary} tripName={trip.name} />

          {hint && (
            <div className="flex min-w-0 justify-end">
              <button
                type="button"
                data-testid="ledger-undated-hint"
                aria-label={t('notebook.ledger.jumpToUndatedAria', { count: hint.count })}
                onClick={jumpToUndated}
                className="inline-flex min-h-11 min-w-11 max-w-full items-center truncate whitespace-nowrap rounded-pill border border-coral-ink/30 bg-coral-soft px-3 text-meta font-bold text-coral-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {t('notebook.ledger.undatedHint', { count: hint.count })} ›
              </button>
            </div>
          )}

          {/* Quick scan / manual add bar */}
          <div className="relative flex min-h-[56px] min-w-0 items-center justify-between gap-2 overflow-hidden rounded-2xl border border-line bg-cream-soft px-2.5 py-1.5 shadow-sm">
            <button
              type="button"
              data-testid="ledger-scan"
              onClick={onScan}
              className="inline-flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-xl bg-teal-strong px-3 text-sm font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {Icon.camera('h-[15px] w-[15px] shrink-0')}
              <span className="truncate">{t('notebook.home.scanReceipt')}</span>
            </button>
            <button
              type="button"
              data-testid="ledger-add"
              onClick={onAdd}
              className="inline-flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 truncate whitespace-nowrap rounded-xl border border-line bg-cream px-3 text-sm font-bold text-ink shadow-sm transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <span className="shrink-0 text-teal-strong">{Icon.plus('h-[15px] w-[15px] shrink-0')}</span>
              <span className="truncate">{t('notebook.home.addEntry')}</span>
            </button>
          </div>

          {/* Row 1: Search input with clear (×) + 篩選 button with active count badge */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex min-h-11 min-w-0 flex-1 items-center rounded-pill border border-line bg-white pl-3.5 pr-1 text-ink-muted shadow-sm focus-within:ring-2 focus-within:ring-teal">
              {Icon.search('h-4 w-4 shrink-0')}
              <input
                aria-label={t('notebook.ledger.searchAria')}
                data-testid="ledger-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('notebook.ledger.searchPlaceholder')}
                className="h-11 min-h-11 w-full min-w-0 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
              {query && (
                <button
                  type="button"
                  aria-label={t('notebook.ledger.clearSearchAria')}
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
              className={`inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border px-3.5 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                filterCount > 0
                  ? 'border-teal-strong bg-teal-strong text-white shadow-sm'
                  : 'border-line bg-cream-soft text-ink-soft hover:bg-beige'
              }`}
            >
              {Icon.filter('h-4 w-4 shrink-0')}
              <span>{t('notebook.ledger.filterBtn')}</span>
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

          {/* Row 2: Active payer chip + Person chips */}
          <div className="min-w-0 space-y-1.5">
            {payer !== '全部' && (
              <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="ledger-payer-chip"
                  aria-label={t('notebook.ledger.clearPayerAria')}
                  onClick={() => setPayer('全部')}
                  className="inline-flex min-h-11 min-w-11 max-w-full items-center justify-center truncate whitespace-nowrap rounded-pill border border-teal-strong bg-teal-soft px-3.5 py-2 text-sm font-bold text-teal-strong shadow-sm transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  <span className="min-w-0 truncate">{t('notebook.ledger.payerChip', { name: payer })}</span>
                </button>
              </div>
            )}

            <ChipRow label={t('notebook.ledger.filterPersonAria')}>
              <Chip
                active={person === '全部' && payer === '全部'}
                onClick={() => {
                  setPerson('全部');
                  setPayer('全部');
                }}
              >
                {t('notebook.ledger.allCount', { count: counts['全部'] || 0 })}
              </Chip>
              {showExtraShared && (
                <Chip active={person === '共同'} onClick={() => setPerson('共同')}>
                  {`${displayPerson('共同')} (${extraSharedCount})`}
                </Chip>
              )}
              {people.map((p) => (
                <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
                  {displayPerson(p)} ({counts[p] || 0})
                </Chip>
              ))}
            </ChipRow>
          </div>
        </aside>

        {/* Left column at lg: expense list (date tabs + list) */}
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:col-start-1 lg:row-start-1">
        {displayGroups.map((g) => (
          <section key={g.key} data-testid={`ledger-group-${g.key}`} className="min-w-0 scroll-mt-20 space-y-2">
            <div className="flex min-w-0 items-center gap-2.5 pt-1">
              {g.iso ? (
                <button
                  type="button"
                  data-notched-tab="date"
                  onClick={() => onOpenDay(g.iso)}
                  className="relative inline-flex min-h-11 min-w-11 max-w-full truncate items-center gap-1.5 whitespace-nowrap rounded-md pl-5 pr-5 py-1.5 text-meta font-bold text-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  <NotchedTabBg tone="mustard" />
                  <span className="relative z-10 truncate font-hand">{fmtDate(g.iso)}</span>
                </button>
              ) : (
                <span
                  ref={undatedLabelRef}
                  id="ledger-undated-label"
                  data-notched-tab="undated"
                  tabIndex={-1}
                  className="relative inline-flex min-h-11 max-w-full truncate items-center gap-1.5 whitespace-nowrap rounded-md pl-5 pr-5 py-1.5 text-meta font-bold text-coral-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  <NotchedTabBg tone="coral" />
                  <span className="relative z-10 truncate font-hand">{t('notebook.ledger.undated')}</span>
                </span>
              )}
              <span className="h-0 min-w-2 flex-1 border-t border-dashed border-line" />
              <span className="shrink-0 whitespace-nowrap rounded-pill bg-beige/75 px-2.5 py-0.5 font-mono text-meta font-bold text-ink-soft">
                {fmtHKD(g.total)}
              </span>
            </div>
            <div className="min-w-0 space-y-2.5">
              {(g.settlements || []).map((s) => {
                const unknown = hasUnknownParticipant(s, nonSharedPeople);
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid="ledger-repayment-row"
                    onClick={() =>
                      setRepaymentModal({
                        mode: 'edit',
                        initial: s,
                      })
                    }
                    className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2.5 rounded-2xl border-2 border-dashed border-teal/45 bg-cream-soft px-3.5 py-2.5 text-left shadow-sm transition-colors hover:bg-beige/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-soft font-bold text-teal-strong"
                        >
                          ⇄
                        </span>
                        <span className="shrink-0 rounded-md border border-teal/30 bg-teal-soft px-2 py-0.5 text-meta font-bold text-teal-strong">
                          {t('notebook.settle.ledgerRepaymentTag')}
                        </span>
                        <span className="min-w-0 truncate text-sm font-bold text-ink">
                          {t('notebook.settle.repaidTo', {
                            from: s.from === '共同' ? t('expenseCard.shared') : s.from,
                            to: s.to === '共同' ? t('expenseCard.shared') : s.to,
                          })}
                        </span>
                        {unknown && (
                          <span
                            data-testid="ledger-unknown-member"
                            className="shrink-0 rounded-md border border-coral-ink/40 bg-coral-soft px-2 py-0.5 text-meta font-bold text-coral-ink"
                          >
                            {t('notebook.settle.unknownMember')}
                          </span>
                        )}
                      </div>
                      {s.note && (
                        <p className="min-w-0 truncate text-meta text-ink-muted">{s.note}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="whitespace-nowrap font-mono text-sm font-bold tabular-nums text-teal-strong">
                        {hk(s.hkdAmount)}
                      </span>
                      {s.currency && s.currency !== accountingCurrency && Number(s.amount) > 0 && (
                        <span className="whitespace-nowrap font-mono text-meta text-ink-muted">
                          {s.currency} {Math.round(Number(s.amount)).toLocaleString('en-US')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
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
        {displayGroups.length === 0 && (
          <div
            data-testid="ledger-empty-state"
            className="space-y-2.5 rounded-card border border-dashed border-line px-4 py-6 text-center shadow-sm"
            style={cardDots}
          >
            {hasAnyFilter ? (
              <>
                <DoodleSticker name="sushi" secondary="camera" blob="coral" size="xl" />
                <div>
                  <p className="mt-1 font-hand text-base text-ink">
                    {t('notebook.empty.ledgerFilteredTitle')}
                  </p>
                  <p className="mt-0.5 text-meta text-ink-muted">
                    {t('notebook.empty.ledgerFilteredHint')}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="ledger-clear-empty"
                  onClick={clearAllFilters}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-pill border border-teal/40 bg-teal-soft px-4 py-2 text-sm font-bold text-teal-strong shadow-sm hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {t('notebook.empty.clearFilters')}
                </button>
              </>
            ) : (
              <>
                <DoodleSticker name="plane" secondary="suitcase" blob="teal" size="xl" />
                <div>
                  <p className="mt-1 font-hand text-base text-ink">
                    {t('notebook.empty.ledgerEmptyTitle')}
                  </p>
                  <p className="mt-0.5 text-meta text-ink-muted">
                    {t('notebook.empty.ledgerEmptyHint')}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {repaymentModal &&
        (typeof document !== 'undefined'
          ? createPortal(
              <div
                className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-ink/40 backdrop-blur-sm sm:items-center"
                role="dialog"
                aria-modal="true"
                aria-label={
                  repaymentModal.mode === 'edit'
                    ? t('notebook.settle.edit')
                    : t('notebook.settle.recordRepayment')
                }
                data-testid="ledger-repayment-sheet"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setRepaymentModal(null);
                }}
              >
                <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-3 overflow-y-auto overflow-x-hidden rounded-t-card border border-line bg-cream-soft p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-card">
                  <div className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2.5">
                    <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg text-ink">
                      {repaymentModal.mode === 'edit'
                        ? t('notebook.settle.edit')
                        : t('notebook.settle.recordRepayment')}
                    </h2>
                    <button
                      type="button"
                      aria-label={t('notebook.settle.close')}
                      onClick={() => setRepaymentModal(null)}
                      className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                    >
                      {Icon.x('h-4 w-4')}
                    </button>
                  </div>

                  <RepaymentForm
                    participants={nonSharedPeople}
                    initial={repaymentModal.initial}
                    accountingCurrency={accountingCurrency}
                    tripCurrency={tripCurrency}
                    rate={activeRate}
                    transfers={repaymentModal.mode === 'add' ? settlement.transfers : null}
                    today={effectiveToday}
                    onSave={(row) => {
                      if (repaymentModal.mode === 'edit' && repaymentModal.initial?.id) {
                        settlementActions?.update?.(repaymentModal.initial.id, row);
                      } else {
                        settlementActions?.add?.(row);
                      }
                      setRepaymentModal(null);
                    }}
                    onDelete={
                      repaymentModal.mode === 'edit'
                        ? () => {
                            settlementActions?.remove?.(repaymentModal.initial);
                            setRepaymentModal(null);
                          }
                        : undefined
                    }
                    onCancel={() => setRepaymentModal(null)}
                  />
                </div>
              </div>,
              document.body,
            )
          : null)}

      {sheetOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center overflow-x-hidden bg-ink/40 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label={t('notebook.ledger.filterSheetTitle')}
            data-testid="ledger-filter-sheet"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeSheet();
            }}
          >
            <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-card border border-line bg-cream-soft p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-card">
              <div className="flex min-w-0 items-center justify-between gap-2 border-b border-line pb-2.5">
                <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg text-ink">
                  {t('notebook.ledger.filterSheetTitle')}
                </h2>
                <button
                  type="button"
                  aria-label={t('notebook.ledger.closeFilterAria')}
                  onClick={closeSheet}
                  className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {Icon.x('h-4 w-4')}
                </button>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-muted">
                  {t('notebook.ledger.categoryLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t('notebook.ledger.categoryLabel')}
                >
                  {['全部', ...REF_CATEGORIES].map((cat) => (
                    <Chip
                      key={cat}
                      testid={`filter-cat-${cat}`}
                      active={category === cat}
                      onClick={() => setCategory(cat)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {cat !== '全部' && (
                          <CategorySticker
                            category={cat}
                            size="sm"
                            dotClassName={`h-2 w-2 ${CATEGORY_DOT[cat] || 'bg-ink-muted'}`}
                          />
                        )}
                        <span>{cat === '全部' ? t('notebook.ledger.all') : displayCategory(cat)}</span>
                      </span>
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-muted">
                  {t('notebook.ledger.paymentMethodLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t('notebook.ledger.paymentMethodLabel')}
                >
                  {[
                    { id: '全部', label: t('notebook.ledger.all') },
                    { id: 'cash', label: t('notebook.ledger.payCash') },
                    { id: 'card', label: t('notebook.ledger.payCard') },
                  ].map((opt) => (
                    <Chip
                      key={opt.id}
                      testid={`filter-pay-${opt.id}`}
                      active={payment === opt.id}
                      onClick={() => setPayment(opt.id)}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-muted">
                  {t('notebook.ledger.payerLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t('notebook.ledger.payerLabel')}
                >
                  {['全部', ...nonSharedPeople].map((p) => (
                    <Chip
                      key={p}
                      testid={`filter-payer-${p}`}
                      active={payer === p}
                      onClick={() => setPayer(p)}
                    >
                      {p === '全部' ? t('notebook.ledger.all') : p}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-muted">
                  {t('notebook.ledger.dateLabel')}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t('notebook.ledger.dateLabel')}
                >
                  <Chip
                    testid="filter-date-全部"
                    active={date === '全部'}
                    onClick={() => setDate('全部')}
                  >
                    {t('notebook.ledger.allDates')}
                  </Chip>
                  <Chip
                    testid="filter-date-undated"
                    active={date === 'undated'}
                    onClick={() => setDate('undated')}
                  >
                    {t('notebook.ledger.undated')}
                  </Chip>
                  {allDates.map((d) => (
                    <Chip
                      key={d}
                      testid={`filter-date-${d}`}
                      active={date === d}
                      onClick={() => setDate(d)}
                    >
                      {fmtDate(d)}
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
                    setPayment('全部');
                    setPayer('全部');
                  }}
                  className="btn-secondary min-h-11 flex-1 whitespace-nowrap !py-2.5 text-sm"
                >
                  {t('notebook.empty.clearFilters')}
                </button>
                <button
                  type="button"
                  data-testid="filter-sheet-done"
                  onClick={closeSheet}
                  className="btn-primary min-h-11 flex-1 whitespace-nowrap !py-2.5 text-sm"
                >
                  {t('notebook.ledger.done')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
