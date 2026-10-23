import { palette } from '../../theme/tokens';

/** Visual parts for the ?proto=ref build. Colours only from tokens (no hex). */

export const paperDots = {
  backgroundColor: palette.cream,
  backgroundImage: `radial-gradient(${palette.line} 1px, transparent 1.2px)`,
  backgroundSize: '14px 14px',
};
export const cardDots = {
  backgroundColor: palette['cream-soft'],
  backgroundImage: `radial-gradient(${palette.beige} 1px, transparent 1.2px)`,
  backgroundSize: '16px 16px',
};
const stripes = (angle, a, b, w = 9) => `repeating-linear-gradient(${angle}deg, ${a} 0 ${w}px, ${b} ${w}px ${w * 2}px)`;
/** Airmail border (sage / coral diagonal), used on the summary card. */
export const airmail = {
  backgroundImage: `repeating-linear-gradient(135deg, ${palette.sage} 0 9px, ${palette['cream-soft']} 9px 16px, ${palette.coral} 16px 25px, ${palette['cream-soft']} 25px 32px)`,
};
export const mustardStripe = { backgroundImage: stripes(135, palette['mustard-soft'], palette.mustard, 7) };
export const washiNav = {
  backgroundImage: `repeating-linear-gradient(90deg, ${palette.mustard} 0 18px, ${palette['cream-soft']} 18px 22px, ${palette.sage} 22px 40px, ${palette['cream-soft']} 40px 44px, ${palette.coral} 44px 62px, ${palette['cream-soft']} 62px 66px, ${palette.sakura} 66px 84px, ${palette['cream-soft']} 84px 88px)`,
};

export function Tape({ tone = 'coral', className = '' }) {
  const a = palette[`${tone}-soft`] || palette['teal-soft'];
  const b = palette[tone] || palette.coral;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute h-5 w-24 opacity-85 ${className}`}
      style={{ backgroundImage: stripes(135, a, b, 6), clipPath: 'polygon(3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%, 0 50%)' }}
    />
  );
}

export function RoundStamp({ top, bottom, tone = 'coral', className = '' }) {
  const c = palette[`${tone}-ink`] || palette['coral-ink'];
  return (
    <div className={`relative flex h-[86px] w-[86px] shrink-0 -rotate-6 items-center justify-center rounded-full ${className}`} aria-hidden="true">
      <svg viewBox="0 0 86 86" className="absolute inset-0">
        <circle cx="43" cy="43" r="40" fill={palette['cream-soft']} stroke={c} strokeWidth="2.2" strokeDasharray="5 3" />
        <circle cx="43" cy="43" r="34" fill="none" stroke={c} strokeWidth="1.2" />
      </svg>
      <div className="relative text-center font-script leading-none" style={{ color: c }}>
        <div className="whitespace-nowrap text-[20px] font-bold">{top}</div>
        <div className="mt-1 whitespace-nowrap text-[16px] font-bold">{bottom}</div>
      </div>
    </div>
  );
}

export function HandRing({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 56 56" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} fill="none">
      <path
        d="M27 4 C42 3 52 12 52 27 C52 43 40 53 26 52 C11 51 3 40 4 26 C5 12 16 5 31 6"
        stroke={palette.mustard}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M24 6 C39 5 49 14 50 28 C50 41 39 50 25 50"
        stroke={palette.mustard}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeOpacity="0.65"
      />
    </svg>
  );
}

export function ZigZag() {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 8" preserveAspectRatio="none" className="block h-2 w-full">
      <path d="M0 0 L240 0 L240 2 L232 8 L224 2 L216 8 L208 2 L200 8 L192 2 L184 8 L176 2 L168 8 L160 2 L152 8 L144 2 L136 8 L128 2 L120 8 L112 2 L104 8 L96 2 L88 8 L80 2 L72 8 L64 2 L56 8 L48 2 L40 8 L32 2 L24 8 L16 2 L8 8 L0 2 Z" fill={palette['cream-soft']} stroke={palette.line} strokeWidth="1" />
    </svg>
  );
}

export function Sakura({ className = 'h-6 w-6' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <g fill={palette.sakura}>
        {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="8" cy="3.6" rx="2.2" ry="3.2" transform={`rotate(${r} 8 8)`} />)}
      </g>
      <circle cx="8" cy="8" r="1.4" fill={palette.mustard} />
    </svg>
  );
}

export function Sparkle({ className = 'h-4 w-4' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <path d="M8 0 C8.6 5 11 7.4 16 8 C11 8.6 8.6 11 8 16 C7.4 11 5 8.6 0 8 C5 7.4 7.4 5 8 0 Z" fill={palette.mustard} />
    </svg>
  );
}

/** Illustrated doodle stickers for calendar cells & itinerary picker (zero hex literals, palette-only). */
export function StickerGraphic({ id, className = 'h-5 w-5' }) {
  switch (id) {
    case 'plane':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <path d="M21 15l-8-4.5V4.5a1.5 1.5 0 0 0-3 0v6L2 15v2l8-2.5V19l-2.5 1.5V22l4-1 4 1v-1.5L13 19v-4.5L21 17v-2z" fill={palette.teal} stroke={palette['teal-strong']} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case 'torii':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <path d="M3 6c6 1.5 12 1.5 18 0" stroke={palette['coral-ink']} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 10.5h14" stroke={palette.coral} strokeWidth="2" strokeLinecap="round" />
          <path d="M7.5 6.5V20M16.5 6.5V20" stroke={palette['coral-ink']} strokeWidth="2.2" strokeLinecap="round" />
          <rect x="10.8" y="6.5" width="2.4" height="4" fill={palette['coral-ink']} />
        </svg>
      );
    case 'tower':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <path d="M12 3v3M9 21l2-15h2l2 15M6 21h12" stroke={palette['coral-ink']} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.5 14h7M9.5 10h5" stroke={palette['cream-soft']} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8.5 14h7M9.5 10h5" stroke={palette.coral} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'ramen':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <path d="M4 12h16c0 5-3.5 8-8 8s-8-3-8-8z" fill={palette['coral-soft']} stroke={palette['coral-ink']} strokeWidth="1.6" />
          <path d="M6 6l12 2M7 9l11-1" stroke={palette['mustard-ink']} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M9 12v-3M12 12V8.5M15 12v-3" stroke={palette.mustard} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'shopping':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <path d="M5 8h10l1 12H4L5 8z" fill={palette['sakura-soft']} stroke={palette['sakura-ink']} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M7.5 8V6a2.5 2.5 0 0 1 5 0v2" stroke={palette['sakura-ink']} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M13 10h6l.8 10H12.5" fill={palette['mustard-soft']} stroke={palette['mustard-ink']} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'train':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <rect x="5" y="4" width="14" height="14" rx="3" fill={palette['teal-soft']} stroke={palette['teal-strong']} strokeWidth="1.6" />
          <rect x="7.5" y="6.5" width="9" height="4.5" rx="1" fill={palette['cream-soft']} stroke={palette['teal-strong']} strokeWidth="1.2" />
          <circle cx="9" cy="14.5" r="1.2" fill={palette.coral} />
          <circle cx="15" cy="14.5" r="1.2" fill={palette.coral} />
          <path d="M7 21l2-3M17 21l-2-3" stroke={palette['teal-strong']} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'fuji':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="16.5" cy="7.5" r="3" fill={palette.coral} fillOpacity="0.85" />
          <path d="M3 19C6.5 14.5 8.5 9.5 10 6h4c1.5 3.5 3.5 8.5 7 13H3z" fill={palette.teal} stroke={palette['teal-strong']} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M10 6h4l1.4 3.5-1.6-.7-1.1 1.2-.9-1.2-1.1 1.2-1.9-.7L10 6z" fill={palette['cream-soft']} stroke={palette['teal-strong']} strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'wheel':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="12" cy="11" r="7" stroke={palette['teal-strong']} strokeWidth="1.6" />
          <circle cx="12" cy="11" r="1.8" fill={palette.coral} />
          <path d="M12 4v14M5 11h14M7 6l10 10M17 6L7 16" stroke={palette.sage} strokeWidth="1.2" />
          <path d="M8 21l4-8 4 8" stroke={palette['coral-ink']} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'onsen':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          <ellipse cx="12" cy="16.5" rx="7.5" ry="3.8" fill={palette['coral-soft']} stroke={palette['coral-ink']} strokeWidth="1.6" />
          <path d="M8.5 13c-.8-1.5.8-2.5 0-4.2M12 13.5c-.8-1.8.8-3 0-4.8M15.5 13c-.8-1.5.8-2.5 0-4.2" stroke={palette['coral-ink']} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
export const Icon = {
  pin: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>,
  globe: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></svg>,
  chevDown: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M6 9l6 6 6-6" /></svg>,
  chevL: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M15 6l-6 6 6 6" /></svg>,
  chevR: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M9 6l6 6-6 6" /></svg>,
  back: (c = 'h-5 w-5') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  camera: (c = 'h-5 w-5') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  plus: (c = 'h-5 w-5') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M12 5v14M5 12h14" /></svg>,
  home: (c = 'h-6 w-6') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></svg>,
  book: (c = 'h-6 w-6') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" /></svg>,
  chart: (c = 'h-6 w-6') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M6 20V11M12 20V5M18 20v-6" /></svg>,
  gear: (c = 'h-6 w-6') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  dots: (c = 'h-5 w-5') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  pencil: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
  trash: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>,
  search: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>,
  x: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  calendar: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
};

/** Category dot colours via static class map (dynamic class names are not generated by Tailwind). */
export const CATEGORY_DOT = {
  飲食: 'bg-coral', 交通: 'bg-teal', 購物: 'bg-sakura', 住宿: 'bg-mustard', 娛樂: 'bg-sage', 其他: 'bg-ink-muted',
};
