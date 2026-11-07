import { useTranslation } from 'react-i18next';
import '../../i18n';
import { WashiLabel } from '../../journal/art/decor.jsx';
import { budgetRemaining } from './homeCost';
import { fmtHKD } from './refLogic';

function FilteredStamp({ label }) {
  return (
    <span
      data-testid="ledger-total-stamp"
      aria-hidden="true"
      className="pointer-events-none shrink-0 whitespace-nowrap rounded-sm border border-dashed border-stamp bg-paper px-2 py-0.5 font-hand text-xs font-bold text-stamp"
    >
      {label}
    </span>
  );
}

function BudgetBlock({ budget, filtered, t }) {
  const rem = budgetRemaining(budget?.budget, budget?.spent);
  if (!budget || !rem) return null;

  const leftText = rem.over
    ? t('notebook.ledger.budgetOver', { pct: budget.pct, over: fmtHKD(rem.overBy) })
    : t('notebook.ledger.budgetUsed', { pct: budget.pct });
  const rightText = t('notebook.ledger.budgetRemaining', { amount: fmtHKD(rem.remaining) });

  const barPct = Math.min(100, Math.max(0, Number(budget.barPct) || 0));
  const hasFiltered = Boolean(filtered && budget.filteredPct !== null && budget.filteredPct !== undefined);
  const filteredPct = hasFiltered ? Math.min(100, Math.max(0, Number(budget.filteredPct) || 0)) : 0;

  return (
    <div
      data-testid="ledger-budget"
      className="mt-2 min-w-0 border-t border-dashed border-ink-soft/30 pt-1.5"
    >
      <div className="relative ml-[3.5px] mr-3 h-5">
        {hasFiltered && (
          <span
            aria-label={t('notebook.ledger.filteredBudgetAria', { pct: budget.filteredPct })}
            className="sr-only"
          />
        )}
        <svg
          aria-hidden="true"
          focusable="false"
          fill="none"
          className="block h-5 w-full overflow-visible"
        >
          {barPct > 0 && (
            <line
              x1="0%"
              y1="14"
              x2={`${barPct}%`}
              y2="14"
              stroke={rem.over ? 'rgb(var(--c-wash-berry) / 0.45)' : 'rgb(var(--c-wash-sky))'}
              strokeWidth="6"
              strokeLinecap="round"
            />
          )}
          {barPct < 100 && (
            <line
              x1={`${barPct}%`}
              y1="14"
              x2="100%"
              y2="14"
              stroke="rgb(var(--c-route))"
              strokeWidth="2"
              strokeDasharray="0 6"
              strokeLinecap="round"
            />
          )}
          {barPct > 0 && (
            <line
              x1="0%"
              y1="14"
              x2={`${barPct}%`}
              y2="14"
              stroke={rem.over ? 'rgb(var(--c-stamp))' : 'rgb(var(--c-route))'}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}
          {hasFiltered && filteredPct > 0 && (
            <line
              x1="0%"
              y1="14"
              x2={`${filteredPct}%`}
              y2="14"
              stroke="rgb(var(--c-wash-wheat))"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          )}
          <circle cx="0%" cy="14" r="3.5" fill="rgb(var(--c-route))" />
          <svg x="100%" y="0" className="overflow-visible">
            <line
              x1="0"
              y1="3"
              x2="0"
              y2="17"
              stroke="rgb(var(--c-ink))"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
            <path
              d="M0 3 L12 7 L0 11 Z"
              fill="rgb(var(--c-stamp) / 0.8)"
              stroke="rgb(var(--c-ink))"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <circle cx="0" cy="17" r="2" fill="rgb(var(--c-route))" />
          </svg>
          <circle
            cx={`${barPct}%`}
            cy="14"
            r="5"
            fill="rgb(var(--c-route-soft))"
            stroke="rgb(var(--c-route))"
            strokeWidth="1.35"
          />
          <circle cx={`${barPct}%`} cy="14" r="2.2" fill="rgb(var(--c-stamp))" />
        </svg>
      </div>

      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 font-display text-xs tabular-nums">
        <span
          data-testid="ledger-budget-pct"
          className={`min-w-0 truncate whitespace-nowrap tabular-nums ${
            rem.over ? 'font-bold text-stamp' : 'meta-quiet font-medium text-ink-muted'
          }`}
        >
          {leftText}
        </span>
        <span
          data-testid="ledger-budget-remaining"
          className={`font-money story-critical min-w-0 truncate whitespace-nowrap font-bold tabular-nums ${
            rem.over ? 'text-stamp' : 'text-ink'
          }`}
        >
          {rightText}
        </span>
      </div>
    </div>
  );
}

/**
 * Glanceable 帳本 (Ledger) grid-paper total card with WashiLabel and dotted route progress line.
 */
export default function LedgerTotalCard({ summary }) {
  const { t } = useTranslation();
  const hkd = summary?.hkd ?? 0;
  const count = summary?.count ?? 0;
  const filtered = Boolean(summary?.filtered);
  const budget = summary?.budget ?? null;

  const amountLabel = fmtHKD(hkd);
  const safeCount = Number(count) || 0;
  const countLabel = t('notebook.ledger.totalCount', { count: safeCount });
  const ariaLabel = t(
    filtered ? 'notebook.ledger.totalCardFilteredAria' : 'notebook.ledger.totalCardAria',
    { amount: amountLabel, count: safeCount },
  );

  return (
    <section
      data-testid="ledger-total-card"
      data-variant="a"
      aria-label={ariaLabel}
      className="jr-taped-card jr-grid relative min-w-0 px-3.5 pb-2.5 pt-2.5"
    >
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
        <WashiLabel tilt={-1}>
          {filtered ? t('notebook.ledger.totalHeaderFiltered') : t('notebook.ledger.totalHeader')}
        </WashiLabel>
        {filtered && <FilteredStamp label={t('notebook.ledger.filteredStamp')} />}
      </div>

      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <div
          data-testid="ledger-total-amount"
          className="font-money story-critical max-w-full truncate whitespace-nowrap font-display text-2xl font-bold leading-tight tracking-tight tabular-nums text-ink lg:text-hero-sm"
        >
          {amountLabel}
        </div>
        <span
          data-testid="ledger-total-sub"
          className="meta-quiet whitespace-nowrap font-display text-xs font-medium tabular-nums text-ink-muted"
        >
          {countLabel}
        </span>
      </div>

      {budget ? <BudgetBlock budget={budget} filtered={filtered} t={t} /> : null}
    </section>
  );
}
