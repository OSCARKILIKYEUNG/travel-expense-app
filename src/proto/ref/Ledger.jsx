import { formatAccountingAmount } from '../../utils/currency';
import { expenseDateKey } from '../../utils/date';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import {
  CameraIcon,
  FilterIcon,
  PencilIcon,
  RepayIcon,
  SearchIcon,
  WashiLabel,
} from '../../journal/art/index.js';
import { REF_CATEGORIES } from './mockRefTrip';
import {
  CATEGORY_DOT,
  CategorySticker,
  DoodleSticker,
  Icon,
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

/** 帳本: full trip ledger with hand-lettered header, grid total card, scan/add actions, search/filter, payer chips, and date groups. */
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
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-3 px-4 pb-6 pt-3.5 lg:mx-auto lg:max-w-6xl lg:overflow-visible"
    >
      <div className="min-w-0 space-y-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-6 lg:space-y-0">
        {/* Left column at lg: sticky rail with header, total card, undated hint, scan/add, search/filter, and person chips */}
        <aside className="min-w-0 space-y-3 lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:sticky lg:top-20 lg:self-start">
          <div className="relative flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              {showLedgerTitleScript && (
                <p className="whitespace-nowrap font-hand text-xs font-bold tracking-wider text-ink-soft">
                  {ledgerTitleScript}
                </p>
              )}
              <h1 className="whitespace-nowrap font-hand text-2xl font-bold tracking-wider text-ink">
                {ledgerTitle}
              </h1>
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
                className="jr-btn-paper inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 font-hand text-xs font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                <RepayIcon className="h-4 w-4 shrink-0 text-route" />
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
                className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-1.5 truncate whitespace-nowrap rounded-pill border border-stamp bg-paper px-3.5 py-1.5 font-hand text-xs font-bold tabular-nums text-stamp transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
              >
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-stamp" />
                <span className="truncate">{t('notebook.ledger.undatedHint', { count: hint.count })} ›</span>
              </button>
            </div>
          )}

          {/* Quick scan / manual add actions (matching Home) */}
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="ledger-scan"
              onClick={onScan}
              className="jr-btn-navy inline-flex min-h-[48px] min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-bold tracking-wider transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
            >
              <CameraIcon className="h-5 w-5 shrink-0 text-paper" />
              <span className="truncate font-hand">{t('notebook.home.scanReceipt')}</span>
            </button>
            <button
              type="button"
              data-testid="ledger-add"
              onClick={onAdd}
              className="jr-btn-paper inline-flex min-h-[48px] min-w-11 items-center justify-center gap-2 whitespace-nowrap rounded-sm px-3 py-2 text-sm font-bold tracking-wider transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
            >
              <PencilIcon className="h-5 w-5 shrink-0 text-route" />
              <span className="truncate font-hand">{t('notebook.home.addEntry')}</span>
            </button>
          </div>

          {/* Search input + 篩選 button + Payer chips */}
          <div className="jr-taped-card min-w-0 space-y-2 bg-paper-shade/85 p-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative flex min-h-11 min-w-0 flex-1 items-center rounded-sm border border-ink-soft/55 bg-paper pl-2.5 pr-1 text-ink-muted focus-within:ring-2 focus-within:ring-route">
                <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
                <input
                  aria-label={t('notebook.ledger.searchAria')}
                  data-testid="ledger-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('notebook.ledger.searchPlaceholder')}
                  className="h-11 min-h-11 w-full min-w-0 bg-transparent px-2 text-xs text-ink outline-none placeholder:text-ink-muted lg:text-sm"
                />
                {query && (
                  <button
                    type="button"
                    aria-label={t('notebook.ledger.clearSearchAria')}
                    data-testid="ledger-search-clear"
                    onClick={() => setQuery('')}
                    className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
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
                className={`inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1.5 font-hand text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                  filterCount > 0
                    ? 'border-ink-soft bg-tape-navy text-paper'
                    : 'border-ink-soft/55 bg-paper text-ink hover:bg-paper-shade'
                }`}
              >
                <FilterIcon className="h-4 w-4 shrink-0" />
                <span>{t('notebook.ledger.filterBtn')}</span>
                {filterCount > 0 && (
                  <span
                    data-testid="ledger-filter-badge"
                    className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-paper px-1.5 font-display text-xs font-bold leading-none tabular-nums text-route"
                  >
                    {filterCount}
                  </span>
                )}
              </button>
            </div>

            <div className="min-w-0 space-y-1.5">
              {payer !== '全部' && (
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="ledger-payer-chip"
                    aria-label={t('notebook.ledger.clearPayerAria')}
                    onClick={() => setPayer('全部')}
                    className="inline-flex min-h-11 min-w-11 max-w-full items-center justify-center truncate whitespace-nowrap rounded-sm border border-ink-soft bg-tape-navy px-3 py-1.5 font-hand text-xs font-bold text-paper transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
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
          </div>
        </aside>

        {/* Right column at lg: expense list (date groups + cards) */}
        <div className="min-w-0 space-y-4 lg:col-span-7 lg:col-start-6 lg:row-start-1">
          {displayGroups.map((g) => (
            <section key={g.key} data-testid={`ledger-group-${g.key}`} className="min-w-0 scroll-mt-20 space-y-2.5">
              <div className="flex min-w-0 items-center gap-2.5 pt-0.5">
                {g.iso ? (
                  <button
                    type="button"
                    data-notched-tab="date"
                    onClick={() => onOpenDay(g.iso)}
                    className="inline-flex min-h-11 min-w-11 max-w-full items-center whitespace-nowrap py-1.5 text-left hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                  >
                    <WashiLabel tilt={-1} className="truncate px-3 py-1">
                      {fmtDate(g.iso)}
                    </WashiLabel>
                  </button>
                ) : (
                  <span
                    ref={undatedLabelRef}
                    id="ledger-undated-label"
                    data-notched-tab="undated"
                    tabIndex={-1}
                    className="inline-flex min-h-11 max-w-full items-center whitespace-nowrap py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-route"
                  >
                    <span className="truncate rounded-sm border border-stamp bg-paper px-3 py-1 font-hand text-xs font-bold tracking-wider text-stamp">
                      {t('notebook.ledger.undated')}
                    </span>
                  </span>
                )}
                <span className="h-0 min-w-2 flex-1 border-t border-dashed border-ink-soft/40" />
                <span className="shrink-0 whitespace-nowrap rounded-sm border border-ink-soft/30 bg-paper-shade/85 px-2 py-0.5 font-display text-xs font-bold tabular-nums text-ink">
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
                      className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2.5 rounded-sm border border-dashed border-route/55 bg-paper px-3 py-2.5 text-left transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-route-soft font-bold text-route"
                          >
                            ⇄
                          </span>
                          <span className="shrink-0 rounded-sm border border-route/30 bg-route-soft px-2 py-0.5 font-hand text-xs font-bold text-route">
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
                              className="shrink-0 rounded-sm border border-stamp/45 bg-paper px-2 py-0.5 font-hand text-xs font-bold text-stamp"
                            >
                              {t('notebook.settle.unknownMember')}
                            </span>
                          )}
                        </div>
                        {s.note && (
                          <p className="min-w-0 truncate text-xs text-ink-muted">{s.note}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end font-display tabular-nums">
                        <span className="whitespace-nowrap text-sm font-bold text-route">
                          {formatAccountingAmount(s.hkdAmount, accountingCurrency)}
                        </span>
                        {s.currency && s.currency !== accountingCurrency && Number(s.amount) > 0 && (
                          <span className="whitespace-nowrap text-xs text-ink-muted">
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
              className="jr-taped-card jr-grid space-y-2.5 border-dashed px-4 py-6 text-center"
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
                    className="jr-btn-paper inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-4 py-2 font-hand text-sm font-bold text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
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
                <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-3 overflow-y-auto overflow-x-hidden rounded-t-card border border-ink-soft/60 bg-paper p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-sm">
                  <div className="flex min-w-0 items-center justify-between gap-2 border-b border-dashed border-ink-soft/35 pb-2.5">
                    <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg font-bold text-ink">
                      {repaymentModal.mode === 'edit'
                        ? t('notebook.settle.edit')
                        : t('notebook.settle.recordRepayment')}
                    </h2>
                    <button
                      type="button"
                      aria-label={t('notebook.settle.close')}
                      onClick={() => setRepaymentModal(null)}
                      className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                    >
                      {Icon.x('h-4 w-4')}
                    </button>
                  </div>

                  <RepaymentForm
                    hideTitle
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
            <div className="max-h-[85vh] w-full max-w-lg min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-card border border-ink-soft/60 bg-paper p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-sm">
              <div className="flex min-w-0 items-center justify-between gap-2 border-b border-dashed border-ink-soft/35 pb-2.5">
                <h2 className="min-w-0 truncate whitespace-nowrap font-hand text-lg font-bold text-ink">
                  {t('notebook.ledger.filterSheetTitle')}
                </h2>
                <button
                  type="button"
                  aria-label={t('notebook.ledger.closeFilterAria')}
                  onClick={closeSheet}
                  className="inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft/40 bg-paper text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  {Icon.x('h-4 w-4')}
                </button>
              </div>

              <div className="space-y-2">
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
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
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
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
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
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
                <p className="whitespace-nowrap font-hand text-meta font-bold text-ink-soft">
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

              <div className="flex gap-3 border-t border-dashed border-ink-soft/35 pt-3">
                <button
                  type="button"
                  data-testid="filter-sheet-clear"
                  onClick={() => {
                    setCategory('全部');
                    setDate('全部');
                    setPayment('全部');
                    setPayer('全部');
                  }}
                  className="jr-btn-paper min-h-11 flex-1 whitespace-nowrap rounded-sm px-3 py-2.5 font-hand text-sm font-bold text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  {t('notebook.empty.clearFilters')}
                </button>
                <button
                  type="button"
                  data-testid="filter-sheet-done"
                  onClick={closeSheet}
                  className="jr-btn-navy min-h-11 flex-1 whitespace-nowrap rounded-sm px-3 py-2.5 font-hand text-sm font-bold text-paper hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
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
