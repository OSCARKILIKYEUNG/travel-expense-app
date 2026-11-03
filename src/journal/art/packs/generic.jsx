import { CompassIcon, PlaneIcon, SuitcaseIcon } from '../core.jsx';
import { RouteLine, WashBlob } from '../decor.jsx';

/**
 * Generic fallback destination art pack (`src/journal/art/packs/generic.jsx`).
 * Per Oscar's decision: non-Japan trips show ROUTE DOTS ONLY on a faint grid
 * (no coastline, no invented country shape), plus suitcase/plane/compass vignettes.
 */

const ZIGZAG_Y = [56, 36, 58, 34, 52];

function normalizeGenericStops(cities = [], labels) {
  const raw = Array.isArray(cities) ? cities.filter(Boolean) : [];
  let items = raw.slice(0, 5);
  if (items.length === 0) {
    items = ['Stop 1', 'Stop 2', 'Stop 3'];
  } else if (items.length === 1) {
    items = [items[0], 'Stop 2'];
  }

  const count = items.length;
  const padX = 36;
  const usableWidth = 240 - padX * 2;

  return items.map((item, idx) => {
    const customLabel = Array.isArray(labels) && labels[idx] ? String(labels[idx]) : null;
    const rawLabel =
      typeof item === 'string'
        ? item
        : item?.label || item?.name || item?.nameZh || item?.nameEn || `Stop ${idx + 1}`;
    const x = Math.round((padX + (idx * usableWidth) / Math.max(1, count - 1)) * 10) / 10;
    const y = ZIGZAG_Y[idx % ZIGZAG_Y.length];
    return {
      id: (typeof item === 'object' && item?.id) || `stop-${idx + 1}`,
      x,
      y,
      label: customLabel || String(rawLabel),
    };
  });
}

export function SuitcaseVignette({ className = 'h-10 w-10' }) {
  return (
    <WashBlob tone="wheat" shape={1} className={className}>
      <SuitcaseIcon className="h-6 w-6 text-ink" />
    </WashBlob>
  );
}

export function PlaneVignette({ className = 'h-10 w-10' }) {
  return (
    <WashBlob tone="sky" shape={2} className={className}>
      <PlaneIcon className="h-6 w-6 text-ink" />
    </WashBlob>
  );
}

export function CompassVignette({ className = 'h-10 w-10' }) {
  return (
    <WashBlob tone="leaf" shape={3} className={className}>
      <CompassIcon className="h-6 w-6 text-ink" />
    </WashBlob>
  );
}

export const vignettes = {
  suitcase: SuitcaseVignette,
  plane: PlaneVignette,
  compass: CompassVignette,
};

/**
 * Route-dots-only map on a faint grid (2–5 stops, deterministic gentle zigzag, no coastline).
 */
export function GenericMap({
  cities = [],
  stops,
  labels,
  includeSrList = true,
  className = '',
}) {
  const inputList = Array.isArray(cities) && cities.length > 0 ? cities : stops;
  const resolvedStops = normalizeGenericStops(inputList, labels);
  const showLabels = labels !== false;

  return (
    <div
      data-testid="destination-map-generic"
      className={`jr-grid relative overflow-hidden rounded-sm border border-ink-soft/45 bg-paper ${className}`.trim()}
    >
      {includeSrList && resolvedStops.length > 0 ? (
        <ul className="sr-only">
          {resolvedStops.map((stop, idx) => (
            <li key={`${stop.id}-${idx}`}>{stop.label}</li>
          ))}
        </ul>
      ) : null}
      <RouteLine
        points={resolvedStops}
        viewBox="0 0 240 96"
        dotRadius={3.4}
        className="block h-auto w-full"
      >
        {showLabels
          ? resolvedStops.map((stop, idx) => {
              const labelY = idx % 2 === 0 ? stop.y + 18 : stop.y - 11;
              return (
                <text
                  key={`label-${stop.id}-${idx}`}
                  x={stop.x}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="12"
                  className="fill-current font-hand font-bold text-route"
                >
                  {stop.label}
                </text>
              );
            })
          : null}
      </RouteLine>
    </div>
  );
}

const GenericPack = {
  code: null,
  hasCoastline: false,
  Map: GenericMap,
  vignettes,
};

export default GenericPack;
