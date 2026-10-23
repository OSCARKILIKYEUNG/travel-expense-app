import { palette } from '../../theme/tokens';
import { STICKERS } from './mockRefTrip';

/** Visual stationery helpers for ?proto=ref. Uses theme tokens only (no hex literals). */

export const paperDots = {
  backgroundColor: palette.cream,
  backgroundImage: `radial-gradient(${palette.beige} 0.75px, transparent 0.95px)`,
  backgroundSize: '5px 5px',
};

export const cardDots = {
  backgroundColor: palette['cream-soft'],
  backgroundImage: `radial-gradient(${palette.line} 1px, transparent 1.2px)`,
  backgroundSize: '15px 15px',
};

export const ruledPaper = {
  backgroundImage: `repeating-linear-gradient(180deg, transparent 0 26px, ${palette.line} 26px 27px)`,
};

export const airmail = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, rgb(var(--c-coral) / 0.45) 0 10px, rgb(var(--c-cream-soft)) 10px 18px, rgb(var(--c-teal) / 0.45) 18px 28px, rgb(var(--c-cream-soft)) 28px 36px)',
  boxShadow: '0 10px 24px rgb(var(--c-ink) / 0.07)',
};

export const mustardStripe = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, rgb(var(--c-mustard) / 0.28) 0 10px, rgb(var(--c-mustard-soft) / 0.95) 10px 20px)',
};

export const bannerStripe = {
  backgroundImage:
    'repeating-linear-gradient(-35deg, rgb(var(--c-mustard) / 0.34) 0 8px, rgb(var(--c-mustard-soft) / 0.94) 8px 16px)',
};

export const washiNav = {
  backgroundImage:
    'repeating-linear-gradient(90deg, rgb(var(--c-mustard)) 0 12px, rgb(var(--c-teal) / 0.55) 12px 18px, rgb(var(--c-coral) / 0.45) 18px 24px, rgb(var(--c-cream-soft)) 24px 30px)',
};

const TAPE_PATTERNS = {
  coral:
    'repeating-linear-gradient(-45deg, rgb(var(--c-coral) / 0.55) 0 6px, rgb(var(--c-sakura-soft) / 0.85) 6px 12px)',
  teal:
    'repeating-linear-gradient(45deg, rgb(var(--c-teal) / 0.42) 0 6px, rgb(var(--c-teal-soft) / 0.9) 6px 12px)',
  sakura:
    'repeating-linear-gradient(45deg, rgb(var(--c-sakura) / 0.65) 0 7px, rgb(var(--c-cream-soft) / 0.9) 7px 14px)',
  sage:
    'repeating-linear-gradient(-45deg, rgb(var(--c-sage) / 0.65) 0 6px, rgb(var(--c-cream-soft) / 0.88) 6px 12px)',
  mustard:
    'repeating-linear-gradient(-35deg, rgb(var(--c-mustard) / 0.62) 0 8px, rgb(var(--c-mustard-soft) / 0.92) 8px 15px)',
};

export function Tape({ tone = 'coral', className = '' }) {
  const bg = TAPE_PATTERNS[tone] || TAPE_PATTERNS.coral;
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inline-block h-4 w-20 rounded-sm border border-line/60 shadow-sm ${className}`}
      style={{ backgroundImage: bg }}
    />
  );
}

export function RoundStamp({ top, bottom, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative flex h-[72px] w-[72px] shrink-0 rotate-6 flex-col items-center justify-center rounded-full border-2 border-dashed border-coral-ink/75 bg-coral-soft/45 px-1 text-center shadow-sm ${className}`}
    >
      <span className="pointer-events-none absolute inset-1 rounded-full border border-coral-ink/40" />
      <span className="relative whitespace-nowrap font-script text-[14px] font-bold leading-tight text-coral-ink">
        {top}
      </span>
      <span className="relative my-0.5 h-px w-10 bg-coral-ink/45" />
      <span className="relative whitespace-nowrap font-script text-meta font-bold leading-none text-coral-ink">
        {bottom}
      </span>
    </div>
  );
}

export function DayStamp({ top, bottom, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none flex h-20 w-20 shrink-0 -rotate-6 flex-col items-center justify-center rounded-full border-[3px] border-double border-coral-ink bg-coral-soft text-coral-ink ${className}`}
    >
      <span className="whitespace-nowrap font-script text-2xl leading-none">{top}</span>
      <span className="whitespace-nowrap font-script text-sm leading-none">{bottom}</span>
    </div>
  );
}

export function HandRing({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 56 56"
      fill="none"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    >
      <path
        d="M27 4 C42 3 52 12 52 27 C52 43 40 53 26 52 C11 51 3 40 4 26 C5 12 16 5 31 6"
        stroke={palette.mustard}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M24 6 C39 5 49 14 50 28 C50 41 39 50 25 50 C12 49 6 39 6 27"
        stroke={palette['mustard-ink']}
        strokeWidth="1.1"
        strokeDasharray="3 2"
        strokeLinecap="round"
        strokeOpacity="0.7"
      />
    </svg>
  );
}

const TEETH = Array.from({ length: 37 }, (_, i) => `${i * 6} ${i % 2 ? 8 : 0}`).join(' L');

export function ZigZag({ className = '' }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none -mt-px h-2.5 w-full overflow-hidden ${className}`}>
      <svg viewBox="0 0 216 9" preserveAspectRatio="none" className="block h-full w-full">
        <path d={`M${TEETH} Z`} fill={palette['cream-soft']} stroke={palette.line} strokeWidth="1" />
      </svg>
    </div>
  );
}

export function Sakura({ className = 'h-7 w-7' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`pointer-events-none ${className}`}>
      <g fill={palette.sakura}>
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="12" cy="5.2" rx="2.7" ry="4" transform={`rotate(${r} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="1.7" fill={palette.mustard} />
    </svg>
  );
}

export function Sparkle({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`pointer-events-none ${className}`}>
      <path d="M8 0 L9.15 6.85 L16 8 L9.15 9.15 L8 16 L6.85 9.15 L0 8 L6.85 6.85 Z" fill={palette.mustard} />
    </svg>
  );
}

const EMOJI_BY_ID = Object.fromEntries(STICKERS.map((s) => [s.id, s.emoji]));

export function StickerGraphic({ id, className = 'text-sm leading-none' }) {
  const glyph = EMOJI_BY_ID[id];
  if (!glyph) return null;
  return (
    <span aria-hidden="true" className={`select-none ${className}`}>
      {glyph}
    </span>
  );
}

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const Icon = {
  pin: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  ),
  globe: (c = 'h-3.5 w-3.5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </svg>
  ),
  chevDown: (c = 'h-3.5 w-3.5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevL: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  chevR: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  back: (c = 'h-5 w-5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  camera: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  ),
  plus: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  home: (c = 'h-[22px] w-[22px]') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M4 10l8-6.5L20 10v10h-5v-6H9v6H4z" />
    </svg>
  ),
  book: (c = 'h-[22px] w-[22px]') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" />
    </svg>
  ),
  chart: (c = 'h-[22px] w-[22px]') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M6 20v-6M12 20V5M18 20v-9" />
    </svg>
  ),
  gear: (c = 'h-[22px] w-[22px]') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  dots: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  pencil: (c = 'h-3.5 w-3.5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </svg>
  ),
  trash: (c = 'h-3.5 w-3.5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
    </svg>
  ),
  search: (c = 'h-3.5 w-3.5') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  ),
  x: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  calendar: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  check: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
};

export const CATEGORY_DOT = {
  飲食: 'bg-coral',
  交通: 'bg-teal',
  購物: 'bg-sakura-ink',
  住宿: 'bg-mustard',
  娛樂: 'bg-sage',
  其他: 'bg-ink-muted',
};

export const CATEGORY_BADGE = {
  飲食: 'border-coral/50 bg-coral-soft/65 text-ink',
  交通: 'border-teal/40 bg-teal-soft/75 text-ink',
  購物: 'border-sakura/70 bg-sakura-soft/80 text-ink',
  住宿: 'border-mustard/60 bg-mustard-soft/80 text-ink',
  娛樂: 'border-sage bg-teal-soft/55 text-ink',
  其他: 'border-line bg-beige/65 text-ink',
};
