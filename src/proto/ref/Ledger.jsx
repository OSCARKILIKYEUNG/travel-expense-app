import { expenseDateKey } from '../../utils/date';
import { useMemo, useState } from 'react';
import { REF_CATEGORIES, REF_PEOPLE } from './mockRefTrip';
import { Icon, Sparkle, mustardStripe } from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import { filterExpenses, fmtHKD, groupLedger, personCounts, zhDate } from './refLogic';

/** 帳本: full trip ledger with scan/add ribbon, one-line search + filters, and 未有日期 group. */
export default function Ledger({ trip, onScan, onAdd, onEdit, onDelete, onOpenDay }) {
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('全部');
  const [category, setCategory] = useState('全部');
  const [date, setDate] = useState('全部');

  const dates = useMemo(
    () => [...new Set(trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date)))].sort().reverse(),
    [trip.expenses],
  );
  const counts = useMemo(() => personCounts(trip.expenses, REF_PEOPLE), [trip.expenses]);
  const shown = filterExpenses(trip.expenses, { person, category, date, query }, REF_PEOPLE);
  const groups = groupLedger(shown);
  const total = shown.reduce((s, e) => s + e.hkdAmount, 0);

  const selectChip =
    'min-h-[34px] shrink-0 appearance-none whitespace-nowrap rounded-pill border px-3 py-1 text-meta font-semibold outline-none';

  return (
    <div data-testid="ledger" className="space-y-3.5 px-4 pb-6 pt-4">
      <div className="relative flex items-baseline gap-2">
        <Sparkle className="absolute -left-1 top-1 h-3.5 w-3.5" />
        <h1 className="whitespace-nowrap pl-4 font-display text-2xl text-ink">帳本</h1>
        <span className="whitespace-nowrap font-script text-lg font-bold text-teal-strong">Ledger</span>
        <span className="ml-auto whitespace-nowrap text-meta font-bold text-ink-soft">
          {fmtHKD(total)} · {shown.length} 筆
        </span>
      </div>

      {/* Quick scan / manual add ribbon */}
      <div
        className="relative flex h-[52px] items-center justify-between gap-2 overflow-hidden rounded-2xl border border-mustard-ink/30 bg-mustard-soft px-2.5 shadow-sm"
        style={mustardStripe}
      >
        <button
          type="button"
          data-testid="ledger-scan"
          onClick={onScan}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm"
        >
          {Icon.camera('h-[15px] w-[15px] shrink-0')}
          <span>掃描收據</span>
        </button>
        <button
          type="button"
          data-testid="ledger-add"
          onClick={onAdd}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-cream-soft px-3 text-meta font-bold text-ink shadow-sm"
        >
          <span className="text-teal-strong">{Icon.plus('h-[15px] w-[15px] shrink-0')}</span>
          <span>記一筆</span>
        </button>
      </div>

      {/* Search + filters on ONE line */}
      <ChipRow label="搜尋及篩選">
        <label className="flex min-h-[34px] w-28 shrink-0 items-center gap-1.5 rounded-pill border border-line bg-white px-3 py-1 text-ink-muted shadow-sm">
          {Icon.search('h-3.5 w-3.5 shrink-0')}
          <input
            aria-label="搜尋"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋"
            className="w-full min-w-0 bg-transparent text-meta text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
        {['全部', ...REF_PEOPLE].map((p) => (
          <Chip key={p} active={person === p} onClick={() => setPerson(p)}>
            {p} ({counts[p] || 0})
          </Chip>
        ))}
        <select
          aria-label="類別"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${selectChip} ${
            category === '全部' ? 'border-line bg-cream-soft text-ink-soft' : 'border-teal-strong bg-teal-strong text-white'
          }`}
        >
          <option value="全部">類別 ▾</option>
          {REF_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${selectChip} ${
            date === '全部' ? 'border-line bg-cream-soft text-ink-soft' : 'border-teal-strong bg-teal-strong text-white'
          }`}
        >
          <option value="全部">日期 ▾</option>
          <option value="undated">未有日期</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {zhDate(d)}
            </option>
          ))}
        </select>
      </ChipRow>

      <div className="space-y-4">
        {groups.map((g) => (
          <section key={g.key} data-testid={`ledger-group-${g.key}`} className="space-y-2">
            <div className="flex items-center gap-2.5 pt-1">
              {g.iso ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(g.iso)}
                  className="whitespace-nowrap rounded-pill bg-beige px-3 py-1 text-meta font-bold text-ink-soft hover:text-ink"
                >
                  {zhDate(g.iso)}
                </button>
              ) : (
                <span className="whitespace-nowrap rounded-pill border border-coral-ink/30 bg-coral-soft px-3 py-1 text-meta font-bold text-coral-ink">
                  {g.label}
                </span>
              )}
              <span className="h-px flex-1 bg-line" />
              <span className="whitespace-nowrap text-meta font-bold text-ink-soft">{fmtHKD(g.total)}</span>
            </div>
            <div className="space-y-2.5">
              {g.items.map((e) => (
                <ExpenseCard key={e.id} expense={e} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">沒有符合的消費。</p>
        )}
      </div>
    </div>
  );
}
