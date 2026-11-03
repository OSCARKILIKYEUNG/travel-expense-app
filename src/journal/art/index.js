import { createElement, lazy, Suspense } from 'react';
import { resolveTripDestination } from '../../proto/ref/journalAtlas.js';

export {
  BagIcon,
  BedIcon,
  BookIcon,
  BowlIcon,
  CalendarIcon,
  CameraIcon,
  CATEGORY_ICON,
  CATEGORY_ICON_NAME,
  ChartIcon,
  CheckboxCheckedIcon,
  CheckboxIcon,
  CloudIcon,
  CompassIcon,
  CORE_ICONS,
  DotIcon,
  FilterIcon,
  GearIcon,
  JournalIcon,
  PencilIcon,
  PinIcon,
  PlaneIcon,
  PushpinIcon,
  RainIcon,
  RepayIcon,
  SearchIcon,
  StarIcon,
  SuitcaseIcon,
  SunIcon,
  TicketIcon,
  TrainIcon,
  TriangleDownIcon,
} from './core.jsx';

export {
  buildRoutePath,
  HatchSea,
  NavyTape,
  RouteLine,
  TodayRing,
  TornEdge,
  WashBlob,
  WashiLabel,
} from './decor.jsx';

const LazyJpMap = lazy(() =>
  import('./packs/jp.jsx').then((m) => ({ default: (m.default || m).Map })),
);

const LazyGenericMap = lazy(() =>
  import('./packs/generic.jsx').then((m) => ({ default: (m.default || m).Map })),
);

/**
 * Dynamically imports the destination art pack for `code` ('JP' -> jp pack, anything else -> generic pack).
 * @param {string | null | undefined} code
 */
export async function loadDestinationPack(code) {
  const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (normalized === 'JP') {
    const mod = await import('./packs/jp.jsx');
    return mod.default || mod;
  }
  const mod = await import('./packs/generic.jsx');
  return mod.default || mod;
}

/**
 * Resolves the destination pack key (`'jp'` | `'generic'`) for a trip via `resolveTripDestination(trip)`.
 * @param {Record<string, any> | null | undefined} trip
 * @returns {'jp' | 'generic'}
 */
export function packKeyForTrip(trip) {
  const dest = resolveTripDestination(trip);
  return dest?.code === 'JP' ? 'jp' : 'generic';
}

function extractTripStopLabels(trip, explicitCities) {
  if (Array.isArray(explicitCities) && explicitCities.length > 0) {
    return explicitCities
      .map((item) =>
        typeof item === 'string'
          ? item.trim()
          : item?.label || item?.name || item?.nameZh || item?.nameEn || '',
      )
      .filter(Boolean);
  }
  if (!trip || typeof trip !== 'object') return [];
  const seen = new Set();
  const stops = [];
  const addStop = (val) => {
    const s = typeof val === 'string' ? val.trim() : '';
    if (s && !seen.has(s) && stops.length < 5) {
      seen.add(s);
      stops.push(s);
    }
  };
  if (trip.days && typeof trip.days === 'object') {
    for (const day of Object.values(trip.days)) {
      if (day?.note) addStop(day.note);
    }
  }
  if (Array.isArray(trip.expenses)) {
    for (const exp of trip.expenses) {
      if (exp?.place) addStop(exp.place);
      else if (exp?.location) addStop(exp.location);
    }
  }
  return stops;
}

/**
 * Hook-free helper for A5: resolves pack key, destination metadata, cities array, and accessible stop names for a trip.
 */
export function resolveDestinationArt(trip, explicitCities) {
  const dest = resolveTripDestination(trip);
  const packKey = dest?.code === 'JP' ? 'jp' : 'generic';
  const resolvedCities =
    Array.isArray(explicitCities) && explicitCities.length > 0
      ? explicitCities
      : packKey === 'jp'
        ? dest.cities
        : extractTripStopLabels(trip, explicitCities);
  const stopNames = (resolvedCities || [])
    .map((c) =>
      typeof c === 'string' ? c : c?.label || c?.name || c?.nameZh || c?.nameEn || '',
    )
    .filter(Boolean);

  return {
    packKey,
    code: dest?.code || null,
    hasCoastline: packKey === 'jp',
    destination: dest,
    cities: resolvedCities,
    stopNames,
  };
}

/**
 * Lazy-loaded destination map that selects the Japan coastline pack or the generic route-dots-only pack.
 * Renders an empty same-size placeholder during Suspense and a visually-hidden `sr-only` list of city names.
 */
export function DestinationMap({
  trip,
  cities,
  labels,
  className = '',
}) {
  const info = resolveDestinationArt(trip, cities);
  const MapComp = info.packKey === 'jp' ? LazyJpMap : LazyGenericMap;
  const srItems =
    Array.isArray(labels) && labels.length > 0 ? labels.filter(Boolean) : info.stopNames;

  return createElement(
    'div',
    {
      'data-testid': 'destination-map',
      'data-pack': info.packKey,
      className: `relative ${className}`.trim(),
    },
    srItems.length > 0
      ? createElement(
          'ul',
          { className: 'sr-only' },
          srItems.map((name, idx) =>
            createElement('li', { key: `${name}-${idx}` }, String(name)),
          ),
        )
      : null,
    createElement(
      Suspense,
      {
        fallback: createElement('div', {
          'aria-hidden': 'true',
          className: 'min-h-[96px] w-full rounded-sm border border-ink-soft/30 bg-paper',
        }),
      },
      createElement(MapComp, {
        cities: info.cities,
        labels,
        includeSrList: false,
      }),
    ),
  );
}
