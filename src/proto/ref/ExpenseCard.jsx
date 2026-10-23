import { useEffect, useRef, useState } from 'react';
import { CATEGORY_DOT, Icon, ZigZag } from './parts';
import { fmtHKD, fmtJPY } from './refLogic';

/** Compact receipt card (approved refinement 2): 編輯／刪除 live in a ⋯ menu; delete asks first. */
export default function ExpenseCard({ expense, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  return (
    <div className="relative" data-testid={`expense-${expense.id}`}>
      <div className="flex gap-2 rounded-t-card border border-b-0 border-line bg-cream-soft px-3 pb-2 pt-2.5 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-control border border-line bg-cream px-1.5 py-0.5 text-meta font-bold text-ink">
              <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[expense.category] || 'bg-ink-muted'}`} />
              {expense.category}
            </span>
            <span className="whitespace-nowrap rounded-control border border-sage bg-teal-soft px-1.5 py-0.5 text-meta font-bold text-teal-strong">{expense.assignedTo}</span>
            <span className="whitespace-nowrap text-meta text-ink-muted">{expense.scanned ? '掃描' : '手動'}</span>
          </div>
          <div className="mt-1 whitespace-nowrap text-[16px] font-bold text-ink">{expense.store}</div>
          {expense.place && (
            <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-meta text-ink-muted">{Icon.pin('h-3.5 w-3.5')}{expense.place}</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="whitespace-nowrap text-[20px] font-bold leading-7 text-ink">{fmtHKD(expense.hkdAmount)}</span>
          {expense.currency !== 'HKD' && <span className="whitespace-nowrap text-meta text-ink-muted">{fmtJPY(expense.originalAmount)}</span>}
          <div className="relative mt-auto" ref={ref}>
            <button type="button" aria-label="更多動作" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="-mb-1 -mr-1.5 flex h-8 w-9 items-center justify-center rounded-full text-ink-soft active:bg-beige">
              {Icon.dots()}
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 top-9 z-30 w-32 overflow-hidden rounded-control border border-line bg-cream-soft shadow-lg">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onEdit(expense); }} className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[15px] text-ink active:bg-beige">{Icon.pencil()} 編輯</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setConfirm(true); }} className="flex w-full items-center gap-2 whitespace-nowrap border-t border-line px-3 py-2.5 text-[15px] text-coral-ink active:bg-coral-soft">{Icon.trash()} 刪除</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <ZigZag />
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6" role="dialog" aria-modal="true" aria-label="刪除確認">
          <div className="w-full max-w-xs rounded-card border border-line bg-cream-soft p-4 shadow-xl">
            <p className="whitespace-nowrap font-display text-[18px] text-ink">刪除這筆消費？</p>
            <p className="mt-1 text-[14px] text-ink-soft">{expense.store} · {fmtHKD(expense.hkdAmount)}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="flex-1 whitespace-nowrap rounded-control border border-line bg-cream py-2.5 font-bold text-ink">取消</button>
              <button type="button" data-testid="confirm-delete" onClick={() => { setConfirm(false); onDelete(expense); }} className="flex-1 whitespace-nowrap rounded-control bg-coral-ink py-2.5 font-bold text-white">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** One-line chip row (approved refinement 1): never wraps, scrolls sideways if needed. */
export function ChipRow({ children, label }) {
  return (
    <div data-noswipe className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children, testid }) {
  return (
    <button
      type="button"
      data-testid={testid}
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[13px] font-bold ${active ? 'border-teal-strong bg-teal-strong text-white' : 'border-sage bg-teal-soft text-teal-strong'}`}
    >
      {children}
    </button>
  );
}
