import { createElement, useState } from 'react';

/**
 * Editorial travel-journal destination atlas (`journalAtlas.js`).
 * Resolves a trip object to destination metadata (country code, i18n keys, local name,
 * and simplified public-domain mini-map city pins) with a guaranteed non-null
 * typographic fallback for unknown destinations.
 *
 * Coastline data source & licence:
 * Hand-simplified lon/lat outlines of Hokkaido, Honshu, Shikoku, and Kyushu derived from
 * Natural Earth 1:50m / 1:10m physical vectors (https://www.naturalearthdata.com,
 * Public Domain / CC0 1.0 Universal).
 */

export const JAPAN_MAP_VIEWBOX = {
  width: 148,
  height: 106,
  lonMin: 129.2,
  latMax: 45.7,
  latRef: 32,
  scale: 6.7,
  padX: 5,
  padY: 4,
};

/**
 * Project geographic `(lon, lat)` (degrees East / North) into the JapanMiniMap SVG viewBox
 * using an equirectangular `cos(latRef)` projection.
 *
 * @param {number} lon
 * @param {number} lat
 * @param {typeof JAPAN_MAP_VIEWBOX} [spec]
 * @returns {{ x: number, y: number }}
 */
export function projectJapanLonLat(lon, lat, spec = JAPAN_MAP_VIEWBOX) {
  const cosLat = Math.cos((spec.latRef * Math.PI) / 180);
  const x = spec.padX + (lon - spec.lonMin) * cosLat * spec.scale;
  const y = spec.padY + (spec.latMax - lat) * spec.scale;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function ringToSvgPath(ring) {
  return `${ring
    .map(([lon, lat], idx) => {
      const { x, y } = projectJapanLonLat(lon, lat);
      return `${idx === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ')} Z`;
}

// Public-domain (Natural Earth CC0) simplified island rings in [lonE, latN] degrees.
export const JAPAN_ISLAND_LON_LAT = {
  hokkaido: [
    [141.9, 45.52], // Cape Soya (north tip)
    [142.8, 44.95],
    [143.65, 44.28],
    [144.45, 43.98],
    [145.45, 44.32], // Shiretoko Peninsula
    [145.05, 43.72],
    [145.88, 43.35], // Cape Nosappu (Nemuro)
    [144.85, 42.95],
    [144.1, 42.85], // Kushiro
    [143.55, 42.38],
    [143.2, 41.82], // Cape Erimo (south apex)
    [142.35, 42.42],
    [141.65, 42.58], // Tomakomai
    [140.95, 42.28], // Muroran
    [140.48, 42.45], // Uchiura Bay
    [140.68, 42.05],
    [141.15, 41.72], // Oshima SE
    [140.6, 41.65], // Hakodate
    [139.95, 41.38], // Matsumae SW
    [139.72, 42.15],
    [140.25, 42.75],
    [140.32, 43.38], // Shakotan Peninsula
    [141.22, 43.25], // Ishikari Bay
    [141.52, 44.1],
    [141.55, 44.9],
    [141.58, 45.45],
  ],
  honshu: [
    [140.9, 41.5], // Shimokita (Cape Oma)
    [141.58, 41.38], // Cape Shiriya
    [141.52, 40.75],
    [141.85, 40.35], // Hachinohe
    [142.22, 39.55], // Sanriku / Miyako
    [141.95, 38.85],
    [141.6, 38.25], // Oshika Peninsula
    [141.05, 38.1], // Sendai Bay
    [141.15, 36.95], // Iwaki
    [140.82, 36.3],
    [141.08, 35.72], // Cape Inubosaki (Choshi / Kanto bulge)
    [140.55, 35.2], // Boso outer coast
    [140.02, 34.82], // Cape Nojima (Boso tip)
    [139.72, 35.15], // Miura / Tokyo Bay mouth
    [139.25, 35.18], // Sagami Bay
    [138.92, 34.48], // Cape Irozaki (Izu Peninsula)
    [138.5, 34.82], // Suruga Bay
    [138.15, 34.48], // Cape Omaezaki
    [137.15, 34.52], // Atsumi Peninsula
    [136.85, 34.2], // Shima Peninsula
    [136.1, 33.65],
    [135.72, 33.32], // Cape Shionomisaki (Kii Peninsula)
    [135.02, 33.85],
    [135.05, 34.35], // Wakayama / Osaka Bay
    [134.5, 34.55], // Harima / Seto Inland Sea
    [133.55, 34.32], // Okayama / Bingo
    [132.5, 34.18], // Hiroshima
    [131.85, 33.75], // Suo
    [130.85, 33.92], // Shimonoseki (Chugoku western tail)
    [130.78, 34.48], // Nagato
    [131.65, 34.92], // Hagi / San'in
    [132.7, 35.62], // Izumo / Shimane
    [133.65, 35.68], // Yonago / Tottori
    [134.65, 35.75], // Tajima
    [135.3, 35.88], // Tango Peninsula
    [135.85, 35.75], // Wakasa Bay (gentle indentation)
    [136.15, 36.45], // Kaga / Kanazawa
    [136.65, 37.1],
    [137.38, 37.72], // Noto Peninsula (north hook)
    [137.18, 37.05], // Toyama Bay (gentle indentation)
    [137.9, 37.15], // Joetsu
    [138.65, 37.65],
    [139.15, 38.2], // Niigata
    [139.55, 38.85], // Shonai
    [139.85, 39.55], // Akita
    [139.48, 39.98], // Oga Peninsula
    [139.92, 40.38],
    [139.85, 40.82],
    [140.28, 41.32], // Tsugaru Peninsula
    [140.68, 41.05], // Aomori
  ],
  shikoku: [
    [134.68, 34.18], // Naruto
    [134.78, 33.78], // Cape Gamoda
    [134.18, 33.15], // Cape Muroto (SE horn)
    [133.52, 33.48], // Tosa Bay
    [132.92, 32.62], // Cape Ashizuri (SW horn)
    [132.35, 33.15],
    [131.95, 33.35], // Sadamisaki
    [132.75, 33.98], // Matsuyama
    [133.25, 34.18], // Imabari
    [133.85, 34.35], // Sakaide
    [134.25, 34.32], // Takamatsu
  ],
  kyushu: [
    [130.92, 33.88], // Kitakyushu / Moji
    [131.78, 33.58], // Kunisaki Peninsula
    [131.6, 33.18], // Beppu Bay
    [131.98, 32.82],
    [131.68, 32.32], // Hyuga
    [131.45, 31.72], // Miyazaki
    [131.32, 31.25],
    [130.65, 30.88], // Cape Sata (Osumi)
    [130.68, 31.42], // Kagoshima Bay
    [130.48, 31.1], // Ibusuki
    [130.05, 31.2], // Makurazaki (Satsuma)
    [130.15, 31.75],
    [130.02, 32.12],
    [130.38, 32.55], // Amakusa
    [129.68, 32.55], // Nagasaki
    [129.52, 33.28], // Sasebo
    [129.92, 33.58], // Karatsu
    [130.4, 33.68], // Fukuoka
  ],
};

const JAPAN_ISLAND_PATHS = {
  hokkaido: ringToSvgPath(JAPAN_ISLAND_LON_LAT.hokkaido),
  honshu: ringToSvgPath(JAPAN_ISLAND_LON_LAT.honshu),
  shikoku: ringToSvgPath(JAPAN_ISLAND_LON_LAT.shikoku),
  kyushu: ringToSvgPath(JAPAN_ISLAND_LON_LAT.kyushu),
};

const RAW_JAPAN_CITIES = [
  {
    id: 'tokyo',
    labelKey: 'notebook.journal.cities.tokyo',
    nameEn: 'TOKYO',
    nameZh: '東京',
    lon: 139.69,
    lat: 35.69,
    keywords: [
      '東京',
      'tokyo',
      '淺草',
      '浅草',
      'asakusa',
      '銀座',
      'ginza',
      '澀谷',
      '渋谷',
      'shibuya',
      '新宿',
      'shinjuku',
      '押上',
      '晴空塔',
      'skytree',
      '上野',
      'ueno',
      '秋葉原',
      'akihabara',
      '羽田',
      'haneda',
      '築地',
      '豐洲',
    ],
  },
  {
    id: 'fuji',
    labelKey: 'notebook.journal.cities.fuji',
    nameEn: 'FUJI',
    nameZh: '富士',
    lon: 138.73,
    lat: 35.36,
    keywords: [
      '富士',
      'fuji',
      '河口湖',
      'kawaguchiko',
      '天上山',
      '箱根',
      'hakone',
      'ほうとう',
    ],
  },
  {
    id: 'narita',
    labelKey: 'notebook.journal.cities.narita',
    nameEn: 'NARITA',
    nameZh: '成田',
    lon: 140.39,
    lat: 35.77,
    keywords: ['成田', 'narita', 'skyliner'],
  },
  {
    id: 'yokohama',
    labelKey: 'notebook.journal.cities.yokohama',
    nameEn: 'YOKOHAMA',
    nameZh: '橫濱',
    lon: 139.64,
    lat: 35.44,
    keywords: ['橫濱', '横浜', 'yokohama', '港未來', 'みなとみらい'],
  },
  {
    id: 'osaka',
    labelKey: 'notebook.journal.cities.osaka',
    nameEn: 'OSAKA',
    nameZh: '大阪',
    lon: 135.5,
    lat: 34.69,
    keywords: [
      '大阪',
      'osaka',
      '道頓堀',
      'dotonbori',
      '難波',
      'なんば',
      'namba',
      '梅田',
      'umeda',
      '黑門',
      '心齋橋',
      '環球影城',
      '關西',
      '関西',
      'kansai',
    ],
  },
  {
    id: 'kyoto',
    labelKey: 'notebook.journal.cities.kyoto',
    nameEn: 'KYOTO',
    nameZh: '京都',
    lon: 135.77,
    lat: 35.01,
    keywords: ['京都', 'kyoto', '嵐山', '清水寺', '祇園', '伏見'],
  },
  {
    id: 'sapporo',
    labelKey: 'notebook.journal.cities.sapporo',
    nameEn: 'SAPPORO',
    nameZh: '札幌',
    lon: 141.35,
    lat: 43.06,
    keywords: ['北海道', 'hokkaido', '札幌', 'sapporo', '小樽', '函館', '富良野'],
  },
  {
    id: 'fukuoka',
    labelKey: 'notebook.journal.cities.fukuoka',
    nameEn: 'FUKUOKA',
    nameZh: '福岡',
    lon: 130.4,
    lat: 33.59,
    keywords: ['福岡', 'fukuoka', '博多', 'hakata', '九州', 'kyushu', '沖繩', '沖縄', 'okinawa'],
  },
];

export const JAPAN_CITIES = RAW_JAPAN_CITIES.map((city) => {
  const { x, y } = projectJapanLonLat(city.lon, city.lat);
  return {
    ...city,
    x,
    y,
  };
});

const JAPAN_GENERAL_KEYWORDS = [
  '日本',
  'japan',
  'nippon',
  'ニッポン',
  '名古屋',
  'nagoya',
  '神戶',
  'kobe',
  '奈良',
  'nara',
  '一蘭',
  'uniqlo',
  'suica',
  'ローソン',
  'lawson',
];

const NON_JAPAN_KEYWORDS = [
  '冰島',
  'iceland',
  '韓國',
  '首爾',
  '釜山',
  '濟州',
  'korea',
  'seoul',
  'busan',
  'jeju',
  '台灣',
  '台北',
  '高雄',
  '台南',
  'taiwan',
  'taipei',
  '泰國',
  '曼谷',
  '清邁',
  'thailand',
  'bangkok',
  '比利時',
  '布魯塞爾',
  '布魯日',
  '安特衛普',
  'belgium',
  'brussels',
  'brugge',
  'bruges',
  'antwerp',
  '法國',
  '巴黎',
  'france',
  'paris',
  '英國',
  '倫敦',
  'uk',
  'london',
  '意大利',
  '羅馬',
  '米蘭',
  'italy',
  'rome',
  '美國',
  '紐約',
  'usa',
  '澳洲',
  '悉尼',
  '墨爾本',
  'australia',
  '歐洲',
  'europe',
];

function collectTripSearchText(trip) {
  if (!trip || typeof trip !== 'object') return '';
  const parts = [trip.id, trip.name];
  if (trip.days && typeof trip.days === 'object') {
    for (const day of Object.values(trip.days)) {
      if (!day || typeof day !== 'object') continue;
      parts.push(day.title, day.note);
      if (Array.isArray(day.itinerary)) {
        for (const stop of day.itinerary) {
          if (stop?.title) parts.push(stop.title);
        }
      }
    }
  }
  if (Array.isArray(trip.expenses)) {
    for (const exp of trip.expenses) {
      if (!exp || typeof exp !== 'object') continue;
      parts.push(exp.place, exp.location, exp.locationEn, exp.store, exp.storeOriginal, exp.storeEn);
    }
  }
  return parts
    .filter((x) => typeof x === 'string' && x.trim())
    .join(' ')
    .toLowerCase();
}

/**
 * Adaptive tracking class so wide-spaced editorial headers never overflow 375–390px viewports.
 */
export function editorialTrackingClass(text = '') {
  const len = String(text || '').trim().length;
  if (len <= 10) return 'tracking-[0.22em]';
  if (len <= 16) return 'tracking-[0.14em]';
  return 'tracking-[0.06em]';
}

/**
 * Resolve destination metadata for a trip.
 * Always returns a non-null descriptor object.
 *
 * @param {Record<string, any> | null | undefined} trip
 * @returns {{
 *   code: 'JP' | null,
 *   isFallback: boolean,
 *   nameKey: string,
 *   subtitleKey: string,
 *   localName: string,
 *   cities: Array<{
 *     id: string,
 *     labelKey: string,
 *     nameEn: string,
 *     nameZh: string,
 *     x: number,
 *     y: number,
 *     labelX: number,
 *     labelY: number,
 *     leaderX: number,
 *     leaderY: number,
 *     anchor: 'start' | 'end' | 'middle',
 *   }>
 * }}
 */
export function resolveTripDestination(trip) {
  const fallback = {
    code: null,
    isFallback: true,
    nameKey: 'notebook.journal.countries.generic.name',
    subtitleKey: 'notebook.journal.countries.generic.subtitle',
    localName: '',
    cities: [],
  };

  if (!trip || typeof trip !== 'object') {
    return fallback;
  }

  const explicitCode =
    typeof trip.countryCode === 'string' ? trip.countryCode.trim().toUpperCase() : '';
  if (explicitCode && explicitCode !== 'JP') {
    return fallback;
  }

  const haystack = collectTripSearchText(trip);
  const hasNonJapanKeyword =
    explicitCode !== 'JP' && NON_JAPAN_KEYWORDS.some((kw) => haystack.includes(kw));
  if (hasNonJapanKeyword) {
    return fallback;
  }

  const matchedCities = JAPAN_CITIES.filter((city) =>
    city.keywords.some((kw) => haystack.includes(kw)),
  );
  const hasGeneralJapanKeyword = JAPAN_GENERAL_KEYWORDS.some((kw) => haystack.includes(kw));
  const hasJpExpenseMarket =
    Array.isArray(trip.expenses) &&
    trip.expenses.some((e) => String(e?.aiDetectedMarket || '').toUpperCase() === 'JP');

  const isJapan =
    explicitCode === 'JP' ||
    matchedCities.length > 0 ||
    hasGeneralJapanKeyword ||
    hasJpExpenseMarket;

  if (!isJapan) {
    return fallback;
  }

  let selectedCities = matchedCities.slice(0, 3);
  if (selectedCities.length === 0) {
    selectedCities = [JAPAN_CITIES[0], JAPAN_CITIES[1], JAPAN_CITIES[4]]; // Tokyo, Fuji, Osaka
  } else if (selectedCities.length === 1 && selectedCities[0].id === 'osaka') {
    selectedCities = [selectedCities[0], JAPAN_CITIES[5], JAPAN_CITIES[0]]; // Osaka, Kyoto, Tokyo
  } else if (selectedCities.length === 1 && selectedCities[0].id === 'tokyo') {
    selectedCities = [selectedCities[0], JAPAN_CITIES[1], JAPAN_CITIES[2]]; // Tokyo, Fuji, Narita
  }

  const cities = selectedCities.map(({ keywords: _kw, ...pin }) => pin);

  return {
    code: 'JP',
    isFallback: false,
    nameKey: 'notebook.journal.countries.JP.name',
    subtitleKey: 'notebook.journal.countries.JP.subtitle',
    localName: '日本',
    cities,
  };
}

/**
 * Small inline SVG flag (`20×14px` default) using theme CSS variables only (zero emoji flags).
 */
export function CountryFlag({ code = 'JP', className = 'h-3.5 w-5' }) {
  if (code !== 'JP') return null;
  return createElement(
    'svg',
    {
      'aria-hidden': 'true',
      focusable: 'false',
      'data-testid': 'country-flag-jp',
      viewBox: '0 0 24 16',
      fill: 'none',
      className: `pointer-events-none inline-block shrink-0 select-none ${className}`.trim(),
    },
    createElement('rect', {
      x: '0.75',
      y: '0.75',
      width: '22.5',
      height: '14.5',
      rx: '1.5',
      fill: 'rgb(var(--c-cream-soft))',
      stroke: 'rgb(var(--c-line))',
      strokeWidth: '1.1',
    }),
    createElement('circle', {
      cx: '12',
      cy: '8',
      r: '4.1',
      fill: 'rgb(var(--c-coral-ink))',
    }),
  );
}

/**
 * Simplified public-domain hairline SVG outline map of Japan with projected city dots
 * and a single ≥12px Pacific-side grouped label with thin leader lines.
 * Rendered at 148×106 CSS px matching `viewBox="0 0 148 106"` so `fontSize="12"` is ≥12px on screen.
 */
export function JapanMiniMap({ cities = [], t, lang = 'zh-TW', className = '' }) {
  const isEn = String(lang || '').toLowerCase().startsWith('en');
  const resolveLabel = (city) => {
    if (typeof t === 'function' && city.labelKey) {
      const translated = t(city.labelKey);
      if (translated && translated !== city.labelKey) return translated;
    }
    return isEn ? city.nameEn : city.nameZh;
  };

  const resolvedCities = cities.map((city) => {
    if (typeof city.x === 'number' && typeof city.y === 'number') return city;
    if (typeof city.lon === 'number' && typeof city.lat === 'number') {
      return { ...city, ...projectJapanLonLat(city.lon, city.lat) };
    }
    return city;
  });

  const labeledCities = resolvedCities.slice(0, 2);
  const groupedLabel = labeledCities.map(resolveLabel).join(isEn ? ' · ' : '・');
  const primaryCity = labeledCities[0] || null;
  const labelX = 145;
  const labelY = 96;
  const leaderAnchorX = 82;
  const leaderAnchorY = 82;

  return createElement(
    'svg',
    {
      'aria-hidden': 'true',
      focusable: 'false',
      'data-testid': 'japan-mini-map',
      viewBox: `0 0 ${JAPAN_MAP_VIEWBOX.width} ${JAPAN_MAP_VIEWBOX.height}`,
      fill: 'none',
      className: `pointer-events-none h-[106px] w-[148px] shrink-0 select-none lg:h-[143px] lg:w-[200px] ${className}`.trim(),
    },
    /* Subtle latitude hairline */
    createElement('path', {
      d: 'M4 71 H144',
      stroke: 'rgb(var(--c-line) / 0.45)',
      strokeWidth: '0.75',
      strokeDasharray: '2 3',
    }),
    /* Soft coastal water-lining halo */
    ...Object.entries(JAPAN_ISLAND_PATHS).map(([island, d]) =>
      createElement('path', {
        key: `halo-${island}`,
        d,
        fill: 'none',
        stroke: 'rgb(var(--c-teal-soft))',
        strokeWidth: '2.6',
        strokeLinejoin: 'round',
      }),
    ),
    /* Hokkaido */
    createElement('path', {
      'data-map-island': 'hokkaido',
      d: JAPAN_ISLAND_PATHS.hokkaido,
      fill: 'rgb(var(--c-beige))',
      stroke: 'rgb(var(--c-ink-soft))',
      strokeWidth: '1.05',
      strokeLinejoin: 'round',
    }),
    /* Honshu */
    createElement('path', {
      'data-map-island': 'honshu',
      d: JAPAN_ISLAND_PATHS.honshu,
      fill: 'rgb(var(--c-beige))',
      stroke: 'rgb(var(--c-ink-soft))',
      strokeWidth: '1.05',
      strokeLinejoin: 'round',
    }),
    /* Shikoku */
    createElement('path', {
      'data-map-island': 'shikoku',
      d: JAPAN_ISLAND_PATHS.shikoku,
      fill: 'rgb(var(--c-beige))',
      stroke: 'rgb(var(--c-ink-soft))',
      strokeWidth: '1',
      strokeLinejoin: 'round',
    }),
    /* Kyushu */
    createElement('path', {
      'data-map-island': 'kyushu',
      d: JAPAN_ISLAND_PATHS.kyushu,
      fill: 'rgb(var(--c-beige))',
      stroke: 'rgb(var(--c-ink-soft))',
      strokeWidth: '1',
      strokeLinejoin: 'round',
    }),
    /* Thin leader line from primary city into open Pacific Ocean */
    primaryCity
      ? createElement('polyline', {
          points: `${primaryCity.x},${primaryCity.y} ${leaderAnchorX},${leaderAnchorY} ${leaderAnchorX + 10},${leaderAnchorY}`,
          fill: 'none',
          stroke: 'rgb(var(--c-ink-soft) / 0.8)',
          strokeWidth: '0.85',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      : null,
    /* Projected city dots */
    ...resolvedCities.map((city, idx) =>
      createElement(
        'g',
        { key: city.id, 'data-map-city': city.id },
        createElement('circle', {
          cx: String(city.x),
          cy: String(city.y),
          r: idx === 0 ? '1.85' : '1.35',
          fill: 'rgb(var(--c-coral-ink))',
          stroke: 'rgb(var(--c-cream-soft))',
          strokeWidth: '0.6',
        }),
      ),
    ),
    /* Grouped >=12px label in open Pacific sea area (lower-right) */
    groupedLabel
      ? createElement(
          'text',
          {
            x: String(labelX),
            y: String(labelY),
            textAnchor: 'end',
            fontSize: '12',
            className: 'fill-current font-hand font-bold tracking-[0.03em] text-ink',
          },
          groupedLabel,
        )
      : null,
  );
}

/**
 * Reserved-aspect bottom watercolor/ink landscape strip (`~358×68px` at mobile) for the Home trip cover card.
 * Uses an extended horizontal SVG `viewBox="-321 0 1000 68"` (centred on `x=179`, the midpoint of `0..358`)
 * with `preserveAspectRatio="xMidYMid slice"` inside a `h-[68px]` slot:
 * - At 390px (`~356×68px`), scale is 1:1 and the visible window is `x ∈ [0..358]`, identical to the mobile composition.
 * - At wider viewports (768–1440px), scale stays 1:1 so Mt. Fuji is never cropped or enlarged while the horizon,
 *   hills, shoreline, and reeds extend naturally across the wider card.
 */
export function LandscapeStrip({ src = null, className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showBitmap = Boolean(src) && !imgFailed;

  return createElement(
    'div',
    {
      'aria-hidden': 'true',
      'data-testid': 'landscape-strip',
      className: `pointer-events-none relative h-[68px] w-full overflow-hidden border-t border-line/60 bg-cream-soft select-none ${className}`.trim(),
    },
    showBitmap
      ? createElement('img', {
          src,
          alt: '',
          'aria-hidden': 'true',
          width: '358',
          height: '68',
          loading: 'eager',
          decoding: 'async',
          onError: () => setImgFailed(true),
          className: 'pointer-events-none mx-auto block h-full w-full max-w-[358px] select-none object-cover',
        })
      : createElement(
          'svg',
          {
            'aria-hidden': 'true',
            focusable: 'false',
            viewBox: '-321 0 1000 68',
            preserveAspectRatio: 'xMidYMid slice',
            fill: 'none',
            className: 'pointer-events-none block h-full w-full select-none',
          },
          /* Soft mineral sky wash & warm autumn horizon glow */
          createElement('rect', {
            x: '-321',
            y: '0',
            width: '1000',
            height: '68',
            fill: 'rgb(var(--c-cream-soft))',
          }),
          createElement('path', {
            d: 'M-321 0 H679 V45 Q520 39 358 44 Q240 50 120 42 T0 46 Q-160 50 -321 44 Z',
            fill: 'rgb(var(--c-wash-sky) / 0.65)',
          }),
          createElement('ellipse', {
            cx: '248',
            cy: '22',
            rx: '38',
            ry: '16',
            fill: 'rgb(var(--c-coral-soft) / 0.55)',
          }),
          createElement('circle', {
            cx: '248',
            cy: '20',
            r: '9',
            fill: 'rgb(var(--c-coral) / 0.35)',
          }),
          /* Distant misty hills (exact [0..358] control points preserved, extended horizontally) */
          createElement('path', {
            d: 'M-321 44 Q-220 36 -110 42 Q-52 46 0 46 Q48 33 102 41 T215 38 T358 43 T510 40 T679 44 V68 H-321 Z',
            fill: 'rgb(var(--c-teal-soft) / 0.65)',
          }),
          /* Mt. Fuji silhouette wash + snow cap + ink ridge line (natural size at x=162..256) */
          createElement('path', {
            d: 'M162 46 C181 36 194 21 202 11 H216 C224 21 237 36 256 46 Z',
            fill: 'rgb(var(--c-teal) / 0.28)',
          }),
          createElement('path', {
            d: 'M202 11 H216 L223 22 L216 19 L211 23 L206 19 L201 22 L195 21 Z',
            fill: 'rgb(var(--c-cream-soft))',
          }),
          createElement('path', {
            d: 'M166 45 C183 35 194 21 202 11 H216 C224 21 235 35 252 45',
            stroke: 'rgb(var(--c-ink-soft))',
            strokeWidth: '0.95',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }),
          /* Midground sage hills & ochre sandy shore wash */
          createElement('path', {
            d: 'M-321 49 Q-210 41 -105 47 Q-50 51 0 50 Q76 39 154 48 T310 46 L358 49 Q495 42 679 48 V68 H-321 Z',
            fill: 'rgb(var(--c-sage-soft) / 0.82)',
          }),
          createElement('path', {
            d: 'M-321 53 Q-160 48 0 54 Q95 47 188 55 T358 52 T520 54 T679 52 V68 H-321 Z',
            fill: 'rgb(var(--c-wash-ochre) / 0.78)',
          }),
          /* Fine pen-and-ink shoreline contours, water ripples, and autumn reeds */
          createElement('path', {
            d: 'M-290 52 Q-150 46 -12 52 M8 50 Q78 41 152 49 M178 54 Q264 49 348 53 M374 51 Q505 44 650 52',
            stroke: 'rgb(var(--c-ink-soft) / 0.6)',
            strokeWidth: '0.8',
            strokeLinecap: 'round',
          }),
          createElement('path', {
            d: 'M-190 59 H-148 M-85 61 H-42 M124 58 H162 M136 62 H182 M270 59 H308 M430 58 H472 M545 61 H586',
            stroke: 'rgb(var(--c-teal-strong) / 0.45)',
            strokeWidth: '0.75',
            strokeLinecap: 'round',
          }),
          createElement('path', {
            d: 'M-218 58 L-220 47 M-214 59 L-212 46 M38 58 L35 46 M41 59 L42 45 M45 59 L48 48 M316 57 L314 47 M320 58 L322 46 M596 58 L594 47 M600 59 L602 46',
            stroke: 'rgb(var(--c-ink-soft) / 0.65)',
            strokeWidth: '0.85',
            strokeLinecap: 'round',
          }),
        ),
  );
}
