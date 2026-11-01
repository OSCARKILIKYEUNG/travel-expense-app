import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { runMotion } from '../../motion/runMotion';
import { runToastSlide } from '../../motion/stickerKeyframes';
import { DURATION_MS, EASING } from '../../motion/tokens';
import { getPrefersReducedMotion } from '../../motion/usePrefersReducedMotion';
import { palette } from '../../theme/tokens';
import {
  Bunting,
  CategorySticker,
  DOODLES,
  Doodle,
  DoodleSticker,
  RibbonBanner,
  STICKER_DOODLE_MAP,
  SunburstRays,
} from './doodles';
import { STICKERS } from './mockRefTrip';
import {
  CountryFlag,
  JAPAN_MAP_VIEWBOX,
  JapanMiniMap,
  LandscapeStrip,
  editorialTrackingClass,
  projectJapanLonLat,
  resolveTripDestination,
} from './journalAtlas';

export {
  Bunting,
  CategorySticker,
  CountryFlag,
  DOODLES,
  Doodle,
  DoodleSticker,
  JAPAN_MAP_VIEWBOX,
  JapanMiniMap,
  LandscapeStrip,
  RibbonBanner,
  STICKER_DOODLE_MAP,
  SunburstRays,
  editorialTrackingClass,
  projectJapanLonLat,
  resolveTripDestination,
};

/** Visual stationery helpers for ?proto=ref. Uses theme tokens only (no hex literals). */

export const paperDots = {
  backgroundColor: palette.cream,
  backgroundImage: [
    'radial-gradient(circle 180px at -20px 40px, rgb(var(--c-coral-soft) / 0.35) 0%, rgb(var(--c-coral-soft) / 0.35) 55%, transparent 72%)',
    'radial-gradient(ellipse 210px 160px at calc(100% + 24px) 110px, rgb(var(--c-teal-soft) / 0.35) 0%, rgb(var(--c-teal-soft) / 0.35) 58%, transparent 75%)',
    'radial-gradient(circle 190px at -30px calc(100% - 140px), rgb(var(--c-sage-soft) / 0.32) 0%, rgb(var(--c-sage-soft) / 0.32) 52%, transparent 70%)',
    'radial-gradient(ellipse 220px 150px at calc(100% + 20px) calc(100% - 60px), rgb(var(--c-sand-soft) / 0.35) 0%, rgb(var(--c-sand-soft) / 0.35) 55%, transparent 72%)',
    `radial-gradient(${palette.beige} 0.75px, transparent 0.95px)`,
  ].join(', '),
  backgroundSize: '100% 100%, 100% 100%, 100% 100%, 100% 100%, 5px 5px',
  backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat, repeat',
};

export const paperCanvas = paperDots;

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

export const TAPE_PATTERNS = {
  coral:
    'repeating-linear-gradient(-45deg, rgb(var(--c-coral) / 0.58) 0 6px, rgb(var(--c-sakura-soft) / 0.88) 6px 12px)',
  teal:
    'repeating-linear-gradient(45deg, rgb(var(--c-teal) / 0.46) 0 6px, rgb(var(--c-teal-soft) / 0.92) 6px 12px)',
  sakura:
    'repeating-linear-gradient(45deg, rgb(var(--c-sakura) / 0.68) 0 7px, rgb(var(--c-cream-soft) / 0.92) 7px 14px)',
  sage:
    'repeating-linear-gradient(-45deg, rgb(var(--c-sage) / 0.68) 0 6px, rgb(var(--c-cream-soft) / 0.9) 6px 12px)',
  mustard:
    'repeating-linear-gradient(-35deg, rgb(var(--c-mustard) / 0.66) 0 8px, rgb(var(--c-mustard-soft) / 0.94) 8px 15px)',
  dots:
    'radial-gradient(circle, rgb(var(--c-coral) / 0.55) 1.5px, transparent 1.9px), linear-gradient(90deg, rgb(var(--c-mustard-soft) / 0.94), rgb(var(--c-sakura-soft) / 0.92))',
};

export const TAPE_TORN_CLIP =
  'polygon(0% 0%, 96.5% 0%, 100% 17%, 95.5% 34%, 100% 51%, 95.5% 68%, 100% 85%, 96.5% 100%, 3.5% 100%, 0% 85%, 4.5% 68%, 0% 51%, 4.5% 34%, 0% 17%)';

export function Tape({ tone = 'coral', className = '' }) {
  const bg = TAPE_PATTERNS[tone] || TAPE_PATTERNS.coral;
  const isDots = tone === 'dots';
  return (
    <span
      aria-hidden="true"
      data-tape-tone={tone}
      className={`pointer-events-none absolute inline-block h-4 w-20 border-y border-line/65 shadow-sm ${className}`}
      style={{
        backgroundImage: bg,
        ...(isDots ? { backgroundSize: '8px 8px, 100% 100%' } : {}),
        clipPath: TAPE_TORN_CLIP,
        WebkitClipPath: TAPE_TORN_CLIP,
      }}
    />
  );
}

/**
 * Notched ticket-ribbon SVG background for Ledger date group tabs and DayView date badges.
 * Purely decorative (`aria-hidden="true"`, `pointer-events-none`), scales seamlessly to text width.
 */
export function NotchedTabBg({ tone = 'mustard', className = '' }) {
  const styles =
    tone === 'coral'
      ? {
          fill: 'rgb(var(--c-coral-soft))',
          stroke: 'rgb(var(--c-coral-ink) / 0.45)',
          perf: 'rgb(var(--c-coral-ink) / 0.35)',
        }
      : {
          fill: 'rgb(var(--c-mustard-soft))',
          stroke: 'rgb(var(--c-mustard-ink) / 0.48)',
          perf: 'rgb(var(--c-mustard-ink) / 0.35)',
        };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 180 40"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 h-full w-full select-none ${className}`.trim()}
    >
      <path
        d="M4 2 H174 L165 20 L174 38 H4 Q10 20 4 2 Z"
        fill={styles.fill}
        stroke={styles.stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M13 6 V34"
        stroke={styles.perf}
        strokeWidth="1.1"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RoundStamp({ top, bottom, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative flex h-16 w-16 shrink-0 rotate-3 flex-col items-center justify-center rounded-full border border-dashed border-coral-ink/65 bg-coral-soft/35 px-1 text-center ${className}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 64 64"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-coral-ink"
      >
        <circle
          cx="32"
          cy="32"
          r="27.5"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="16 3 6 2"
        />
        <circle
          cx="32"
          cy="32"
          r="24.5"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="0.75"
        />
      </svg>
      <span className="relative whitespace-nowrap font-serif-display text-meta font-semibold tracking-[0.06em] leading-tight text-coral-ink">
        {top}
      </span>
      <span className="relative my-0.5 h-px w-9 bg-coral-ink/45" />
      <span className="relative whitespace-nowrap font-serif-display text-meta font-semibold tracking-[0.04em] leading-none text-coral-ink">
        {bottom}
      </span>
    </div>
  );
}

export function DayStamp({ top, bottom, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative flex h-16 w-16 shrink-0 -rotate-3 flex-col items-center justify-center rounded-full border border-coral-ink/70 bg-coral-soft/45 text-coral-ink ${className}`}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 64 64"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full text-coral-ink"
      >
        <circle
          cx="32"
          cy="32"
          r="27"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="14 3 6 2"
        />
        <path
          d="M12 22 H52 M12 43 H52"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="0.85"
          strokeLinecap="round"
        />
      </svg>
      <span className="relative whitespace-nowrap font-serif-display text-sm font-semibold tracking-[0.04em] leading-tight">{top}</span>
      <span className="relative whitespace-nowrap font-serif-display text-meta font-medium tracking-[0.04em] leading-none">{bottom}</span>
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

export function StickerGraphic({ id, size, blob, className = 'text-sm leading-none' }) {
  if (!id) return null;
  const mapped = STICKER_DOODLE_MAP[id];
  if (mapped) {
    const inferredSize =
      size ||
      (className.includes('text-lg') || className.includes('text-xl') ? 'md' : 'sm');
    const cleanClass = className
      .replace(/\btext-(?:xs|sm|base|lg|xl|2xl)\b/g, '')
      .replace(/\bleading-none\b/g, '')
      .trim();
    return (
      <Doodle
        name={mapped.name}
        size={inferredSize}
        blob={blob !== undefined ? blob : mapped.blob}
        className={`text-ink ${cleanClass}`.trim()}
      />
    );
  }
  const glyph = EMOJI_BY_ID[id] || (typeof id === 'string' ? id : '');
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
  clock: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  filter: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  ),
  alert: (c = 'h-4 w-4') => (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  ),
};

const SWIPE_DISMISS_DISTANCE_PX = 80;
const SWIPE_FLICK_MIN_PX = 40;
const SWIPE_FLICK_MIN_MS = 15;
const SWIPE_FLICK_VELOCITY_PX_PER_MS = 0.65;

export function Toast({ toast, aboveSaveBar = false, onUndo, onDismiss, onHoverChange, onFocusChange }) {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const lastToastIdRef = useRef(null);
  const swipeRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    moved: false,
    startTime: 0,
    dx: 0,
  });
  const toastId = toast?.id ?? null;

  const resetSwipeStyles = () => {
    if (toastRef.current) {
      toastRef.current.style.transform = '';
      toastRef.current.style.opacity = '';
      toastRef.current.style.transition = '';
    }
  };

  useEffect(() => {
    swipeRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      lastX: 0,
      moved: false,
      startTime: 0,
      dx: 0,
    };
    if (!toast || !toastRef.current) {
      lastToastIdRef.current = null;
      return;
    }
    resetSwipeStyles();
    runToastSlide(toastRef.current, { toast, lastIdRef: lastToastIdRef });
  }, [toast, toastId]);

  if (!toast) return null;
  const isError = toast.tone === 'error';
  const borderClass = isError ? 'border-coral-ink' : 'border-teal-strong';
  const bottomClass = aboveSaveBar
    ? 'bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))]'
    : 'bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]';
  const showDismiss = Boolean(onDismiss || toast.action || isError);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('button')) {
      return;
    }
    const clientX = typeof e.clientX === 'number' ? e.clientX : 0;
    swipeRef.current = {
      active: true,
      pointerId: e.pointerId ?? null,
      startX: clientX,
      lastX: clientX,
      moved: false,
      startTime: Date.now(),
      dx: 0,
    };
    resetSwipeStyles();
    if (typeof e.currentTarget?.setPointerCapture === 'function' && e.pointerId !== undefined) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore in environments without pointer capture
      }
    }
  };

  const handlePointerMove = (e) => {
    const state = swipeRef.current;
    if (!state.active) return;
    if (state.pointerId !== null && e.pointerId !== undefined && e.pointerId !== state.pointerId) {
      return;
    }
    const clientX = typeof e.clientX === 'number' ? e.clientX : state.lastX;
    const dx = clientX - state.startX;
    state.lastX = clientX;
    state.moved = true;
    state.dx = dx;

    if (!getPrefersReducedMotion() && toastRef.current) {
      const opacity = Math.max(0.2, 1 - Math.abs(dx) / 180);
      toastRef.current.style.transition = 'none';
      toastRef.current.style.transform = `translateX(${dx}px)`;
      toastRef.current.style.opacity = String(opacity);
    }
  };

  const handlePointerUp = (e) => {
    const state = swipeRef.current;
    if (!state.active) return;
    if (state.pointerId !== null && e.pointerId !== undefined && e.pointerId !== state.pointerId) {
      return;
    }
    state.active = false;

    const hasExplicitClientX =
      typeof e.clientX === 'number' && (!state.moved || e.clientX !== 0 || state.lastX === 0);
    const endX = hasExplicitClientX ? e.clientX : state.lastX;
    const dx = endX - state.startX;
    const absDx = Math.abs(dx);
    const elapsed = Math.max(1, Date.now() - state.startTime);
    const isFastFlick =
      absDx >= SWIPE_FLICK_MIN_PX &&
      elapsed >= SWIPE_FLICK_MIN_MS &&
      absDx / elapsed >= SWIPE_FLICK_VELOCITY_PX_PER_MS;
    const shouldDismiss = absDx > SWIPE_DISMISS_DISTANCE_PX || isFastFlick;
    const reduced = getPrefersReducedMotion();

    if (shouldDismiss) {
      if (!reduced && toastRef.current) {
        const dir = dx >= 0 ? 1 : -1;
        const startOpacity = Math.max(0.2, 1 - absDx / 180);
        toastRef.current.style.transform = `translateX(${dir * 260}px)`;
        toastRef.current.style.opacity = '0';
        runMotion(
          toastRef.current,
          [
            { transform: `translateX(${dx}px)`, opacity: startOpacity },
            { transform: `translateX(${dir * 260}px)`, opacity: 0 },
          ],
          { duration: DURATION_MS.fast, easing: EASING.out },
        );
      } else {
        resetSwipeStyles();
      }
      onDismiss?.();
    } else {
      if (!reduced && toastRef.current && absDx > 0) {
        const startOpacity = Math.max(0.2, 1 - absDx / 180);
        runMotion(
          toastRef.current,
          [
            { transform: `translateX(${dx}px)`, opacity: startOpacity },
            { transform: 'translateX(0px)', opacity: 1 },
          ],
          { duration: DURATION_MS.fast, easing: EASING.out },
        );
      }
      resetSwipeStyles();
    }
  };

  const handlePointerCancel = () => {
    if (!swipeRef.current.active) return;
    swipeRef.current.active = false;
    resetSwipeStyles();
  };

  return (
    <div
      ref={toastRef}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      tabIndex={-1}
      data-testid="toast"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') onHoverChange?.(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') onHoverChange?.(false);
      }}
      onFocusCapture={() => onFocusChange?.(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          onFocusChange?.(false);
        }
      }}
      className={`fixed inset-x-4 ${bottomClass} z-40 mx-auto flex max-w-md touch-pan-y items-center justify-between gap-2 rounded-2xl border-2 ${borderClass} bg-cream-soft px-3.5 py-1.5 text-ink shadow-xl focus:outline-none`}
    >
      {isError && Icon.alert('h-4 w-4 shrink-0 text-coral-ink')}
      <span className="min-w-0 flex-1 whitespace-normal break-words line-clamp-3 text-sm font-semibold leading-snug text-ink">
        {toast.message}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {toast.undo && (
          <button
            type="button"
            data-testid="toast-undo"
            onClick={onUndo}
            className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {t('notebook.toast.undo')}
          </button>
        )}
        {toast.action && (
          <button
            type="button"
            data-testid={toast.action.testId || 'toast-action'}
            onClick={() => {
              toast.action.onClick?.();
              onDismiss?.();
            }}
            className="inline-flex h-11 min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-3 text-meta font-bold text-white shadow-sm transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {toast.action.label}
          </button>
        )}
        {showDismiss && (
          <button
            type="button"
            data-testid="toast-dismiss"
            aria-label={t('notebook.toast.dismiss')}
            onClick={() => onDismiss?.()}
            className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-soft hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {Icon.x('h-4 w-4')}
          </button>
        )}
      </div>
    </div>
  );
}

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
