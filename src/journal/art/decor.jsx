import { useId } from 'react';

/**
 * Journal drawing set — decorative primitives (`src/journal/art/decor.jsx`).
 * All decorative SVG layers are `aria-hidden="true"` and `focusable="false"`.
 * Colours use only Tailwind token classes or `rgb(var(--c-*))` custom properties (zero raw hex).
 */

const WASH_TONE_FILL = {
  sky: 'rgb(var(--c-wash-sky) / 0.72)',
  leaf: 'rgb(var(--c-wash-leaf) / 0.62)',
  berry: 'rgb(var(--c-wash-berry) / 0.56)',
  wheat: 'rgb(var(--c-wash-wheat) / 0.66)',
};

const WASH_SHAPES = {
  1: 'M7.5 11.2 C11.4 4.8 24.8 3.6 31.6 9.4 C37.2 14.2 36.8 26.2 30.8 31.8 C24.6 37.4 11.6 36.6 6.8 30.2 C2.4 24.4 4.2 16.8 7.5 11.2 Z',
  2: 'M9.8 7.6 C17.2 3.8 29.4 5.8 33.4 12.8 C37.2 19.4 34.2 30.4 26.8 34.2 C19.2 38 8.4 34.8 5.4 27.2 C2.6 20 3.8 10.8 9.8 7.6 Z',
  3: 'M7.2 13.6 C10.8 6.2 22.4 4.2 30.4 8.4 C36.6 11.8 37.2 22.8 32 29.8 C26.8 36.4 14.8 37.2 8.2 31.6 C3.2 27.2 4.2 20.4 7.2 13.6 Z',
  a: 'M7.5 11.2 C11.4 4.8 24.8 3.6 31.6 9.4 C37.2 14.2 36.8 26.2 30.8 31.8 C24.6 37.4 11.6 36.6 6.8 30.2 C2.4 24.4 4.2 16.8 7.5 11.2 Z',
  b: 'M9.8 7.6 C17.2 3.8 29.4 5.8 33.4 12.8 C37.2 19.4 34.2 30.4 26.8 34.2 C19.2 38 8.4 34.8 5.4 27.2 C2.6 20 3.8 10.8 9.8 7.6 Z',
  c: 'M7.2 13.6 C10.8 6.2 22.4 4.2 30.4 8.4 C36.6 11.8 37.2 22.8 32 29.8 C26.8 36.4 14.8 37.2 8.2 31.6 C3.2 27.2 4.2 20.4 7.2 13.6 Z',
};

/**
 * Watercolor wash blob behind line-art or category icons.
 * @param {{ tone?: 'sky' | 'leaf' | 'berry' | 'wheat', shape?: 1 | 2 | 3 | 'a' | 'b' | 'c', className?: string, children?: any }} props
 */
export function WashBlob({
  tone = 'sky',
  shape = 1,
  className = 'h-10 w-10',
  children,
}) {
  const fill = WASH_TONE_FILL[tone] || WASH_TONE_FILL.sky;
  const d = WASH_SHAPES[shape] || WASH_SHAPES[1];

  if (children != null) {
    return (
      <span className={`relative inline-flex items-center justify-center ${className}`.trim()}>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 40 40"
          fill="none"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
        >
          <path d={d} fill={fill} />
        </svg>
        <span className="relative z-10 inline-flex items-center justify-center">{children}</span>
      </span>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 40 40"
      fill="none"
      className={`pointer-events-none inline-block shrink-0 select-none ${className}`.trim()}
    >
      <path d={d} fill={fill} />
    </svg>
  );
}

/**
 * Builds an SVG path string connecting `points` (`[{ x, y }]`).
 */
export function buildRoutePath(points = []) {
  if (!Array.isArray(points) || points.length === 0) return '';
  return points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${Number(pt.x)} ${Number(pt.y)}`)
    .join(' ');
}

/**
 * Dotted route line (`strokeDasharray="0 6"` round caps in `--c-route`) + solid route dots.
 * Caller may pass optional label elements via `children`.
 * @param {{ points?: Array<{ x: number, y: number }>, viewBox?: string, className?: string, dotRadius?: number, children?: any }} props
 */
export function RouteLine({
  points = [],
  viewBox = '0 0 240 64',
  className = 'h-16 w-full',
  dotRadius = 3.2,
  haloRadius,
  strokeWidth = 2,
  dashArray = '0 6',
  asGroup = false,
  children,
}) {
  const validPoints = Array.isArray(points)
    ? points.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number')
    : [];
  const d = validPoints.length >= 2 ? buildRoutePath(validPoints) : '';
  const outerR = typeof haloRadius === 'number' ? haloRadius : dotRadius + 2.2;

  const content = (
    <>
      {d ? (
        <path
          d={d}
          fill="none"
          stroke="rgb(var(--c-route))"
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="jr-route-path"
        />
      ) : null}
      {validPoints.map((pt, idx) => (
        <g key={`${pt.x}-${pt.y}-${idx}`} data-route-dot={String(idx)} className="jr-route-dot">
          <circle
            cx={pt.x}
            cy={pt.y}
            r={outerR}
            fill="rgb(var(--c-route-soft))"
          />
          <circle
            cx={pt.x}
            cy={pt.y}
            r={dotRadius}
            fill="rgb(var(--c-route))"
          />
        </g>
      ))}
      {children}
    </>
  );

  if (asGroup) {
    return <g className="jr-route-group">{content}</g>;
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      fill="none"
      className={`pointer-events-none block select-none ${className}`.trim()}
    >
      {content}
    </svg>
  );
}

/**
 * Horizontal ruled sea hatching SVG `<pattern>` in `--c-rule` with unique `useId()`.
 */
export function HatchSea({
  viewBox = '0 0 240 80',
  pitch = 4,
  className = 'h-20 w-full',
  children,
}) {
  const rawId = useId();
  const patternId = `jr-hatch-sea-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const vbParts = String(viewBox).trim().split(/[\s,]+/).map(Number);
  const vbX = Number.isFinite(vbParts[0]) ? vbParts[0] : 0;
  const vbY = Number.isFinite(vbParts[1]) ? vbParts[1] : 0;
  const vbW = Number.isFinite(vbParts[2]) && vbParts[2] > 0 ? vbParts[2] : 240;
  const vbH = Number.isFinite(vbParts[3]) && vbParts[3] > 0 ? vbParts[3] : 80;
  const seaX = vbX - vbW;
  const seaY = vbY - vbH;
  const seaW = vbW * 3;
  const seaH = vbH * 3;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      fill="none"
      className={`pointer-events-none block select-none ${className}`.trim()}
    >
      <defs>
        <pattern
          id={patternId}
          width="20"
          height={pitch}
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1={pitch / 2}
            x2="20"
            y2={pitch / 2}
            stroke="rgb(var(--c-rule))"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
      </defs>
      <rect x={seaX} y={seaY} width={seaW} height={seaH} fill="rgb(var(--c-wash-sky) / 0.38)" />
      <rect x={seaX} y={seaY} width={seaW} height={seaH} fill={`url(#${patternId})`} />
      {children}
    </svg>
  );
}

/**
 * Kraft washi tape label strip with zigzag ends.
 * Text child remains readable (`text-kraft-ink`, ≥12px) and is NOT `aria-hidden`.
 */
export function WashiLabel({
  tilt = -2,
  className = '',
  children,
}) {
  const tiltValue = typeof tilt === 'number' ? `${tilt}deg` : String(tilt);
  const posClass = /\b(?:absolute|fixed|sticky|relative)\b/.test(className) ? '' : 'relative ';
  return (
    <span
      data-jr-decor="washi"
      style={{ '--jr-tilt': tiltValue }}
      className={`jr-washi ${posClass}inline-flex items-center gap-1.5 px-3 py-0.5 font-hand text-xs font-bold tracking-widest text-kraft-ink ${className}`.trim()}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 120 24"
        preserveAspectRatio="none"
        fill="none"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        <path
          d="M2 2 H118 M2 22 H118"
          stroke="rgb(var(--c-kraft-ink) / 0.18)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>
      <span className="relative z-10">{children}</span>
    </span>
  );
}

/**
 * Translucent navy masking tape strip, purely decorative (`aria-hidden="true"`).
 */
export function NavyTape({
  tilt = -2,
  className = 'h-4 w-16',
}) {
  const tiltValue = typeof tilt === 'number' ? `${tilt}deg` : String(tilt);
  const posClass = /\b(?:absolute|fixed|sticky|relative)\b/.test(className) ? '' : 'relative ';
  return (
    <span
      aria-hidden="true"
      data-jr-decor="tape"
      style={{ '--jr-tilt': tiltValue }}
      className={`jr-tape-navy pointer-events-none ${posClass}inline-block select-none ${className}`.trim()}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 64 16"
        preserveAspectRatio="none"
        fill="none"
        className="pointer-events-none block h-full w-full"
      >
        <line
          x1="4"
          y1="8"
          x2="60"
          y2="8"
          stroke="rgb(var(--c-paper) / 0.35)"
          strokeWidth="1"
          strokeDasharray="2 4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/**
 * Hand-drawn stamp-red ring sized to circle a calendar date number (`--c-stamp`).
 */
export function TodayRing({
  className = 'h-7 w-7',
  children,
}) {
  const ringSvg = (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 28 28"
      fill="none"
      className={
        children != null
          ? 'pointer-events-none absolute inset-0 h-full w-full select-none'
          : `pointer-events-none inline-block shrink-0 select-none ${className}`.trim()
      }
    >
      <path
        d="M4 14 C3.5 5.5, 23.5 3.5, 24.5 13.5 C25.5 22.5, 7.5 25.5, 4 16 C2.5 11.5, 8 4.8, 17 5.5"
        fill="none"
        stroke="rgb(var(--c-stamp))"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );

  if (children != null) {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`.trim()}>
        {ringSvg}
        <span className="relative z-10 text-xs font-bold leading-none text-stamp">{children}</span>
      </span>
    );
  }

  return ringSvg;
}

/**
 * Decorative zigzag torn bottom edge (`aria-hidden="true"`).
 */
export function TornEdge({ className = 'h-2 w-full' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 6"
      preserveAspectRatio="none"
      fill="none"
      className={`pointer-events-none block select-none ${className}`.trim()}
    >
      <path
        d="M0 0 L6 6 L12 0 L18 6 L24 0 L30 6 L36 0 L42 6 L48 0 L54 6 L60 0 L66 6 L72 0 L78 6 L84 0 L90 6 L96 0 L102 6 L108 0 L114 6 L120 0 L126 6 L132 0 L138 6 L144 0 L150 6 L156 0 L162 6 L168 0 L174 6 L180 0 L186 6 L192 0 L198 6 L204 0 L210 6 L216 0 L222 6 L228 0 L234 6 L240 0 Z"
        fill="rgb(var(--c-paper-shade))"
        stroke="rgb(var(--c-ink-soft) / 0.4)"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
