import { REF_CATEGORIES, REF_PEOPLE, REF_RATE } from '../proto/ref/mockRefTrip';

/**
 * Store-shaped exchange rates matching classic `exchangeRates` (`1 HKD = X foreign`).
 * `19.0114` JPY per HKD corresponds closely to `1 / 0.0526`.
 */
export const LEGACY_EXCHANGE_RATES = Object.freeze({
  HKD: 1,
  JPY: Number((1 / REF_RATE).toFixed(4)),
});

const stop = (id, time, title) => ({ id, time, title, done: false });

/**
 * Resolve the seed mode from a URL query string (`?proto=notebook&seed=legacy`).
 *
 * @param {string} [search]
 * @returns {'legacy' | 'default'}
 */
export function resolveNotebookSeed(
  search = typeof window !== 'undefined' ? window.location.search : '',
) {
  const raw = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(raw);
  let seedRaw = params.get('seed');
  if (seedRaw == null) {
    for (const [key, value] of params.entries()) {
      if (String(key).toLowerCase() === 'seed') {
        seedRaw = value;
        break;
      }
    }
  }
  const seed = String(seedRaw ?? '').trim().toLowerCase();
  if (seed === 'legacy') return 'legacy';
  return 'default';
}

/**
 * Check whether the current URL requests the legacy store-shaped seed (`seed=legacy`).
 *
 * @param {string} [search]
 * @returns {boolean}
 */
export function isLegacySeed(
  search = typeof window !== 'undefined' ? window.location.search : '',
) {
  return resolveNotebookSeed(search) === 'legacy';
}

/**
 * Build a store-shaped legacy trip fixture with:
 * - zh display dates (`YYYY年M月D日`) and ISO dates (`YYYY-MM-DD`)
 * - store field names (`location`, `paymentMethod`, `receiptTime`, `sourceHash`, `items`)
 * - numeric `Date.now()`-style IDs
 * - at least 1 undated expense (`date: ''`)
 * - at least 1 multi-item expense with partial line-item assignees (`assignedTo: '共同'` with item-level `'Oscar'` / `'阿明'`)
 * - `settings.budget` set (`15000`)
 */
export function createLegacySeedTrip() {
  return {
    id: 'trip-legacy-tokyo-2026',
    name: '東京秋日之旅',
    startDate: '2026-10-18',
    endDate: '2026-10-27',
    tripCurrency: 'JPY',
    accountingCurrency: 'HKD',
    exchangeRates: { ...LEGACY_EXCHANGE_RATES },
    settings: {
      people: [...REF_PEOPLE],
      rate: REF_RATE,
      budget: 15000,
    },
    days: {
      '2026-10-18': {
        title: '抵達東京',
        note: '成田',
        sticker: 'plane',
        journal: '',
        itinerary: [
          stop('ls1', '15:10', '成田機場 Skyliner'),
          stop('ls2', '18:00', '入住淺草酒店'),
        ],
      },
      '2026-10-20': {
        title: '銀座購物日',
        note: '銀座',
        sticker: 'shopping',
        journal: '',
        itinerary: [stop('ls3', '11:00', '銀座 伊東屋')],
      },
      '2026-10-21': {
        title: '澀谷夜景',
        note: '澀谷',
        sticker: 'tower',
        journal: '',
        itinerary: [stop('ls4', '17:30', 'SHIBUYA SKY')],
      },
      '2026-10-22': {
        title: '富士山一日遊',
        note: '富士',
        sticker: 'fuji',
        journal: '記得帶暖包，山上 5 度。',
        itinerary: [
          stop('ls5', '07:30', '新宿 高速巴士出發'),
          stop('ls6', '11:30', '天上山纜車 看富士山'),
        ],
      },
    },
    expenses: [
      {
        id: 1729240000101,
        date: '2026年10月18日',
        store: '成田機場 Skyliner',
        location: '成田',
        category: REF_CATEGORIES[1], // 交通
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 5160,
        hkdAmount: 271,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '信用卡',
        payer: 'Oscar',
        receiptTime: '15:10',
        sourceHash: 'legacy-hash-101',
        createdAt: '2026-10-18T06:10:00.000Z',
        items: [],
      },
      {
        id: 1729240000102,
        date: '2026年10月18日',
        store: '淺草 雷門酒店',
        location: '淺草',
        category: REF_CATEGORIES[3], // 住宿
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 38600,
        hkdAmount: 2030,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: 'VISA',
        payer: 'Oscar',
        createdAt: '2026-10-18T09:00:00.000Z',
        items: [],
      },
      {
        id: 1729410000103,
        date: '2026-10-20',
        store: 'UNIQLO 銀座',
        location: '銀座',
        category: REF_CATEGORIES[2], // 購物
        assignedTo: 'Oscar',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 526,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '信用卡',
        payer: 'Oscar',
        receiptTime: '14:20',
        sourceHash: 'legacy-hash-103',
        createdAt: '2026-10-20T05:20:00.000Z',
        items: [
          { name: '輕便羽絨外套', price: 6000, assignedTo: 'Oscar' },
          { name: '發熱內衣', price: 4000, assignedTo: 'Oscar' },
        ],
      },
      {
        id: 1729490000104,
        date: '2026年10月21日',
        store: '松本清 澀谷店',
        storeOriginal: 'マツモトキヨシ 渋谷店',
        storeEn: 'Matsumoto Kiyoshi Shibuya',
        location: '澀谷',
        locationEn: 'Shibuya',
        category: REF_CATEGORIES[2], // 購物
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 10000,
        hkdAmount: 500,
        rate: 20,
        subtotal: 10000,
        tax: 0,
        taxRefund: 0,
        discount: 0,
        paymentMethod: '信用卡',
        payer: 'Oscar',
        receiptTime: '16:15',
        receiptType: 'instant_tax_free',
        aiDetectedMarket: 'JP',
        sourceHash: 'legacy-hash-104-partial',
        createdAt: '2026-10-21T07:15:00.000Z',
        items: [
          { name: '感冒藥', price: 6000, assignedTo: 'Oscar' },
          { name: '面膜禮盒', price: 4000, assignedTo: '阿明' },
        ],
      },
      {
        id: 1729500000105,
        date: '',
        store: '燒肉 敘敘苑',
        location: '澀谷',
        category: REF_CATEGORIES[0], // 飲食
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 18700,
        hkdAmount: 984,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '信用卡',
        payer: '阿明',
        sourceHash: 'legacy-hash-105-undated',
        createdAt: '2026-10-21T12:30:00.000Z',
        items: [],
      },
      {
        id: 1729580000106,
        date: '2026年10月22日',
        store: '富士急行 河口湖站',
        location: '河口湖',
        category: REF_CATEGORIES[1], // 交通
        assignedTo: '共同',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 5000,
        hkdAmount: 263,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '現金',
        payer: 'Oscar',
        receiptTime: '09:40',
        sourceHash: 'legacy-hash-106',
        createdAt: '2026-10-22T00:40:00.000Z',
        items: [],
      },
      {
        id: 1729580000107,
        date: '2026年10月22日',
        store: '天上山纜車',
        location: '河口湖',
        category: REF_CATEGORIES[4], // 娛樂
        assignedTo: '阿明',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 8250,
        hkdAmount: 434,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '現金',
        payer: '阿明',
        receiptTime: '12:10',
        createdAt: '2026-10-22T03:10:00.000Z',
        items: [],
      },
      {
        id: 1729580000108,
        date: '2026-10-22',
        store: 'ほうとう不動 東恋路店',
        location: '河口湖',
        category: REF_CATEGORIES[0], // 飲食
        assignedTo: 'Oscar',
        currency: 'JPY',
        originalCurrency: 'JPY',
        originalAmount: 7400,
        hkdAmount: 389,
        rate: LEGACY_EXCHANGE_RATES.JPY,
        paymentMethod: '現金',
        payer: 'Oscar',
        receiptTime: '18:30',
        sourceHash: 'legacy-hash-108',
        createdAt: '2026-10-22T09:30:00.000Z',
        items: [],
      },
    ],
  };
}

export function createLegacySeedTrips() {
  return [createLegacySeedTrip()];
}
