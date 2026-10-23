import { palette } from '../../theme/tokens';
import { RoundStamp, Tape, ruledPaper } from './parts';
import { splitHKD } from './refLedgerTotal';

function formatSubLine(jpy, count) {
  const safeCount = Number(count) || 0;
  const safeJpy = Math.round(Number(jpy) || 0);
  if (safeJpy > 0) {
    return `¥${safeJpy.toLocaleString('en-US')} · ${safeCount} 筆`;
  }
  return `${safeCount} 筆`;
}

function resolvePostmarkTop(tripName) {
  const raw = String(tripName || '').trim();
  if (!raw || raw.startsWith('東京')) return 'TOKYO';
  if (raw.startsWith('大阪')) return 'OSAKA';
  const firstWord = raw.split(/\s+/)[0] || 'TOKYO';
  const chars = Array.from(firstWord);
  const isAscii = /^[\x20-\x7E]+$/.test(firstWord);
  return chars.slice(0, isAscii ? 6 : 4).join('');
}

function FilteredStamp({ className = 'right-3 top-3' }) {
  return (
    <span
      data-testid="ledger-total-stamp"
      aria-hidden="true"
      className={`pointer-events-none absolute ${className} z-20 rotate-[-8deg] whitespace-nowrap rounded-md border-2 border-dashed border-coral-ink bg-coral-soft/40 px-2 py-0.5 text-meta font-bold text-coral-ink opacity-90`}
    >
      已篩選
    </span>
  );
}

function BudgetBlock({ budget, filtered, penStroke = false }) {
  if (!budget) return null;
  const spentFmt = splitHKD(budget.spent);
  const budgetFmt = splitHKD(budget.budget);
  const overFmt = splitHKD(budget.overBy);

  const leftText = budget.over
    ? `已用 ${budget.pct}% · 超支 ${overFmt.prefix}${overFmt.digits}`
    : `已用 ${budget.pct}%`;
  const rightText = `${spentFmt.prefix}${spentFmt.digits} / ${budgetFmt.prefix}${budgetFmt.digits}`;

  return (
    <div data-testid="ledger-budget" className="space-y-1.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2 whitespace-nowrap">
        <span
          data-testid="ledger-budget-pct"
          className={`whitespace-nowrap text-meta font-bold tabular-nums ${
            budget.over ? 'text-coral-ink' : 'text-teal-strong'
          }`}
        >
          {leftText}
        </span>
        <span className="whitespace-nowrap font-mono text-meta font-medium tabular-nums text-ink-muted">
          {rightText}
        </span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-pill border border-line bg-beige/75">
        <div
          className={`h-full rounded-pill ${budget.over ? 'bg-coral' : 'bg-teal-strong'}`}
          style={{ width: `${budget.barPct}%` }}
        />
        {filtered && budget.filteredPct !== null && (
          <div
            aria-label={`已篩選佔預算 ${budget.filteredPct}%`}
            className="absolute inset-y-0 left-0 rounded-pill border-r border-cream-soft/80 bg-mustard"
            style={{ width: `${budget.filteredPct}%` }}
          />
        )}
        {penStroke ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 240 12"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <path
              d="M2 2 Q120 0.5 238 2.2 M2 10.2 Q120 11.4 238 9.8"
              fill="none"
              stroke={palette['ink-muted']}
              strokeWidth="0.9"
              strokeDasharray="5 3"
              strokeLinecap="round"
              opacity="0.45"
            />
          </svg>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-pill border border-dashed border-line/70"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Prominent 帳本 (Ledger) total card with two stationery variants:
 * - Variant A ('a'): Train ticket with punch holes, perforation stub, and marker underline.
 * - Variant B ('b'): Postmark diary page with ruled paper, washi tape, and round postmark.
 */
export default function LedgerTotalCard({ variant = 'a', summary, tripName }) {
  const activeVariant = variant === 'b' ? 'b' : 'a';
  const hkd = summary?.hkd ?? 0;
  const count = summary?.count ?? 0;
  const jpy = summary?.jpy ?? 0;
  const filtered = Boolean(summary?.filtered);
  const budget = summary?.budget ?? null;

  const { prefix, digits } = splitHKD(hkd);
  const subText = formatSubLine(jpy, count);
  const ariaLabel = `${filtered ? '已篩選總額' : '帳本總額'} ${prefix}${digits}，${count} 筆`;

  if (activeVariant === 'b') {
    const postmarkTop = resolvePostmarkTop(tripName);
    return (
      <section
        data-testid="ledger-total-card"
        data-variant="b"
        aria-label={ariaLabel}
        className="relative rounded-card border border-line bg-cream-soft p-4 shadow-sm"
        style={ruledPaper}
      >
        <Tape tone="teal" className="-top-2 left-1/2 z-20 h-4 w-24 -translate-x-1/2 -rotate-3" />
        {filtered && <FilteredStamp className="right-2.5 top-2" />}

        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="whitespace-nowrap text-meta font-semibold tracking-wide text-ink-muted">
              總支出 <span className="font-script text-sm text-teal-strong">Total spent</span>
            </p>
            <div
              data-testid="ledger-total-amount"
              className="inline-flex items-baseline gap-1 whitespace-nowrap font-display tabular-nums text-ink"
            >
              <span className="text-xl font-bold leading-none text-teal-strong">{prefix}</span>
              <span className="text-[34px] font-bold leading-none tracking-[-0.02em]">{digits}</span>
            </div>
            <p
              data-testid="ledger-total-sub"
              className="whitespace-nowrap font-mono text-meta font-semibold tabular-nums text-ink-soft"
            >
              {subText}
            </p>
          </div>

          <div className="relative flex shrink-0 items-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 36 28"
              className="pointer-events-none -mr-2 h-7 w-9 text-coral-ink opacity-45"
              fill="none"
            >
              <path
                d="M1 6 Q9 2 18 6 T35 6 M1 14 Q9 10 18 14 T35 14 M1 22 Q9 18 18 22 T35 22"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <RoundStamp top={postmarkTop} bottom={`${count} 筆`} />
          </div>
        </div>

        {budget && (
          <div className="mt-3 pt-2.5">
            <svg
              aria-hidden="true"
              viewBox="0 0 240 4"
              preserveAspectRatio="none"
              className="mb-2 block h-1 w-full"
            >
              <path
                d="M1 2 Q60 0.6 120 2.2 T239 1.8"
                fill="none"
                stroke={palette.line}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <BudgetBlock budget={budget} filtered={filtered} penStroke />
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="ledger-total-card"
      data-variant="a"
      aria-label={ariaLabel}
      className="relative overflow-visible rounded-2xl border border-line bg-cream-soft shadow-sm"
    >
      {/* Top main ticket area */}
      <div className="relative px-4 pb-3.5 pt-3.5 text-center">
        {/* Top-left rotated airplane sticker */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3 flex h-9 w-9 rotate-12 select-none items-center justify-center rounded-full border border-teal/30 bg-teal-soft text-base leading-none shadow-sm"
        >
          ✈️
        </span>

        {/* Top-right filtered rubber stamp */}
        {filtered && <FilteredStamp className="right-3 top-3" />}

        {/* Ticket header label */}
        <p className="whitespace-nowrap px-12 text-meta font-bold tracking-[0.1em] text-ink-muted">
          {filtered ? '已篩選 · 總支出' : 'TOTAL · 總支出'}
        </p>

        {/* Big amount + hand-drawn marker underline */}
        <div className="mt-1 inline-flex flex-col items-center">
          <div
            data-testid="ledger-total-amount"
            className="inline-flex items-baseline justify-center gap-1 whitespace-nowrap font-display tabular-nums text-ink"
          >
            <span className="text-xl font-bold leading-none text-teal-strong">{prefix}</span>
            <span className="text-[34px] font-bold leading-none tracking-[-0.02em]">{digits}</span>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 140 10"
            preserveAspectRatio="none"
            className="mt-0.5 h-2.5 w-[72%]"
          >
            <path
              d="M4 6 Q42 2.5 76 5.8 T136 4.5"
              fill="none"
              stroke={palette.mustard}
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
        </div>

        {/* Sub line */}
        <p
          data-testid="ledger-total-sub"
          className="mt-1 whitespace-nowrap font-mono text-meta font-semibold tabular-nums text-ink-soft"
        >
          {subText}
        </p>
      </div>

      {/* Horizontal perforation + punch holes + bottom stub */}
      <div className="relative border-t-2 border-dashed border-line px-4 py-2.5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-line bg-cream"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border border-line bg-cream"
        />

        {budget ? (
          <BudgetBlock budget={budget} filtered={filtered} />
        ) : (
          <p className="truncate whitespace-nowrap text-center font-mono text-meta font-semibold tracking-wider text-ink-muted">
            {tripName || '旅遊手札'} · ADMIT ONE
          </p>
        )}
      </div>
    </section>
  );
}
