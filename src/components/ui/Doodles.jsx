import { palette } from '../../theme/tokens';

function toneFill(tone, fallback) {
  return palette[tone] || fallback;
}

export function CornerBlob({ className = '', tone = 'sage' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`pointer-events-none ${className}`}
    >
      <path
        fill={toneFill(tone, palette.sage)}
        fillOpacity="0.55"
        d="M62 6c16 1 27 12 34 26 7 14 20 20 18 36-3 18-18 32-36 38-20 6-42-2-54-16C10 76 2 58 8 40 14 20 32 4 62 6z"
      />
    </svg>
  );
}

export function DashedRoute({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 168 52"
      className={`pointer-events-none ${className}`}
      fill="none"
    >
      <path
        d="M4 38C34 38 42 10 80 14c30 3 38 26 84 16"
        stroke={palette.ink}
        strokeWidth="1.5"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
      <path fill={palette.ink} d="M150 22l14 8-14 5 3-6.5z" />
    </svg>
  );
}

export function Sparkle({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`pointer-events-none ${className}`}
    >
      <path fill={palette.mustard} d="M8 0l1.15 6.85L16 8l-6.85 1.15L8 16l-1.15-6.85L0 8l6.85-1.15z" />
    </svg>
  );
}

export function Sakura({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`pointer-events-none ${className}`}
    >
      <g fill={palette.sakura}>
        <ellipse cx="12" cy="5.2" rx="2.7" ry="4" />
        <ellipse cx="12" cy="5.2" rx="2.7" ry="4" transform="rotate(72 12 12)" />
        <ellipse cx="12" cy="5.2" rx="2.7" ry="4" transform="rotate(144 12 12)" />
        <ellipse cx="12" cy="5.2" rx="2.7" ry="4" transform="rotate(216 12 12)" />
        <ellipse cx="12" cy="5.2" rx="2.7" ry="4" transform="rotate(288 12 12)" />
      </g>
      <circle cx="12" cy="12" r="1.7" fill={palette.mustard} />
    </svg>
  );
}

export function NotebookBackdrop({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream text-ink">
      <CornerBlob className="absolute -left-16 -top-24 h-64 w-64" tone="sage" />
      <CornerBlob className="absolute -right-24 -bottom-16 h-72 w-72" tone="sakura" />
      <DashedRoute className="absolute left-2 top-6 hidden h-14 w-48 sm:block" />
      <Sparkle className="absolute right-8 top-10 h-4 w-4" />
      <Sparkle className="absolute right-24 top-28 h-3 w-3" />
      <Sakura className="absolute bottom-12 left-6 h-7 w-7" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}

export function BrandRibbon({ name }) {
  return (
    <div className="mb-6 text-center">
      <p className="script-accent text-2xl leading-none">Travel notebook</p>
      <div className="relative mx-auto mt-2 inline-flex px-7 py-1.5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -skew-x-6 rounded-sm bg-mustard" />
        <span className="relative font-display text-2xl leading-none text-ink">{name}</span>
      </div>
    </div>
  );
}
