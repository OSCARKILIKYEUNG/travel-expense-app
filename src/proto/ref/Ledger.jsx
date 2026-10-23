import { expenseDateKey } from '../../utils/date';
import { useMemo, useState } from 'react';
import { REF_CATEGORIES, REF_PEOPLE } from './mockRefTrip';
import { Icon, mustardStripe } from './parts';
import ExpenseCard, { Chip, ChipRow } from './ExpenseCard';
import { filterExpenses, fmtHKD, groupLedger, personCounts, zhDate } from './refLogic';

/** 帳本: the full trip ledger (Oscar 08:51), like the old pre-calendar expense list. */
export default function Ledger({ trip, onScan, onAdd, onEdit, onDelete, onOpenDay }) {
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('全部');
  const [category, setCategory] = useState('全部');
  const [date, setDate] = useState('全部');
  const dates = useMemo(() => [...new Set(trip.expenses.filter((e) => e.date).map((e) => expenseDateKey(e.date)))].sort().reverse(), [trip.expenses]);
  const counts = useMemo(() => personCounts(trip.expenses, REF_PEOPLE), [trip.expenses]);
  const shown = filterExpenses(trip.expenses, { person, category, date, query }, REF_PEOPLE);
  const groups = groupLedger(shown);
  const total = shown.reduce((s, e) => s + e.hkdAmount, 0);
  const selectChip = 'shrink-0 appearance-none whitespace-nowrap rounded-pill border px-2.5 py-1 text-[13px] font-bold outline-none';

  return (
    <div data-testid="ledger" className="px-4 pt-3">
      <div className="flex items-baseline gap-2">
        <h1 className="whitespace-nowrap font-display text-[26px] text-ink">帳本</h1>
        <span className="whitespace-nowrap font-script text-[19px] font-bold text-teal-strong">Ledger</span>
        <span className="ml-auto whitespace-nowrap text-[14px] font-bold text-ink-soft">{fmtHKD(total)} · {shown.length} 筆</span>
      </div>
      <div className="mt-2 rounded-card p-[5px] shadow-sm" style={mustardStripe}>
        <div className="flex gap-2 rounded-[19px] bg-cream-soft/75 p-1.5">
          <button type="button" data-testid="ledger-scan" onClick={onScan} className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control bg-teal-strong py-3 text-[16px] font-bold text-white shadow-sm">{Icon.camera()}掃描收據</button>
          <button type="button" data-testid="ledger-add" onClick={onAdd} className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-line bg-cream-soft py-3 text-[16px] font-bold text-ink shadow-sm">{Icon.plus()}記一筆</button>
        </div>
      </div>

      {/* Search + filters on ONE line (scrolls sideways) */}
      <div className="mt-3">
        <ChipRow label="搜尋及篩選">
          <label className="flex w-28 shrink-0 items-center gap-1 rounded-pill border border-line bg-cream-soft px-2.5 py-1 text-ink-muted shadow-sm">
            {Icon.search('h-4 w-4 shrink-0')}
            <input aria-label="搜尋" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋" className="w-full min-w-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted" />
          </label>
          {['全部', ...REF_PEOPLE].map((p) => <Chip key={p} active={person === p} onClick={() => setPerson(p)}>{p} ({counts[p] || 0})</Chip>)}
          <select aria-label="類別" value={category} onChange={(e) => setCategory(e.target.value)} className={`${selectChip} ${category === '全部' ? 'border-line bg-cream-soft text-ink-soft' : 'border-teal-strong bg-teal-strong text-white'}`}>
            <option value="全部">類別 ▾</option>
            {REF_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="日期" value={date} onChange={(e) => setDate(e.target.value)} className={`${selectChip} ${date === '全部' ? 'border-line bg-cream-soft text-ink-soft' : 'border-teal-strong bg-teal-strong text-white'}`}>
            <option value="全部">日期 ▾</option>
            <option value="undated">未有日期</option>
            {dates.map((d) => <option key={d} value={d}>{zhDate(d)}</option>)}
          </select>
        </ChipRow>
      </div>

      <div className="mt-2 space-y-4 pb-4">
        {groups.map((g) => (
          <section key={g.key} data-testid={`ledger-group-${g.key}`}>
            <div className="sticky top-[68px] z-10 -mx-1 flex items-center gap-2 rounded-control bg-cream/95 px-1 py-1.5 backdrop-blur">
              {g.iso ? (
                <button type="button" onClick={() => onOpenDay(g.iso)} className="whitespace-nowrap text-[15px] font-bold text-ink">{zhDate(g.iso)}</button>
              ) : (
                <span className="whitespace-nowrap rounded-control border border-coral bg-coral-soft px-2 py-0.5 text-[13px] font-bold text-coral-ink">{g.label}</span>
              )}
              <span className="h-px flex-1 border-t border-dashed border-line" />
              <span className="whitespace-nowrap text-[14px] font-bold text-ink-soft">{fmtHKD(g.total)}</span>
            </div>
            <div className="mt-1.5 space-y-2.5">
              {g.items.map((e) => <ExpenseCard key={e.id} expense={e} onEdit={onEdit} onDelete={onDelete} />)}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p className="py-8 text-center text-[14px] text-ink-muted">沒有符合的消費。</p>}
      </div>
    </div>
  );
}
