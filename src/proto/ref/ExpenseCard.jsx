import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CATEGORY_BADGE, CATEGORY_DOT, Icon, ZigZag } from './parts';
import { fmtHKD, fmtJPY } from './refLogic';

/** Compact receipt card with archive typography/badges/zigzag and a ⋯ action menu. */
export default function ExpenseCard({ expense, highlighted = false, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ref = useRef(null);
  const moreBtnRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const closePointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setMenu(false);
    };
    const closeKey = (e) => {
      if (e.key === 'Escape') {
        setMenu(false);
        moreBtnRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closePointer);
    document.addEventListener('keydown', closeKey);
    return () => {
      document.removeEventListener('pointerdown', closePointer);
      document.removeEventListener('keydown', closeKey);
    };
  }, [menu]);

  useEffect(() => {
    if (!confirm) return undefined;
    const closeKey = (e) => {
      if (e.key === 'Escape') setConfirm(false);
    };
    document.addEventListener('keydown', closeKey);
    return () => document.removeEventListener('keydown', closeKey);
  }, [confirm]);

  const catStyle = CATEGORY_BADGE[expense.category] || CATEGORY_BADGE.其他;
  const dotStyle = CATEGORY_DOT[expense.category] || CATEGORY_DOT.其他;

  return (
    <div
      className="relative"
      data-testid={`expense-${expense.id}`}
      data-expense-id={expense.id}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <article
        className={`flex items-start justify-between gap-3 rounded-t-card border border-b-0 px-4 pb-2.5 pt-3 shadow-sm transition-colors ${
          highlighted ? 'border-teal-strong bg-teal-soft/60 ring-2 ring-teal-strong' : 'border-line bg-cream-soft'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-meta font-bold ${catStyle}`}
            >
              <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${dotStyle}`} />
              {expense.category}
            </span>
            <span className="whitespace-nowrap rounded-md border border-teal/30 bg-teal-soft px-2 py-0.5 text-meta font-bold text-teal-strong">
              {expense.assignedTo}
            </span>
            <span className="whitespace-nowrap text-meta text-ink-muted">{expense.scanned ? '掃描' : '手動'}</span>
          </div>
          <h3 className="truncate whitespace-nowrap text-base font-bold leading-snug text-ink">{expense.store}</h3>
          {expense.place && (
            <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-meta text-ink-muted">
              {Icon.pin('h-3.5 w-3.5 shrink-0')}
              <span className="truncate">{expense.place}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <p className="whitespace-nowrap text-lg font-bold leading-6 text-ink">{fmtHKD(expense.hkdAmount)}</p>
          {expense.currency !== 'HKD' && (
            <p className="whitespace-nowrap text-meta font-medium text-ink-muted">{fmtJPY(expense.originalAmount)}</p>
          )}
          <div className="relative mt-0.5" ref={ref}>
            <button
              ref={moreBtnRef}
              type="button"
              aria-label="更多動作"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="-mb-1.5 -mr-2 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              {Icon.dots()}
            </button>
            {menu && (
              <div
                role="menu"
                className="absolute right-0 top-10 z-30 w-32 overflow-hidden rounded-2xl border border-line bg-cream-soft shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onEdit(expense);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm text-ink hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
                >
                  {Icon.pencil()} 編輯
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    setConfirm(true);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap border-t border-line px-3 py-2.5 text-sm text-coral-ink hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral-ink"
                >
                  {Icon.trash()} 刪除
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
      <ZigZag />

      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="刪除確認"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirm(false);
            }}
          >
            <div className="w-full max-w-xs rounded-card border border-line bg-cream-soft p-4 shadow-xl">
              <p className="whitespace-nowrap font-display text-lg text-ink">刪除這筆消費？</p>
              <p className="mt-1 truncate whitespace-nowrap text-sm text-ink-soft">
                {expense.store} · {fmtHKD(expense.hkdAmount)}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="min-h-11 flex-1 whitespace-nowrap rounded-2xl border border-line bg-cream py-2.5 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  取消
                </button>
                <button
                  type="button"
                  data-testid="confirm-delete"
                  onClick={() => {
                    setConfirm(false);
                    onDelete(expense);
                  }}
                  className="min-h-11 flex-1 whitespace-nowrap rounded-2xl bg-coral-ink py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** One-line horizontal chip scroller. */
export function ChipRow({ children, label }) {
  return (
    <div
      data-noswipe
      className="flex items-center gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={label}
    >
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
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-pill border px-3.5 py-2 text-meta font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
        active
          ? 'border-teal-strong bg-teal-strong text-white shadow-sm'
          : 'border-teal/40 bg-teal-soft text-teal-strong hover:bg-beige'
      }`}
    >
      {children}
    </button>
  );
}
