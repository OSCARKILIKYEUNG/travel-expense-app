/**
 * Hand-drawn flat-illustration inline SVG doodles & diary decorations for Travel Notebook.
 * Inspired by reference/diary-style/oscar-ref-welcome-to-japan.jpg:
 * - Thin charcoal/ink stroke via `currentColor` / `rgb(var(--c-*))` (zero hex literals).
 * - Optional offset pastel blob backing ("sticker" effect).
 * - Every SVG is `aria-hidden="true"` and `focusable="false"` and `pointer-events-none`.
 */

const SIZE_CLASSES = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
  xl: 'h-14 w-14',
};

const BLOB_FILL = {
  coral: 'rgb(var(--c-coral-soft))',
  teal: 'rgb(var(--c-teal-soft))',
  mustard: 'rgb(var(--c-mustard-soft))',
  sakura: 'rgb(var(--c-sakura-soft))',
  sage: 'rgb(var(--c-sage-soft))',
  sand: 'rgb(var(--c-sand-soft))',
  beige: 'rgb(var(--c-beige))',
  ribbon: 'rgb(var(--c-ribbon) / 0.45)',
};

const BLOB_PATHS = {
  a: 'M5.5 7.2 C7.8 3.2 15.6 2.4 19.4 5.8 C22.5 8.6 22.2 15.8 18.8 19.2 C15.2 22.6 7.4 22.1 4.4 18.4 C1.8 15.2 3.1 11.2 5.5 7.2 Z',
  b: 'M6.2 4.8 C10.8 2.4 18.2 3.6 20.6 7.9 C22.8 11.9 20.9 18.4 16.4 20.8 C11.8 23.1 5.2 21.2 3.4 16.6 C1.8 12.2 2.4 6.8 6.2 4.8 Z',
  c: 'M4.8 8.4 C6.9 3.8 13.8 2.5 18.6 5.1 C22.4 7.2 22.8 13.9 19.6 18.1 C16.5 22.1 9.2 22.6 5.2 19.2 C2.1 16.5 2.8 12.6 4.8 8.4 Z',
};

function PastelBlob({ blob, variant = 'a' }) {
  if (!blob) return null;
  const fill = BLOB_FILL[blob] || BLOB_FILL.sand;
  const d = BLOB_PATHS[variant] || BLOB_PATHS.a;
  return <path d={d} fill={fill} />;
}

const INK = 'rgb(var(--c-ink))';
const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function resolveSizeClass(size = 'md', className = '') {
  const hasExplicitDim = /\b(?:h|w)-(?:\d+|\[[^\]]+\]|full|auto)\b/.test(className);
  const preset = hasExplicitDim ? '' : SIZE_CLASSES[size] || SIZE_CLASSES.md;
  return `pointer-events-none select-none shrink-0 ${preset} ${className}`.trim();
}

export function CameraDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="a" />
      {/* Offset sage/sand sticker fill inside camera body */}
      <rect x="4.8" y="8.2" width="15.2" height="10.5" rx="2.5" fill="rgb(var(--c-sage-soft))" />
      {/* Flash spark rays */}
      <path d="M18 3.2 L19.2 1.8 M20.5 4.8 L22.1 4.2 M15.8 3.5 L15.2 2" {...STROKE} stroke="rgb(var(--c-mustard-ink))" strokeWidth={1.5} />
      {/* Camera body & rangefinder top */}
      <path d="M3.8 8.2 H7.2 L8.7 5.8 H14.8 L16.2 8.2 H19.8 C20.8 8.2 21.5 9 21.5 10 V17.5 C21.5 18.5 20.8 19.2 19.8 19.2 H4.2 C3.2 19.2 2.5 18.5 2.5 17.5 V10 C2.5 9 3.2 8.2 3.8 8.2 Z" {...STROKE} />
      {/* Shutter button */}
      <path d="M5.5 8.2 V6.6 H7.4 V8.2" {...STROKE} />
      {/* Lens outer & inner */}
      <circle cx="12.2" cy="13.6" r="3.8" fill="rgb(var(--c-cream-soft))" {...STROKE} />
      <circle cx="12.2" cy="13.6" r="1.7" fill="rgb(var(--c-coral-soft))" {...STROKE} strokeWidth={1.4} />
      {/* Viewfinder window */}
      <circle cx="17.8" cy="10.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function SushiDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="b" />
      {/* Wooden geta tray */}
      <path d="M2.5 16.8 H21.5 M5.2 16.8 V19.5 M18.8 16.8 V19.5" {...STROKE} />
      {/* Rice base */}
      <rect x="4.5" y="11.5" width="7" height="5" rx="2" fill="rgb(var(--c-cream-soft))" {...STROKE} />
      <rect x="12.5" y="11.5" width="7" height="5" rx="2" fill="rgb(var(--c-cream-soft))" {...STROKE} />
      {/* Salmon / Tuna toppings */}
      <path d="M4 11.8 C4.5 8.6 11.2 8.6 12 11.8 Z" fill="rgb(var(--c-coral))" {...STROKE} />
      <path d="M12 11.8 C12.5 8.6 19.2 8.6 20 11.8 Z" fill="rgb(var(--c-mustard))" {...STROKE} />
      {/* Nori band */}
      <path d="M7.3 9.4 V16.4 M15.3 9.4 V16.4" {...STROKE} strokeWidth={2} />
      {/* Tiny sparkle */}
      <path d="M12 4.2 V6.6 M10.8 5.4 H13.2" {...STROKE} stroke="rgb(var(--c-coral-ink))" strokeWidth={1.4} />
    </svg>
  );
}

export function ToriiDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="c" />
      {/* Vermilion offset sticker fill */}
      <path d="M3.5 6.8 Q12 4.8 20.5 6.8 L19.5 9.2 Q12 7.6 4.5 9.2 Z" fill="rgb(var(--c-coral))" />
      <rect x="6.5" y="8.8" width="2.2" height="11.5" fill="rgb(var(--c-coral) / 0.85)" />
      <rect x="15.3" y="8.8" width="2.2" height="11.5" fill="rgb(var(--c-coral) / 0.85)" />
      {/* Kasagi curved top lintel */}
      <path d="M2.8 6.4 Q12 4.2 21.2 6.4" {...STROKE} strokeWidth={2.1} />
      <path d="M4.2 8.6 Q12 7.1 19.8 8.6" {...STROKE} />
      {/* Nuki tie beam & tablet */}
      <path d="M4.8 12.2 H19.2" {...STROKE} strokeWidth={1.9} />
      <rect x="10.8" y="8.4" width="2.4" height="3.6" fill="rgb(var(--c-mustard))" {...STROKE} strokeWidth={1.3} />
      {/* Pillars & base */}
      <path d="M7.4 8.4 V20.2 M16.6 8.4 V20.2 M5.6 20.2 H9.2 M14.8 20.2 H18.4" {...STROKE} strokeWidth={1.9} />
    </svg>
  );
}

export function FujiDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="a" />
      {/* Rising red sun */}
      <circle cx="15.8" cy="8.2" r="4.2" fill="rgb(var(--c-coral) / 0.85)" />
      {/* Mountain slope fill */}
      <path
        d="M2.8 19.5 C6.2 15.2 8.2 10.6 9.5 7.2 H14.5 C15.8 10.6 17.8 15.2 21.2 19.5 Z"
        fill="rgb(var(--c-teal))"
        {...STROKE}
      />
      {/* Snowy peak cap */}
      <path
        d="M9.5 7.2 H14.5 L16 11.4 L14 10.4 L12.8 12 L11.4 10.2 L10.1 11.8 L8 11.2 Z"
        fill="rgb(var(--c-cream-soft))"
        {...STROKE}
        strokeWidth={1.5}
      />
      {/* Cloud puff */}
      <path d="M2.5 14.2 H6.8" {...STROKE} strokeWidth={1.4} />
    </svg>
  );
}

export function PagodaDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="b" />
      {/* Sakura pink sticker backing */}
      <path d="M7.5 8.5 H16.5 L18 19.5 H6 Z" fill="rgb(var(--c-sakura) / 0.85)" />
      {/* Spire */}
      <path d="M12 2.5 V6.2" {...STROKE} />
      {/* 3 tiered curved roofs */}
      <path d="M6.8 6.8 Q12 5.2 17.2 6.8" {...STROKE} strokeWidth={1.9} />
      <path d="M5.6 11.2 Q12 9.5 18.4 11.2" {...STROKE} strokeWidth={1.9} />
      <path d="M4.2 15.8 Q12 14 19.8 15.8" {...STROKE} strokeWidth={1.9} />
      {/* Tower core & base */}
      <path d="M8.5 6.8 V19.8 M15.5 6.8 V19.8 M4.5 19.8 H19.5" {...STROKE} />
      <path d="M10.8 19.8 V17.2 H13.2 V19.8" fill="rgb(var(--c-mustard-soft))" {...STROKE} strokeWidth={1.4} />
    </svg>
  );
}

export function SakuraDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="c" />
      <g fill="rgb(var(--c-sakura))" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path
            key={deg}
            d="M12 11.2 C9.8 8.5 9.2 4.6 10.9 3.1 C11.5 2.7 12 3.8 12 3.8 C12 3.8 12.5 2.7 13.1 3.1 C14.8 4.6 14.2 8.5 12 11.2 Z"
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
      </g>
      <circle cx="12" cy="12" r="2" fill="rgb(var(--c-mustard))" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function PlaneDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="a" />
      {/* Dashed flight trail */}
      <path
        d="M3 19.5 Q7.2 19.2 9.8 15.5"
        {...STROKE}
        stroke="rgb(var(--c-teal-strong))"
        strokeWidth={1.5}
        strokeDasharray="2 2.2"
      />
      {/* Paper / twin-wing airplane with offset fill */}
      <path
        d="M20.8 4.2 L4.5 10.6 L10.2 13.2 L13.2 18.8 L15.5 13.8 L20.8 4.2 Z"
        fill="rgb(var(--c-cream-soft))"
        {...STROKE}
      />
      <path d="M20.8 4.2 L10.2 13.2 L13.2 18.8" fill="rgb(var(--c-mustard) / 0.7)" {...STROKE} strokeWidth={1.5} />
    </svg>
  );
}

export function SuitcaseDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="b" />
      {/* Handle */}
      <path d="M9.2 7.5 V5.2 C9.2 4.4 9.8 3.8 10.6 3.8 H13.4 C14.2 3.8 14.8 4.4 14.8 5.2 V7.5" {...STROKE} />
      {/* Suitcase body */}
      <rect x="4.5" y="7.5" width="15" height="12" rx="2.4" fill="rgb(var(--c-mustard) / 0.65)" {...STROKE} />
      {/* Straps */}
      <path d="M8.2 7.5 V19.5 M15.8 7.5 V19.5" {...STROKE} strokeWidth={1.4} />
      {/* Cute travel sticker tag on suitcase */}
      <rect
        x="10"
        y="11"
        width="4.2"
        height="3.2"
        rx="0.8"
        transform="rotate(-8 12 12.5)"
        fill="rgb(var(--c-coral))"
        {...STROKE}
        strokeWidth={1.3}
      />
      {/* Wheels */}
      <circle cx="7.5" cy="20.6" r="1" fill="currentColor" />
      <circle cx="16.5" cy="20.6" r="1" fill="currentColor" />
    </svg>
  );
}

export function LanternDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="c" />
      {/* Hanging cord */}
      <path d="M12 2.2 V4.8" {...STROKE} />
      {/* Chochin body */}
      <ellipse cx="12" cy="12" rx="6.2" ry="6.8" fill="rgb(var(--c-coral) / 0.82)" {...STROKE} />
      {/* Horizontal ribs */}
      <path d="M6.2 9.8 Q12 8.6 17.8 9.8 M6.2 14.2 Q12 15.4 17.8 14.2" {...STROKE} strokeWidth={1.35} />
      {/* Top & bottom caps */}
      <rect x="9.2" y="4.6" width="5.6" height="1.8" rx="0.6" fill="rgb(var(--c-mustard))" {...STROKE} strokeWidth={1.4} />
      <rect x="9.2" y="17.8" width="5.6" height="1.8" rx="0.6" fill="rgb(var(--c-mustard))" {...STROKE} strokeWidth={1.4} />
      {/* Tassel */}
      <path d="M12 19.6 V21.8" {...STROKE} stroke="rgb(var(--c-mustard-ink))" />
    </svg>
  );
}

export function RamenDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="a" />
      {/* Chopsticks & lifted noodles */}
      <path d="M6.2 4.5 L19.2 6.8 M7.2 7.2 L19.2 4.5" {...STROKE} strokeWidth={1.55} />
      <path d="M9.8 6.5 V11.2 M12.2 6.2 V11.2" {...STROKE} stroke="rgb(var(--c-mustard-ink))" strokeWidth={1.4} />
      {/* Bowl */}
      <path
        d="M3.5 11.5 H20.5 C20.5 16.6 16.8 19.5 12 19.5 C7.2 19.5 3.5 16.6 3.5 11.5 Z"
        fill="rgb(var(--c-coral) / 0.78)"
        {...STROKE}
      />
      {/* Bowl foot */}
      <path d="M8.8 19.5 H15.2" {...STROKE} strokeWidth={1.9} />
      {/* Narutomaki swirl */}
      <circle cx="15" cy="11.2" r="2.1" fill="rgb(var(--c-cream-soft))" {...STROKE} strokeWidth={1.3} />
      <path d="M14.5 11.2 A0.8 0.8 0 1 1 15.5 11.8" {...STROKE} stroke="rgb(var(--c-coral-ink))" strokeWidth={1.2} />
    </svg>
  );
}

export function TrainDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="b" />
      {/* Overhead pantograph */}
      <path d="M9.5 4.2 L12 2.6 L14.5 4.2" {...STROKE} strokeWidth={1.4} />
      {/* Train car body */}
      <rect x="5.2" y="4.2" width="13.6" height="14.2" rx="3" fill="rgb(var(--c-teal) / 0.75)" {...STROKE} />
      {/* Cream stripe & windshield */}
      <rect x="7.2" y="6.5" width="9.6" height="5.2" rx="1.2" fill="rgb(var(--c-cream-soft))" {...STROKE} strokeWidth={1.4} />
      <path d="M5.4 13.8 H18.6" {...STROKE} stroke="rgb(var(--c-mustard))" strokeWidth={2.2} />
      {/* Headlights */}
      <circle cx="8.6" cy="16" r="1.1" fill="rgb(var(--c-mustard))" />
      <circle cx="15.4" cy="16" r="1.1" fill="rgb(var(--c-mustard))" />
      {/* Rails */}
      <path d="M6.8 21.2 L8.8 18.4 M17.2 21.2 L15.2 18.4 M5.5 20.2 H18.5" {...STROKE} strokeWidth={1.5} />
    </svg>
  );
}

export function ShoppingBagDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="c" />
      {/* Back tilted bag */}
      <path
        d="M11.5 8.5 H20 L20.8 19.2 H10.8 Z"
        fill="rgb(var(--c-mustard) / 0.75)"
        {...STROKE}
        strokeWidth={1.5}
      />
      {/* Front primary bag */}
      <path
        d="M4.2 8.2 H15.8 L16.8 20.2 H3.2 L4.2 8.2 Z"
        fill="rgb(var(--c-sakura) / 0.85)"
        {...STROKE}
      />
      {/* Rope handles */}
      <path d="M7.4 8.2 V5.8 C7.4 4.2 8.6 3.2 10 3.2 C11.4 3.2 12.6 4.2 12.6 5.8 V8.2" {...STROKE} />
      {/* Cute heart / dot emblem */}
      <circle cx="10" cy="14.2" r="1.8" fill="rgb(var(--c-cream-soft))" {...STROKE} strokeWidth={1.3} />
    </svg>
  );
}

export function SparkleDoodle({ size = 'sm', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      {blob && <circle cx="8" cy="8" r="6.5" fill={BLOB_FILL[blob] || BLOB_FILL.mustard} />}
      <path
        d="M8 0.8 L9.3 6.7 L15.2 8 L9.3 9.3 L8 15.2 L6.7 9.3 L0.8 8 L6.7 6.7 Z"
        fill="rgb(var(--c-mustard))"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunburstDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 36 16"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      {blob && <ellipse cx="18" cy="11" rx="14" ry="5" fill={BLOB_FILL[blob] || BLOB_FILL.mustard} />}
      <path
        d="M18 12 V2.5 M11.5 13 L6.5 5.2 M24.5 13 L29.5 5.2 M6.5 14.5 L2 10.2 M29.5 14.5 L34 10.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WheelDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="a" />
      <circle cx="12" cy="10.5" r="7.2" fill="rgb(var(--c-sakura-soft))" {...STROKE} />
      <path d="M12 3.3 V17.7 M4.8 10.5 H19.2 M6.9 5.4 L17.1 15.6 M17.1 5.4 L6.9 15.6" {...STROKE} strokeWidth={1.2} />
      <circle cx="12" cy="10.5" r="1.8" fill="rgb(var(--c-mustard))" {...STROKE} strokeWidth={1.3} />
      <path d="M7.5 21 L12 10.5 L16.5 21 M5.5 21 H18.5" {...STROKE} strokeWidth={1.6} />
    </svg>
  );
}

export function OnsenDoodle({ size = 'md', blob = null, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      className={resolveSizeClass(size, className)}
    >
      <PastelBlob blob={blob} variant="b" />
      <ellipse cx="12" cy="15.8" rx="8.2" ry="4.5" fill="rgb(var(--c-coral-soft))" {...STROKE} />
      <path
        d="M8.2 14.2 C7.2 12 9.2 10.2 8.2 7.8 M12 14.8 C11 12.2 13.2 10 12 7.2 M15.8 14.2 C14.8 12 16.8 10.2 15.8 7.8"
        {...STROKE}
        stroke="rgb(var(--c-coral-ink))"
        strokeWidth={1.7}
      />
    </svg>
  );
}

/** Canonical doodle registry (all 14 required keys + wheel/onsen for trip stickers). */
export const DOODLES = {
  camera: CameraDoodle,
  sushi: SushiDoodle,
  torii: ToriiDoodle,
  fuji: FujiDoodle,
  pagoda: PagodaDoodle,
  sakura: SakuraDoodle,
  plane: PlaneDoodle,
  suitcase: SuitcaseDoodle,
  lantern: LanternDoodle,
  ramen: RamenDoodle,
  train: TrainDoodle,
  shoppingBag: ShoppingBagDoodle,
  sparkle: SparkleDoodle,
  sunburst: SunburstDoodle,
  wheel: WheelDoodle,
  onsen: OnsenDoodle,
};

export const camera = CameraDoodle;
export const sushi = SushiDoodle;
export const torii = ToriiDoodle;
export const fuji = FujiDoodle;
export const pagoda = PagodaDoodle;
export const sakura = SakuraDoodle;
export const plane = PlaneDoodle;
export const suitcase = SuitcaseDoodle;
export const lantern = LanternDoodle;
export const ramen = RamenDoodle;
export const train = TrainDoodle;
export const shoppingBag = ShoppingBagDoodle;
export const sparkle = SparkleDoodle;
export const sunburst = SunburstDoodle;

export function Doodle({ name, size = 'md', blob = null, className = '' }) {
  const Comp = DOODLES[name] || DOODLES.sparkle;
  return <Comp size={size} blob={blob} className={className} />;
}

/**
 * Maps stored sticker IDs AND raw emoji characters (user data) to their hand-drawn SVG doodle
 * so stored stickers render the exact same meaning without raw OS emojis.
 */
export const STICKER_DOODLE_MAP = {
  plane: { name: 'plane', blob: 'teal' },
  '✈️': { name: 'plane', blob: 'teal' },
  torii: { name: 'torii', blob: 'coral' },
  '⛩️': { name: 'torii', blob: 'coral' },
  tower: { name: 'pagoda', blob: 'sakura' },
  pagoda: { name: 'pagoda', blob: 'sakura' },
  '🗼': { name: 'pagoda', blob: 'sakura' },
  ramen: { name: 'ramen', blob: 'coral' },
  '🍜': { name: 'ramen', blob: 'coral' },
  shopping: { name: 'shoppingBag', blob: 'sakura' },
  shoppingBag: { name: 'shoppingBag', blob: 'sakura' },
  '🛍️': { name: 'shoppingBag', blob: 'sakura' },
  train: { name: 'train', blob: 'teal' },
  '🚃': { name: 'train', blob: 'teal' },
  fuji: { name: 'fuji', blob: 'teal' },
  '🗻': { name: 'fuji', blob: 'teal' },
  wheel: { name: 'wheel', blob: 'sakura' },
  '🎡': { name: 'wheel', blob: 'sakura' },
  onsen: { name: 'onsen', blob: 'coral' },
  '♨️': { name: 'onsen', blob: 'coral' },
};

/**
 * Category -> Doodle + pastel blob + ink tone mapping for the 6 preset categories.
 * Unknown/custom categories fall back to the existing plain colour dot.
 */
export const CATEGORY_STICKER_CONFIG = {
  飲食: { name: 'ramen', blob: 'coral', textClass: 'text-coral-ink' },
  交通: { name: 'train', blob: 'teal', textClass: 'text-teal-strong' },
  購物: { name: 'shoppingBag', blob: 'sakura', textClass: 'text-sakura-ink' },
  住宿: { name: 'suitcase', blob: 'mustard', textClass: 'text-mustard-ink' },
  娛樂: { name: 'lantern', blob: 'sage', textClass: 'text-sage-ink' },
  其他: { name: 'camera', blob: 'sand', textClass: 'text-ink-soft' },
};

export function CategorySticker({
  category,
  size = 'sm',
  className = '',
  dotClassName = 'h-2 w-2 bg-ink-muted',
}) {
  const cfg = CATEGORY_STICKER_CONFIG[category];
  if (!cfg) {
    return (
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 rounded-full ${dotClassName} ${className}`.trim()}
      />
    );
  }
  return (
    <Doodle
      name={cfg.name}
      size={size}
      blob={cfg.blob}
      className={`${cfg.textClass} ${className}`.trim()}
    />
  );
}

/**
 * Composite sticker illustration for empty states & hero callouts (e.g. primary + secondary doodle on a soft blob).
 */
export function DoodleSticker({
  name = 'plane',
  secondary = null,
  blob = 'teal',
  size = 'xl',
  className = '',
}) {
  const bgMap = {
    coral: 'bg-coral-soft/85 border-coral/35 text-ink',
    teal: 'bg-teal-soft/85 border-teal/35 text-ink',
    mustard: 'bg-mustard-soft/90 border-mustard/45 text-ink',
    sakura: 'bg-sakura-soft/90 border-sakura/55 text-ink',
    sage: 'bg-sage-soft/90 border-sage/55 text-ink',
    sand: 'bg-sand-soft/90 border-line text-ink',
  };
  const pillTone = bgMap[blob] || bgMap.teal;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative mx-auto inline-flex items-center justify-center rounded-full border border-dashed px-4 py-2.5 shadow-sm ${pillTone} ${className}`.trim()}
    >
      <Doodle name={name} size={size} blob={blob} />
      {secondary && (
        <span className="-ml-1.5 mt-3 rotate-6 rounded-full bg-cream-soft/90 p-1 shadow-sm">
          <Doodle name={secondary} size="md" />
        </span>
      )}
    </div>
  );
}

/** Radiating thin hand-drawn sunburst lines above the hero ribbon banner. */
export function SunburstRays({ className = 'h-4 w-24 text-ink' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 96 18"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
    >
      <path
        d="M48 15 V2 M32 15.5 L24 4.5 M64 15.5 L72 4.5 M17 16.5 L7 9 M79 16.5 L89 9"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Yellow notched (fishtail/swallowtail) ribbon banner inspired by "welcome to Japan" in reference poster.
 */
export function RibbonBanner({ children, className = '' }) {
  return (
    <div className={`relative inline-flex max-w-full items-center px-3.5 py-1 ${className}`.trim()}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 240 32"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
      >
        <path
          d="M2 3 H238 L231 16 L238 29 H2 L9 16 Z"
          fill="rgb(var(--c-ribbon) / 0.85)"
          stroke="rgb(var(--c-ink) / 0.78)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="relative z-10 min-w-0 truncate">{children}</span>
    </div>
  );
}

/**
 * Pastel triangle bunting / pennant garland draped under headers.
 */
export function Bunting({ className = 'h-3.5 w-full' }) {
  const pennants = [
    { x: 14, fill: 'rgb(var(--c-coral) / 0.75)' },
    { x: 40, fill: 'rgb(var(--c-mustard) / 0.85)' },
    { x: 66, fill: 'rgb(var(--c-teal) / 0.7)' },
    { x: 92, fill: 'rgb(var(--c-sakura) / 0.85)' },
    { x: 118, fill: 'rgb(var(--c-sage) / 0.85)' },
    { x: 144, fill: 'rgb(var(--c-mustard) / 0.85)' },
    { x: 170, fill: 'rgb(var(--c-coral) / 0.75)' },
    { x: 196, fill: 'rgb(var(--c-teal) / 0.7)' },
  ];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 224 16"
      preserveAspectRatio="none"
      fill="none"
      className={`pointer-events-none select-none ${className}`}
    >
      <path
        d="M2 2 Q112 7 222 2"
        stroke="rgb(var(--c-ink-soft) / 0.65)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {pennants.map((p, idx) => {
        const yTop = idx === 3 || idx === 4 ? 4.4 : idx === 2 || idx === 5 ? 4 : 3.2;
        return (
          <path
            key={p.x}
            d={`M${p.x} ${yTop} L${p.x + 14} ${yTop} L${p.x + 7} ${yTop + 10.2} Z`}
            fill={p.fill}
            stroke="rgb(var(--c-ink) / 0.65)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

