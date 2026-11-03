import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryPalette } from '../../theme/tokens.js';
import { CATEGORY_ICON_NAME, CORE_ICONS, JournalIcon } from './core.jsx';
import {
  HatchSea,
  NavyTape,
  RouteLine,
  TodayRing,
  TornEdge,
  WashBlob,
  WashiLabel,
} from './decor.jsx';
import { loadDestinationPack } from './index.js';

const JP_VIGNETTE_KEYS = [
  'fuji',
  'castle',
  'pagoda',
  'gate',
  'lantern',
  'latticeTower',
  'dango',
  'persimmon',
  'smallTrain',
];

const GENERIC_VIGNETTE_KEYS = ['suitcase', 'plane', 'compass'];

const SAMPLE_KR_TRIP = {
  id: 'trip-sample-kr',
  name: '首爾 · 釜山 · 濟州',
  countryCode: 'KR',
};

const LazyJpShowcase = lazy(() =>
  loadDestinationPack('JP').then((pack) => ({
    default: function JpShowcase({ cities, labels, vignetteLabels }) {
      const MapComp = pack.Map;
      return (
        <div className="space-y-4">
          <MapComp cities={cities} labels={labels} className="max-w-md" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {JP_VIGNETTE_KEYS.map((key) => {
              const Vig = pack.vignettes[key];
              if (!Vig) return null;
              return (
                <div
                  key={key}
                  className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-sm border border-ink-soft/35 bg-paper p-2"
                >
                  <Vig className="h-9 w-12" />
                  <span className="font-hand text-xs text-ink-soft">
                    {vignetteLabels[key] || key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
  })),
);

const LazyGenericShowcase = lazy(() =>
  loadDestinationPack(SAMPLE_KR_TRIP.countryCode).then((pack) => ({
    default: function GenericShowcase({ stops, vignetteLabels }) {
      const MapComp = pack.Map;
      return (
        <div className="space-y-4">
          <MapComp cities={stops} labels={stops} className="max-w-md" />
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
            {GENERIC_VIGNETTE_KEYS.map((key) => {
              const Vig = pack.vignettes[key];
              if (!Vig) return null;
              return (
                <div
                  key={key}
                  className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-sm border border-ink-soft/35 bg-paper p-2"
                >
                  <Vig className="h-10 w-10" />
                  <span className="font-hand text-xs text-ink-soft">
                    {vignetteLabels[key] || key}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
  })),
);

const CATEGORY_WASH_TONE = {
  飲食: 'berry',
  交通: 'sky',
  購物: 'berry',
  住宿: 'wheat',
  娛樂: 'leaf',
  其他: 'wheat',
  未分類: 'sky',
};

export default function ArtKitGallery() {
  const { t } = useTranslation();

  const jpCities = ['tokyo', 'fuji', 'osaka'];
  const jpCityLabels = [
    t('notebook.artkit.jpCities.tokyo'),
    t('notebook.artkit.jpCities.fuji'),
    t('notebook.artkit.jpCities.osaka'),
  ];

  const jpVignetteLabels = Object.fromEntries(
    JP_VIGNETTE_KEYS.map((k) => [k, t(`notebook.artkit.jpVignettes.${k}`)]),
  );

  const genericStops = [
    t('notebook.artkit.genericCities.seoul'),
    t('notebook.artkit.genericCities.busan'),
    t('notebook.artkit.genericCities.jeju'),
  ];

  const genericVignetteLabels = Object.fromEntries(
    GENERIC_VIGNETTE_KEYS.map((k) => [k, t(`notebook.artkit.genericVignettes.${k}`)]),
  );

  return (
    <div
      data-testid="artkit-gallery"
      className="jr-desk min-h-screen px-3 py-5 text-ink sm:px-6"
    >
      <main className="jr-paper mx-auto max-w-4xl space-y-6 rounded-sm border border-ink-soft/60 p-4 shadow-sm sm:p-6">
        {/* Notebook Page Header */}
        <header className="relative border-b border-ink-soft/40 pb-3">
          <NavyTape tilt={-2} className="mb-2 h-3.5 w-16" />
          <h1 className="font-hand text-2xl font-bold tracking-wider text-ink">
            {t('notebook.artkit.title')}
          </h1>
          <p className="mt-1 font-hand text-xs text-ink-soft">
            {t('notebook.artkit.subtitle')}
          </p>
        </header>

        {/* 1. Core Icons Grid */}
        <section
          data-testid="artkit-core-icons"
          className="jr-grid relative space-y-3 rounded-sm border border-ink-soft/45 p-3.5"
        >
          <div className="flex items-center gap-2">
            <WashiLabel tilt={-1}>{t('notebook.artkit.sections.coreIcons')}</WashiLabel>
          </div>
          <div
            data-testid="artkit-core"
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7"
          >
            {Object.keys(CORE_ICONS).map((iconName) => (
              <div
                key={iconName}
                className="flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-sm border border-ink-soft/30 bg-paper p-2 text-center"
              >
                <JournalIcon name={iconName} className="h-6 w-6 text-ink" />
                <span className="font-hand text-xs leading-tight text-ink-soft">
                  {iconName}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Category Icons */}
        <section
          data-testid="artkit-category-icons"
          className="jr-grid relative space-y-3 rounded-sm border border-ink-soft/45 p-3.5"
        >
          <div className="flex items-center gap-2">
            <WashiLabel tilt={1}>{t('notebook.artkit.sections.categoryIcons')}</WashiLabel>
          </div>
          <div
            data-testid="artkit-categories"
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 md:grid-cols-7"
          >
            {Object.keys(categoryPalette).map((catKey, idx) => (
              <div
                key={catKey}
                className="flex min-h-[64px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-sm border border-ink-soft/35 bg-paper p-2 text-center"
              >
                <WashBlob
                  tone={CATEGORY_WASH_TONE[catKey] || 'wheat'}
                  shape={((idx % 3) + 1)}
                  className="h-10 w-10"
                >
                  <JournalIcon name={catKey} className="h-6 w-6 text-ink" />
                </WashBlob>
                <span className="font-hand text-xs font-bold text-ink">
                  {t(`categories.${catKey}`)}
                </span>
                <span className="font-hand text-xs text-ink-muted">
                  {CATEGORY_ICON_NAME[catKey]}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Decorative Primitives */}
        <section
          data-testid="artkit-decor"
          className="jr-grid relative space-y-4 rounded-sm border border-ink-soft/45 p-3.5"
        >
          <div className="flex items-center gap-2">
            <WashiLabel tilt={-2}>{t('notebook.artkit.sections.decor')}</WashiLabel>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Wash Blobs */}
            <div className="space-y-2 rounded-sm border border-ink-soft/30 bg-paper p-3">
              <h2 className="font-hand text-sm font-bold text-ink">
                {t('notebook.artkit.decorLabels.washBlobs')}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { tone: 'sky', shape: 1, label: t('notebook.artkit.decorLabels.toneSky') },
                  { tone: 'leaf', shape: 2, label: t('notebook.artkit.decorLabels.toneLeaf') },
                  { tone: 'berry', shape: 3, label: t('notebook.artkit.decorLabels.toneBerry') },
                  { tone: 'wheat', shape: 1, label: t('notebook.artkit.decorLabels.toneWheat') },
                ].map((b) => (
                  <div key={b.tone} className="flex flex-col items-center gap-1">
                    <WashBlob tone={b.tone} shape={b.shape} className="h-11 w-11" />
                    <span className="font-hand text-xs text-ink-soft">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Route Line */}
            <div className="space-y-2 rounded-sm border border-ink-soft/30 bg-paper p-3">
              <h2 className="font-hand text-sm font-bold text-ink">
                {t('notebook.artkit.decorLabels.routeLine')}
              </h2>
              <RouteLine
                points={[
                  { x: 24, y: 42 },
                  { x: 92, y: 20 },
                  { x: 158, y: 46 },
                  { x: 216, y: 26 },
                ]}
                className="h-16 w-full rounded-sm border border-ink-soft/20 bg-paper"
              />
            </div>

            {/* Hatch Sea */}
            <div className="space-y-2 rounded-sm border border-ink-soft/30 bg-paper p-3">
              <h2 className="font-hand text-sm font-bold text-ink">
                {t('notebook.artkit.decorLabels.hatchSea')}
              </h2>
              <HatchSea className="h-16 w-full rounded-sm border border-ink-soft/25" />
            </div>

            {/* Washi Label + Navy Tape + Today Ring + Torn Edge */}
            <div className="space-y-3 rounded-sm border border-ink-soft/30 bg-paper p-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex flex-col items-start gap-1">
                  <span className="font-hand text-xs text-ink-soft">
                    {t('notebook.artkit.decorLabels.washiLabel')}
                  </span>
                  <WashiLabel tilt={-2}>
                    {t('notebook.artkit.decorLabels.washiSampleText')}
                  </WashiLabel>
                </div>

                <div className="flex flex-col items-start gap-1">
                  <span className="font-hand text-xs text-ink-soft">
                    {t('notebook.artkit.decorLabels.navyTape')}
                  </span>
                  <NavyTape tilt={2} className="h-4 w-16" />
                </div>

                <div className="flex flex-col items-center gap-1">
                  <span className="font-hand text-xs text-ink-soft">
                    {t('notebook.artkit.decorLabels.todayRing')}
                  </span>
                  <TodayRing className="h-7 w-7">22</TodayRing>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <span className="font-hand text-xs text-ink-soft">
                  {t('notebook.artkit.decorLabels.tornEdge')}
                </span>
                <div className="rounded-t-sm border border-b-0 border-ink-soft/35 bg-paper-shade/60 p-2">
                  <TornEdge className="h-2 w-full" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Japan Destination Pack */}
        <section
          data-testid="artkit-jp-pack"
          className="jr-grid relative space-y-3 rounded-sm border border-ink-soft/45 p-3.5"
        >
          <div data-testid="artkit-jp" className="space-y-3">
            <div className="flex items-center gap-2">
              <WashiLabel tilt={-1}>{t('notebook.artkit.sections.jpPack')}</WashiLabel>
            </div>
            <Suspense
              fallback={
                <div
                  aria-hidden="true"
                  className="min-h-[140px] w-full rounded-sm border border-ink-soft/30 bg-paper"
                />
              }
            >
              <LazyJpShowcase
                cities={jpCities}
                labels={jpCityLabels}
                vignetteLabels={jpVignetteLabels}
              />
            </Suspense>
          </div>
        </section>

        {/* 5. Generic Destination Pack */}
        <section
          data-testid="artkit-generic-pack"
          className="jr-grid relative space-y-3 rounded-sm border border-ink-soft/45 p-3.5"
        >
          <div data-testid="artkit-generic" className="space-y-3">
            <div className="flex items-center gap-2">
              <WashiLabel tilt={1}>{t('notebook.artkit.sections.genericPack')}</WashiLabel>
            </div>
            <Suspense
              fallback={
                <div
                  aria-hidden="true"
                  className="min-h-[120px] w-full rounded-sm border border-ink-soft/30 bg-paper"
                />
              }
            >
              <LazyGenericShowcase
                stops={genericStops}
                vignetteLabels={genericVignetteLabels}
              />
            </Suspense>
          </div>
        </section>
      </main>
    </div>
  );
}
