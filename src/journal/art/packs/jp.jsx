import {
  JAPAN_CITIES,
  JAPAN_ISLAND_LON_LAT,
  JAPAN_MAP_VIEWBOX,
  projectJapanLonLat,
} from '../../../proto/ref/journalAtlas.js';
import { HatchSea, RouteLine } from '../decor.jsx';

/**
 * Japan destination art pack (`src/journal/art/packs/jp.jsx`).
 * Lazy-loaded chunk for JP trips:
 * - Hand-drawn coastline projected from `JAPAN_ISLAND_LON_LAT` via `projectJapanLonLat`
 * - `HatchSea` horizontal ruled sea pattern
 * - `RouteLine` connecting projected city stops
 * - Generic fine-liner landmark vignettes (zero logos/characters/brands, zero raw hex)
 */

function islandRingToPath(ring) {
  return `${ring
    .map(([lon, lat], idx) => {
      const { x, y } = projectJapanLonLat(lon, lat, JAPAN_MAP_VIEWBOX);
      return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ')} Z`;
}

const ISLAND_PATHS = Object.fromEntries(
  Object.entries(JAPAN_ISLAND_LON_LAT).map(([island, ring]) => [
    island,
    islandRingToPath(ring),
  ]),
);

const DEFAULT_JP_CITIES = [
  JAPAN_CITIES[0], // Tokyo
  JAPAN_CITIES[1], // Fuji
  JAPAN_CITIES[4], // Osaka
].filter(Boolean);

function resolveJpStops(cities, labels) {
  const rawList = Array.isArray(cities) && cities.length > 0 ? cities : DEFAULT_JP_CITIES;
  return rawList.map((item, idx) => {
    const customLabel = Array.isArray(labels) && labels[idx] ? String(labels[idx]) : null;
    if (typeof item === 'string') {
      const q = item.trim().toLowerCase();
      const matched =
        JAPAN_CITIES.find(
          (c) =>
            c.id === q ||
            c.nameZh === item.trim() ||
            c.nameEn.toLowerCase() === q ||
            (Array.isArray(c.keywords) && c.keywords.some((kw) => kw === q)),
        ) || DEFAULT_JP_CITIES[idx % DEFAULT_JP_CITIES.length];
      const pt = projectJapanLonLat(matched.lon, matched.lat, JAPAN_MAP_VIEWBOX);
      return {
        id: matched.id || `stop-${idx}`,
        x: pt.x,
        y: pt.y,
        label: customLabel || item.trim() || matched.nameZh,
      };
    }
    if (item && typeof item === 'object') {
      let coords = null;
      if (typeof item.lon === 'number' && typeof item.lat === 'number') {
        coords = projectJapanLonLat(item.lon, item.lat, JAPAN_MAP_VIEWBOX);
      } else if (typeof item.x === 'number' && typeof item.y === 'number') {
        coords = { x: item.x, y: item.y };
      } else {
        const key = String(item.id || item.name || item.nameZh || '').trim().toLowerCase();
        const matched =
          JAPAN_CITIES.find(
            (c) => c.id === key || c.nameZh === key || c.nameEn.toLowerCase() === key,
          ) || DEFAULT_JP_CITIES[idx % DEFAULT_JP_CITIES.length];
        coords = projectJapanLonLat(matched.lon, matched.lat, JAPAN_MAP_VIEWBOX);
      }
      return {
        id: item.id || `stop-${idx}`,
        x: coords.x,
        y: coords.y,
        label:
          customLabel ||
          item.label ||
          item.name ||
          item.nameZh ||
          item.nameEn ||
          `Stop ${idx + 1}`,
      };
    }
    const fallback = DEFAULT_JP_CITIES[idx % DEFAULT_JP_CITIES.length];
    const pt = projectJapanLonLat(fallback.lon, fallback.lat, JAPAN_MAP_VIEWBOX);
    return {
      id: fallback.id,
      x: pt.x,
      y: pt.y,
      label: customLabel || fallback.nameZh,
    };
  });
}

function VignetteSvg({ className = 'h-10 w-14', children }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 48 36"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`pointer-events-none inline-block shrink-0 select-none text-ink ${className}`.trim()}
    >
      {children}
    </svg>
  );
}

export function FujiVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="23" rx="18" ry="8" fill="rgb(var(--c-wash-sky) / 0.68)" stroke="none" />
      <circle cx="33" cy="11" r="4.5" fill="rgb(var(--c-wash-berry) / 0.58)" stroke="none" />
      <path
        d="M5 30 Q16 23 20 9 H28 Q32 23 43 30 Z"
        fill="rgb(var(--c-paper))"
      />
      <path d="M17.5 17 L21 19.5 L24 16.5 L27 19.5 L30.5 17" />
    </VignetteSvg>
  );
}

export function CastleVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="22" rx="17" ry="9" fill="rgb(var(--c-wash-leaf) / 0.55)" stroke="none" />
      <path d="M9 30 L13 22 H35 L39 30 Z" fill="rgb(var(--c-paper))" />
      <path d="M7 22 Q24 18 41 22" />
      <rect x="15" y="15" width="18" height="7" fill="rgb(var(--c-paper))" />
      <path d="M11 15 Q24 10 37 15" />
      <path d="M17 15 L24 6 L31 15 Z" fill="rgb(var(--c-paper))" />
      <path d="M24 3.5 V6" />
    </VignetteSvg>
  );
}

export function PagodaVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="21" rx="15" ry="9" fill="rgb(var(--c-wash-wheat) / 0.58)" stroke="none" />
      <path d="M24 4 V8" />
      <path d="M14 10 Q24 7.5 34 10" />
      <rect x="18" y="10" width="12" height="5" fill="rgb(var(--c-paper))" />
      <path d="M12 17 Q24 14.5 36 17" />
      <rect x="16.5" y="17" width="15" height="5" fill="rgb(var(--c-paper))" />
      <path d="M10 24 Q24 21.5 38 24" />
      <rect x="15" y="24" width="18" height="6" fill="rgb(var(--c-paper))" />
    </VignetteSvg>
  );
}

export function GateVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="20" rx="16" ry="9" fill="rgb(var(--c-wash-berry) / 0.45)" stroke="none" />
      <path d="M8 9.5 Q24 6.5 40 9.5" strokeWidth={1.6} />
      <path d="M11 14 H37" />
      <path d="M24 9 V14" />
      <path d="M15 9.8 L14 30 M33 9.8 L34 30" strokeWidth={1.5} />
    </VignetteSvg>
  );
}

export function LanternVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="19" rx="13" ry="10" fill="rgb(var(--c-wash-wheat) / 0.62)" stroke="none" />
      <path d="M24 3.5 V7" />
      <rect x="19.5" y="7" width="9" height="2.4" rx="0.6" fill="rgb(var(--c-ink-soft))" />
      <ellipse cx="24" cy="18" rx="9" ry="8.5" fill="rgb(var(--c-paper))" />
      <path d="M15.5 15.5 Q24 14 32.5 15.5 M15.5 20.5 Q24 22 32.5 20.5" />
      <rect x="20" y="26.5" width="8" height="2.2" rx="0.6" fill="rgb(var(--c-ink-soft))" />
      <path d="M24 28.7 V32.5" />
    </VignetteSvg>
  );
}

export function LatticeTowerVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="22" rx="14" ry="9" fill="rgb(var(--c-wash-berry) / 0.42)" stroke="none" />
      <path d="M24 3.5 V8" />
      <path d="M15 31 C19.5 21 21.5 13 24 8 C26.5 13 28.5 21 33 31" />
      <rect x="19.5" y="16" width="9" height="3" fill="rgb(var(--c-paper))" />
      <rect x="16.5" y="24" width="15" height="3.2" fill="rgb(var(--c-paper))" />
      <path d="M20.5 19 L27.5 24 M27.5 19 L20.5 24 M12 31 H36" />
    </VignetteSvg>
  );
}

export function DangoVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <path d="M10 30 L38 8" />
      <circle cx="31" cy="13.5" r="5" fill="rgb(var(--c-wash-berry) / 0.68)" />
      <circle cx="24" cy="19" r="5" fill="rgb(var(--c-wash-wheat) / 0.68)" />
      <circle cx="17" cy="24.5" r="5" fill="rgb(var(--c-wash-leaf) / 0.68)" />
    </VignetteSvg>
  );
}

export function PersimmonVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="22" rx="13" ry="9.5" fill="rgb(var(--c-wash-berry) / 0.62)" stroke="none" />
      <ellipse cx="27" cy="12.5" rx="7.5" ry="4" fill="rgb(var(--c-wash-leaf) / 0.68)" stroke="none" />
      <path d="M13 21.5 C13 15 35 15 35 21.5 C35 28.5 29 30.5 24 30.5 C19 30.5 13 28.5 13 21.5 Z" />
      <path d="M18 14 Q24 10.5 30 14 Q26 16.8 24 15 Q22 16.8 18 14 Z" />
      <path d="M24 13 C24 10.5 26 9 28 9" />
    </VignetteSvg>
  );
}

export function SmallTrainVignette({ className }) {
  return (
    <VignetteSvg className={className}>
      <ellipse cx="24" cy="19" rx="18" ry="8" fill="rgb(var(--c-wash-sky) / 0.7)" stroke="none" />
      <path d="M20 9 L24 6 L28 9" />
      <rect x="7" y="9" width="34" height="14" rx="2.5" fill="rgb(var(--c-paper))" />
      <rect x="11" y="11.8" width="6.5" height="4.5" rx="0.8" fill="rgb(var(--c-wash-sky) / 0.8)" />
      <rect x="20.8" y="11.8" width="6.5" height="4.5" rx="0.8" fill="rgb(var(--c-wash-sky) / 0.8)" />
      <rect x="30.5" y="11.8" width="6.5" height="4.5" rx="0.8" fill="rgb(var(--c-wash-sky) / 0.8)" />
      <path d="M7.5 19.5 H40.5" stroke="rgb(var(--c-stamp))" />
      <circle cx="14" cy="25" r="1.8" fill="rgb(var(--c-ink-soft))" />
      <circle cx="24" cy="25" r="1.8" fill="rgb(var(--c-ink-soft))" />
      <circle cx="34" cy="25" r="1.8" fill="rgb(var(--c-ink-soft))" />
      <path d="M4 28 H44" strokeDasharray="2 3" />
    </VignetteSvg>
  );
}

export const vignettes = {
  fuji: FujiVignette,
  castle: CastleVignette,
  pagoda: PagodaVignette,
  gate: GateVignette,
  lantern: LanternVignette,
  latticeTower: LatticeTowerVignette,
  dango: DangoVignette,
  persimmon: PersimmonVignette,
  smallTrain: SmallTrainVignette,
};

Object.defineProperties(vignettes, {
  Fuji: { value: FujiVignette, enumerable: false },
  torii: { value: GateVignette, enumerable: false },
  tower: { value: LatticeTowerVignette, enumerable: false },
  'lattice-tower': { value: LatticeTowerVignette, enumerable: false },
  train: { value: SmallTrainVignette, enumerable: false },
  'small-train': { value: SmallTrainVignette, enumerable: false },
});

/**
 * Hand-drawn Japan coastline + ruled-hatch sea + dotted route map.
 */
export function JapanMap({
  cities = [],
  labels,
  includeSrList = true,
  className = '',
}) {
  const stops = resolveJpStops(cities, labels);
  const viewBox = `0 0 ${JAPAN_MAP_VIEWBOX.width} ${JAPAN_MAP_VIEWBOX.height}`;
  const showLabels = labels !== false;
  const groupedLabel = stops
    .slice(0, 3)
    .map((s) => s.label)
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      data-testid="destination-map-jp"
      className={`relative overflow-hidden rounded-sm border border-ink-soft/45 bg-paper ${className}`.trim()}
    >
      {includeSrList && stops.length > 0 ? (
        <ul className="sr-only">
          {stops.map((stop, idx) => (
            <li key={`${stop.id}-${idx}`}>{stop.label}</li>
          ))}
        </ul>
      ) : null}
      <HatchSea viewBox={viewBox} className="block h-auto w-full">
        {/* Soft coastal water-lining halo */}
        {Object.entries(ISLAND_PATHS).map(([island, d]) => (
          <path
            key={`halo-${island}`}
            d={d}
            fill="none"
            stroke="rgb(var(--c-route-soft))"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        ))}
        {/* Hand-drawn island coastlines projected from JAPAN_ISLAND_LON_LAT */}
        {Object.entries(ISLAND_PATHS).map(([island, d]) => (
          <path
            key={island}
            id={`jr-coastline-${island}`}
            data-map-island={island}
            className="jr-coastline"
            d={d}
            fill="rgb(var(--c-paper))"
            stroke="rgb(var(--c-ink))"
            strokeWidth="1.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* Dotted route line + solid city dots */}
        <RouteLine
          points={stops}
          viewBox={viewBox}
          dotRadius={2.2}
          className="h-full w-full"
        >
          {showLabels && groupedLabel ? (
            <text
              x="144"
              y="98"
              textAnchor="end"
              fontSize="12"
              className="fill-current font-hand font-bold text-route"
            >
              {groupedLabel}
            </text>
          ) : null}
        </RouteLine>
      </HatchSea>
    </div>
  );
}

const JapanPack = {
  code: 'JP',
  hasCoastline: true,
  Map: JapanMap,
  vignettes,
};

export default JapanPack;
