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
  backgroundImage: `repeating-linear-gradient(90deg, ${palette.mustard} 0 16px, ${palette['cream-soft']} 16px 20px, ${palette.sage} 20px 28px, ${palette['cream-soft']} 28px 32px, ${palette.coral} 32px 38px, ${palette['cream-soft']} 38px 42px, ${palette.sakura} 42px 48px, ${palette['cream-soft']} 48px 52px)`,
};

export function Tape({ tone = 'coral', className = '' }) {
  const a = palette[`${tone}-soft`] || palette['teal-soft'];
  const b = palette[tone] || palette.coral;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute h-5 w-24 opacity-80 ${className}`}
      style={{ backgroundImage: stripes(135, a, b, 6), clipPath: 'polygon(3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%, 0 50%)' }}
    />
  );
}

export function RoundStamp({ top, bottom, tone = 'coral', className = '' }) {
  const c = palette[`${tone}-ink`] || palette['coral-ink'];
  return (
    <div className={`relative flex h-[84px] w-[84px] shrink-0 -rotate-6 items-center justify-center rounded-full ${className}`} aria-hidden="true">
      <svg viewBox="0 0 84 84" className="absolute inset-0">
        <circle cx="42" cy="42" r="39" fill={palette['cream-soft']} stroke={c} strokeWidth="2" strokeDasharray="5 3" />
        <circle cx="42" cy="42" r="33" fill="none" stroke={c} strokeWidth="1.2" />
      </svg>
      <div className="relative text-center font-script leading-none" style={{ color: c }}>
        <div className="whitespace-nowrap text-[20px]">{top}</div>
        <div className="mt-1 whitespace-nowrap text-[16px]">{bottom}</div>
      </div>
    </div>
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
  gear: (c = 'h-6 w-6') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M4.2 6l2.1 2.1M17.7 15.9l2.1 2.1M2.5 12h3M18.5 12h3M4.2 18l2.1-2.1M17.7 8.1L19.8 6" /></svg>,
  dots: (c = 'h-5 w-5') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  pencil: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
  trash: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>,
  search: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>,
  x: (c = 'h-4 w-4') => <svg aria-hidden="true" viewBox="0 0 24 24" className={c} {...S}><path d="M6 6l12 12M18 6L6 18" /></svg>,
};

/** Category dot colours via static class map (dynamic class names are not generated by Tailwind). */
export const CATEGORY_DOT = {
  飲食: 'bg-coral', 交通: 'bg-teal', 購物: 'bg-sakura', 住宿: 'bg-mustard', 娛樂: 'bg-sage', 其他: 'bg-ink-muted',
};
