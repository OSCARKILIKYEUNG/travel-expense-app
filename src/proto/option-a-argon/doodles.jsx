import { palette } from '../../theme/tokens';

/**
 * Hand-drawn flat-illustration SVG doodles & stamps for Option A ("Tabi Techo · 旅の手帖").
 * All colours strictly reference `palette` from `src/theme/tokens.js` (zero hex literals).
 * All SVG text uses fontSize >= 12.
 */

export function WashiTape({ tone = 'mustard', className = '', rotate = '-rotate-2' }) {
  const fill = palette[tone] || palette.mustard;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 24"
      className={`pointer-events-none select-none ${rotate} ${className}`}
    >
      <path
        d="M3 2 L117 2 L114 7 L118 12 L113 17 L117 22 L3 22 L7 17 L2 12 L6 7 Z"
        fill={fill}
        fillOpacity="0.72"
        stroke={palette.line}
        strokeWidth="0.8"
      />
      <line x1="14" y1="6" x2="18" y2="18" stroke={palette['cream-soft']} strokeWidth="1" strokeOpacity="0.6" />
      <line x1="42" y1="5" x2="46" y2="19" stroke={palette['cream-soft']} strokeWidth="1" strokeOpacity="0.6" />
      <line x1="78" y1="5" x2="82" y2="19" stroke={palette['cream-soft']} strokeWidth="1" strokeOpacity="0.6" />
      <line x1="102" y1="6" x2="106" y2="18" stroke={palette['cream-soft']} strokeWidth="1" strokeOpacity="0.6" />
    </svg>
  );
}

export function FujiHeroDoodle({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 76"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
    >
      {/* Rising sun */}
      <circle cx="118" cy="34" r="20" fill={palette.coral} fillOpacity="0.85" />
      {/* Sunburst rays */}
      <path
        d="M118 8 V3 M138 15 L142 11 M144 34 H150 M98 15 L94 11"
        stroke={palette.mustard}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Clouds */}
      <path
        d="M14 44 C14 39 20 37 25 39 C28 34 37 34 40 39 C45 39 48 43 46 47 H16 C14 47 14 45 14 44 Z"
        fill={palette['cream-soft']}
        stroke={palette.line}
        strokeWidth="1.2"
      />
      {/* Mt. Fuji body */}
      <path
        d="M34 72 C56 54 68 32 76 16 H98 C106 32 118 54 140 72 Z"
        fill={palette['teal-strong']}
        stroke={palette.ink}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Snow cap */}
      <path
        d="M76 16 H98 L106 31 L97 28 L92 34 L87 27 L81 33 L77 28 L68 31 Z"
        fill={palette['cream-soft']}
        stroke={palette.ink}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Torii silhouette on right */}
      <g transform="translate(136, 42)">
        <path d="M2 6 C10 4 22 4 30 6" stroke={palette['coral-ink']} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M5 12 H27" stroke={palette['coral-ink']} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 6 V28 M23 6 V28" stroke={palette['coral-ink']} strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* Sakura blossom */}
      <g transform="translate(18, 12)" fill={palette.sakura}>
        <ellipse cx="8" cy="3.5" rx="2" ry="3" />
        <ellipse cx="8" cy="3.5" rx="2" ry="3" transform="rotate(72 8 8)" />
        <ellipse cx="8" cy="3.5" rx="2" ry="3" transform="rotate(144 8 8)" />
        <ellipse cx="8" cy="3.5" rx="2" ry="3" transform="rotate(216 8 8)" />
        <ellipse cx="8" cy="3.5" rx="2" ry="3" transform="rotate(288 8 8)" />
        <circle cx="8" cy="8" r="1.5" fill={palette.mustard} />
      </g>
    </svg>
  );
}

export function PostalStamp({ topText = 'TOKYO', mainText = 'DAY 5', subText = '10.23', tone = 'coral-ink', className = '' }) {
  const stroke = palette[tone] || palette['coral-ink'];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 76 76"
      className={`pointer-events-none select-none ${className}`}
      fill="none"
    >
      <circle cx="38" cy="38" r="34" stroke={stroke} strokeWidth="2" strokeDasharray="6 2" />
      <circle cx="38" cy="38" r="29" stroke={stroke} strokeWidth="1.2" />
      <line x1="11" y1="27" x2="65" y2="27" stroke={stroke} strokeWidth="1.2" />
      <line x1="11" y1="49" x2="65" y2="49" stroke={stroke} strokeWidth="1.2" />
      <text
        x="38"
        y="22"
        textAnchor="middle"
        fill={stroke}
        fontSize="12"
        fontWeight="700"
        letterSpacing="0.5"
      >
        {topText}
      </text>
      <text
        x="38"
        y="43"
        textAnchor="middle"
        fill={stroke}
        fontSize="14"
        fontWeight="800"
      >
        {mainText}
      </text>
      <text
        x="38"
        y="62"
        textAnchor="middle"
        fill={stroke}
        fontSize="12"
        fontWeight="600"
      >
        {subText}
      </text>
    </svg>
  );
}

export function CategoryIcon({ category, className = 'w-5 h-5' }) {
  switch (category) {
    case '飲食':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Ramen / rice bowl */}
          <path d="M4 11 H20 C20 16 16.5 19 12 19 C7.5 19 4 16 4 11 Z" fill={palette['coral-soft']} stroke={palette['coral-ink']} strokeWidth="1.7" />
          <path d="M9 20 H15" stroke={palette['coral-ink']} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M7 5 L19 8 M8 8 L19 5" stroke={palette.ink} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case '交通':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Train / Enoden */}
          <rect x="5" y="4" width="14" height="14" rx="3" fill={palette['teal-soft']} stroke={palette['teal-strong']} strokeWidth="1.7" />
          <rect x="7.5" y="7" width="9" height="5" rx="1" fill={palette['cream-soft']} stroke={palette['teal-strong']} strokeWidth="1.3" />
          <circle cx="9" cy="15" r="1.2" fill={palette['coral-ink']} />
          <circle cx="15" cy="15" r="1.2" fill={palette['coral-ink']} />
          <path d="M7 21 L9 18 M17 21 L15 18" stroke={palette['teal-strong']} strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      );
    case '購物':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Shopping bag */}
          <path d="M6 8 H18 L19 20 H5 L6 8 Z" fill={palette['sakura-soft']} stroke={palette['sakura-ink']} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M9 8 V6 C9 4.3 10.3 3 12 3 C13.7 3 15 4.3 15 6 V8" stroke={palette['sakura-ink']} strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="14" r="2" fill={palette.mustard} />
        </svg>
      );
    case '住宿':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Ryokan / Onsen roof */}
          <path d="M3 11 L12 4 L21 11" stroke={palette['mustard-ink']} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="6" y="11" width="12" height="9" rx="1.5" fill={palette['mustard-soft']} stroke={palette['mustard-ink']} strokeWidth="1.6" />
          <path d="M10 20 V15 H14 V20" stroke={palette['mustard-ink']} strokeWidth="1.5" />
        </svg>
      );
    case '娛樂':
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Torii / Ticket */}
          <path d="M4 7 C9 5.5 15 5.5 20 7" stroke={palette['coral-ink']} strokeWidth="2" strokeLinecap="round" />
          <path d="M6 11 H18" stroke={palette['coral-ink']} strokeWidth="1.7" strokeLinecap="round" />
          <path d="M8 7 V20 M16 7 V20" stroke={palette['coral-ink']} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
          {/* Sparkle / Note */}
          <rect x="5" y="4" width="14" height="16" rx="2.5" fill={palette.beige} stroke={palette['ink-soft']} strokeWidth="1.6" />
          <path d="M8.5 9 H15.5 M8.5 13 H13.5" stroke={palette['ink-soft']} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}

export function KindBadgeIcon({ kind, className = 'w-4 h-4' }) {
  const map = {
    food: '飲食',
    transport: '交通',
    shop: '購物',
    stay: '住宿',
    sight: '娛樂',
  };
  return <CategoryIcon category={map[kind] || '其他'} className={className} />;
}

export function ReceiptZigZagEdge({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 8"
      preserveAspectRatio="none"
      className={`pointer-events-none block w-full h-2 ${className}`}
    >
      <path
        d="M0 0 L8 7 L16 0 L24 7 L32 0 L40 7 L48 0 L56 7 L64 0 L72 7 L80 0 L88 7 L96 0 L104 7 L112 0 L120 7 L128 0 L136 7 L144 0 L152 7 L160 0 L168 7 L176 0 L184 7 L192 0 L200 7 L208 0 L216 7 L224 0 L232 7 L240 0"
        fill="none"
        stroke={palette.line}
        strokeWidth="1.2"
      />
    </svg>
  );
}
