import { useTranslation } from 'react-i18next';
import '../i18n';

/**
 * CSS calc positions for the desktop `lg` (>=1024px) two-page spread gutter.
 * - 'home': gap between col 5 and col 6 of a 12-col grid with gap-x-6 (1.5rem) and px-4 (1rem) container padding
 * - 'ledger': gap between col 5 and col 6 of the same 12-col grid
 * - 'half': 50% center fold (for 2-col Charts / DayView)
 * - null / other: single page, no gutter
 */
export const SPREAD_GUTTER_CALC = {
  home: 'calc(1rem + (100% - 2rem - 11 * 1.5rem) * 5 / 12 + 4.5 * 1.5rem)',
  ledger: 'calc(1rem + (100% - 2rem - 11 * 1.5rem) * 5 / 12 + 4.5 * 1.5rem)',
  half: '50%',
};

/**
 * Shared notebook page frame (`src/journal/JournalPage.jsx`):
 * - Mobile (<lg): desk background (~8px visible each side), single paper sheet with faint grid,
 *   left stitched/ring binding, top-right stamp ribbon bookmark, bottom-right curled page corner,
 *   hand-lettered dateLine header rule, and page number footer rule with small kraft washi piece.
 * - Desktop (lg >=1024px): centered open two-page journal spread (max-w-6xl), stacked page edges
 *   at both sides, centre-gutter shadow positioned by `spread`, and ribbon hanging near the gutter.
 * - Every decorative node is `aria-hidden="true"`, `pointer-events-none`, and has no `data-testid`.
 * - Ancestors of `children` never set `overflow-hidden` so `lg:sticky` rails work unimpeded.
 */
export default function JournalPage({
  children,
  pageNumber = 1,
  dateLine = '',
  spread = null,
  className = '',
}) {
  const { t } = useTranslation();
  const resolvedPage = Number.isFinite(Number(pageNumber)) && Number(pageNumber) > 0 ? Number(pageNumber) : 1;
  const gutterPos = spread && SPREAD_GUTTER_CALC[spread] ? SPREAD_GUTTER_CALC[spread] : null;
  const sheetStyle = gutterPos ? { '--jr-gutter-x': gutterPos } : undefined;
  const footerText = t('notebook.page.footer', { n: resolvedPage });

  return (
    <div className={`jr-desk w-full px-2 py-2 lg:px-4 lg:py-5 ${className}`.trim()}>
      <div
        className="jr-page-sheet jr-paper mx-auto max-w-5xl lg:max-w-6xl"
        style={sheetStyle}
      >
        {/* Mobile-only left stitched spine & punched ring holes */}
        <div
          aria-hidden="true"
          data-jr-decor="binding"
          className="jr-binding pointer-events-none select-none lg:hidden"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 48"
            className="pointer-events-none block h-12 w-4 text-kraft-ink/55"
          >
            <line
              x1="0"
              y1="18"
              x2="7"
              y2="18"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle
              cx="8"
              cy="18"
              r="3"
              fill="rgb(var(--c-desk))"
              stroke="rgb(var(--c-ink-soft) / 0.55)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Desktop lg centre-gutter shadow + fold line (omitted when spread is null) */}
        {gutterPos ? (
          <div
            aria-hidden="true"
            data-jr-decor="gutter"
            data-spread={spread}
            className="jr-spread-gutter pointer-events-none hidden select-none lg:block"
          />
        ) : null}

        {/* Hanging stamp-red cloth ribbon bookmark (top-right on mobile, near gutter on lg spread) */}
        <div
          aria-hidden="true"
          data-jr-decor="ribbon"
          className={`jr-ribbon pointer-events-none select-none ${
            gutterPos ? 'jr-ribbon-spread' : ''
          }`.trim()}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="22"
            height="42"
            viewBox="0 0 22 42"
            className="pointer-events-none block"
          >
            <path d="M5 2 H19 V38 L12 32 L5 38 Z" fill="rgb(var(--c-ink) / 0.16)" />
            <path
              d="M3 0 H17 V36 L10 30 L3 36 Z"
              fill="rgb(var(--c-stamp))"
              stroke="rgb(var(--c-stamp))"
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <line
              x1="5.5"
              y1="2"
              x2="5.5"
              y2="32"
              stroke="rgb(var(--c-wash-wheat) / 0.75)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
            <line
              x1="14.5"
              y1="2"
              x2="14.5"
              y2="32"
              stroke="rgb(var(--c-wash-wheat) / 0.75)"
              strokeWidth="0.8"
              strokeDasharray="2 2"
            />
          </svg>
        </div>

        {/* Page header: dateLine (font-hand, ink-soft, 14px) + thin ink-soft rule */}
        <div className="relative z-10 pl-5 pr-9 pt-2.5 lg:px-4 lg:pt-3">
          <div className="flex items-baseline justify-between gap-2 border-b border-ink-soft/40 pb-1.5">
            <p className="min-w-0 truncate font-hand text-sm text-ink-soft">
              {dateLine}
            </p>
          </div>
        </div>

        {/* Unchanged children slot (never wrapped in overflow-hidden so lg:sticky works) */}
        <div className="jr-page-body relative z-10">
          {children}
        </div>

        {/* Page footer: 「手繪旅帳 · 第 N 頁」 above a thin rule with one small kraft washi piece */}
        <div className="relative z-10 pb-3 pl-5 pr-8 pt-2 lg:px-4 lg:pb-4">
          <div className="flex items-center justify-between gap-4 border-b border-ink-soft/40 pb-1.5 pt-1">
            <span className="font-hand text-sm text-ink-soft">
              {footerText}
            </span>
            <span
              aria-hidden="true"
              data-jr-decor="washi"
              style={{ '--jr-tilt': '-2deg' }}
              className="jr-washi pointer-events-none inline-block h-2.5 w-10 shrink-0 select-none"
            />
          </div>
        </div>

        {/* Dog-eared / curled page corner at bottom-right */}
        <div
          aria-hidden="true"
          data-jr-decor="curl"
          className="jr-page-curl pointer-events-none select-none"
        >
          <svg
            aria-hidden="true"
            focusable="false"
            width="28"
            height="28"
            viewBox="0 0 28 28"
            className="pointer-events-none block"
          >
            <polygon points="28,0 28,28 0,28" fill="rgb(var(--c-desk))" />
            <polygon points="26,2 2,26 0,22 22,0" fill="rgb(var(--c-ink) / 0.16)" />
            <path
              d="M0 28 L28 0 C19 3, 15 7, 13 13 C7 15, 3 19, 0 28 Z"
              fill="rgb(var(--c-paper-shade))"
              stroke="rgb(var(--c-ink-soft) / 0.65)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
