import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { CATEGORY_ICON, PinIcon, StarIcon } from '../../journal/art/core.jsx';
import { WashBlob } from '../../journal/art/decor.jsx';
import { runStickerPop } from '../../motion/stickerKeyframes';
import { Icon } from './parts';
import { fmtHKD, fmtJPY } from './refLogic';

const CATEGORY_WASH_TONE = {
  飲食: 'wheat',
  交通: 'sky',
  購物: 'berry',
  住宿: 'wheat',
  娛樂: 'leaf',
  其他: 'leaf',
};

const CATEGORY_WASH_SHAPE = {
  飲食: 1,
  交通: 2,
  購物: 3,
  住宿: 1,
  娛樂: 2,
  其他: 3,
};

const JOURNAL_CATEGORY_CHIP = {
  飲食: 'border-kraft-ink/35 bg-wash-wheat/55 text-kraft-ink',
  交通: 'border-route/35 bg-wash-sky/75 text-route',
  購物: 'border-stamp/40 bg-coral-soft text-stamp',
  住宿: 'border-kraft-ink/35 bg-wash-wheat/55 text-kraft-ink',
  娛樂: 'border-ink-soft/35 bg-wash-leaf/35 text-ink',
  其他: 'border-ink-soft/35 bg-wash-leaf/35 text-ink',
};

/** Compact journal paper note with torn bottom edge, category line icon on wash blob, and ⋯ action menu. */
export default function ExpenseCard({
  expense,
  highlighted = false,
  stickerPop = false,
  onStickerPlayed,
  onEdit,
  onDelete,
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const cardRef = useRef(null);
  const poppedIdRef = useRef(null);
  const ref = useRef(null);
  const moreBtnRef = useRef(null);

  useEffect(() => {
    if (!stickerPop) {
      poppedIdRef.current = null;
      return undefined;
    }
    if (!cardRef.current || poppedIdRef.current === expense.id) return undefined;
    poppedIdRef.current = expense.id;
    let cancelled = false;
    runStickerPop(cardRef.current, {
      stickerPop: true,
      expenseId: expense.id,
      onStickerPlayed: (id) => {
        if (!cancelled) onStickerPlayed?.(id);
      },
    });
    return () => {
      cancelled = true;
    };
  }, [stickerPop, expense.id, onStickerPlayed]);

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

  const CatIcon = CATEGORY_ICON[expense.category] || StarIcon;
  const washTone = CATEGORY_WASH_TONE[expense.category] || 'leaf';
  const washShape = CATEGORY_WASH_SHAPE[expense.category] || 1;
  const catStyle = JOURNAL_CATEGORY_CHIP[expense.category] || JOURNAL_CATEGORY_CHIP.其他;

  return (
    <div
      ref={cardRef}
      className="relative"
      data-testid={`expense-${expense.id}`}
      data-expense-id={expense.id}
      data-highlighted={highlighted ? 'true' : undefined}
      data-sticker-pop={stickerPop ? 'true' : undefined}
    >
      <article
        className={`jr-torn expense-row flex min-w-0 items-center gap-2 rounded-sm border px-2.5 pb-3 pt-2.5 transition-colors ${
          highlighted
            ? 'border-route bg-route-soft/65 ring-2 ring-route'
            : 'border-ink-soft/45 bg-paper'
        }`}
      >
        <WashBlob tone={washTone} shape={washShape} className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
          <CatIcon className="h-5 w-5 text-ink" />
        </WashBlob>

        <div className="expense-body min-w-0 flex-1">
          <h3 className="expense-title story-critical line-clamp-2 break-words text-sm font-bold leading-snug text-ink lg:line-clamp-1 lg:truncate lg:text-base">
            {expense.store}
          </h3>
          {expense.place && (
            <div className="expense-loc meta-quiet mt-0.5 flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-ink-muted">
              <PinIcon className="h-3.5 w-3.5 shrink-0 text-stamp" />
              <span className="min-w-0 truncate">{expense.place}</span>
            </div>
          )}
          <div className="expense-tags mt-0.5 flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
            <span
              className={`expense-tag inline-flex shrink-0 items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-hand text-xs font-bold leading-none ${catStyle}`}
            >
              <span className="truncate">
                {t(`categories.${expense.category}`, { defaultValue: expense.category })}
              </span>
            </span>
            <span className="expense-tag shrink-0 truncate whitespace-nowrap rounded-sm border border-route/30 bg-route-soft px-1.5 py-0.5 font-hand text-xs font-bold leading-none text-route">
              {expense.assignedTo === '共同' ? t('expenseCard.shared') : expense.assignedTo}
            </span>
          </div>
        </div>

        <div className="expense-amt-col max-w-[38%] shrink-0 text-right font-display tabular-nums sm:max-w-[40%]">
          <p className="expense-amount font-money story-critical truncate whitespace-nowrap text-sm font-bold leading-snug text-ink lg:text-base">
            {fmtHKD(expense.hkdAmount)}
          </p>
          {expense.currency !== 'HKD' && (
            <p className="expense-amount-sub font-money meta-quiet truncate whitespace-nowrap text-xs text-ink-muted">
              {fmtJPY(expense.originalAmount)}
            </p>
          )}
        </div>

        <div className="shrink-0" ref={ref}>
          <button
            ref={moreBtnRef}
            type="button"
            aria-label={t('notebook.expenseCard.moreActionsAria')}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
            className="-mr-1.5 flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-sm text-ink-soft hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {Icon.dots()}
          </button>
          {menu && (
            <div
              role="menu"
              className="absolute right-1 top-12 z-30 w-32 overflow-hidden rounded-sm border border-ink-soft/60 bg-paper shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  onEdit(expense);
                }}
                className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route"
              >
                {Icon.pencil()} {t('expenseCard.edit')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  setConfirm(true);
                }}
                className="flex min-h-11 w-full items-center gap-2 whitespace-nowrap border-t border-ink-soft/25 px-3 py-2.5 text-sm text-stamp hover:bg-coral-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stamp"
              >
                {Icon.trash()} {t('expenseCard.delete')}
              </button>
            </div>
          )}
        </div>
      </article>

      {confirm &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={t('deleteDialog.title')}
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirm(false);
            }}
          >
            <div className="w-full max-w-xs rounded-sm border border-ink-soft/60 bg-paper p-4 shadow-xl">
              <p className="whitespace-nowrap font-hand text-lg font-bold text-ink">
                {t('notebook.expenseCard.confirmDeleteTitle')}
              </p>
              <p className="mt-1 truncate whitespace-nowrap font-display text-sm tabular-nums text-ink-soft">
                {expense.store} · {fmtHKD(expense.hkdAmount)}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="jr-btn-paper min-h-11 flex-1 whitespace-nowrap rounded-sm py-2.5 font-hand text-sm font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  {t('deleteDialog.cancel')}
                </button>
                <button
                  type="button"
                  data-testid="confirm-delete"
                  onClick={() => {
                    setConfirm(false);
                    onDelete(expense);
                  }}
                  className="min-h-11 flex-1 whitespace-nowrap rounded-sm border border-ink-soft bg-stamp py-2.5 font-hand text-sm font-bold text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
                >
                  {t('deleteDialog.confirm')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Contained single-line horizontal segmented control row that scrolls within its parent and never widens the page. */
export function ChipRow({ children, label }) {
  return (
    <div
      data-noswipe
      className="jr-chip-row seg-control flex w-full max-w-full min-w-0 flex-nowrap items-stretch gap-0 overflow-x-auto p-0 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      className={`seg-item btn-secondary-shell inline-flex flex-1 min-h-11 min-w-11 max-w-full shrink-0 snap-start items-center justify-center truncate whitespace-nowrap rounded-sm border px-2.5 py-1.5 font-hand text-xs tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route ${
        active
          ? 'is-selected border-ink-soft bg-tape-navy font-bold text-paper'
          : 'border-ink-soft/45 bg-paper font-medium text-ink-soft hover:bg-paper-shade hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** Loading skeleton row matching ExpenseCard geometry (checklist 9). */
export function ExpenseSkeletonRow({ wide = true }) {
  return (
    <div className="skeleton-row" aria-hidden="true" data-testid="expense-skeleton-row">
      <div className="skeleton-blob skeleton-icon" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`skeleton-blob skeleton-line ${wide ? 'w-80' : 'w-60'}`} />
        <div className="skeleton-blob skeleton-line w-40" />
      </div>
      <div className="skeleton-blob skeleton-amt" />
    </div>
  );
}
