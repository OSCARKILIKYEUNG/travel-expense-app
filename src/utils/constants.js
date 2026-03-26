/**
 * 匯率方向：1 記帳貨幣（homeCurrency）= X 外幣。
 * 例：homeCurrency = HKD，JPY: 19.23 表示 1 HKD = 19.23 JPY。
 * 轉換公式：homeAmount = originalAmount / rate。
 */
export const DEFAULT_EXCHANGE_RATES = {
  HKD: 1.0,
  JPY: 19.23,
  USD: 0.128,
  CNY: 0.926,
  EUR: 0.118,
  GBP: 0.102,
  SGD: 0.172,
  KRW: 169.49,
  THB: 4.35,
  TWD: 4.0,
  MYR: 0.571,
  PHP: 7.14,
  VND: 3225.81,
  AUD: 0.2,
  CAD: 0.182,
};

export const CURRENCY_NAMES = {
  HKD: '港幣',
  JPY: '日元',
  USD: '美元',
  CNY: '人民幣',
  EUR: '歐元',
  GBP: '英鎊',
  SGD: '新元',
  KRW: '韓元',
  THB: '泰銖',
  TWD: '台幣',
  MYR: '令吉',
  PHP: '披索',
  VND: '越南盾',
  AUD: '澳元',
  CAD: '加元',
};

export const CATEGORY_COLORS = {
  '飲食': '#EF4444',
  '交通': '#3B82F6',
  '購物': '#10B981',
  '住宿': '#F59E0B',
  '娛樂': '#8B5CF6',
  '其他': '#6B7280',
  '未分類': '#9CA3AF',
};

export const CATEGORIES = ['飲食', '交通', '購物', '住宿', '娛樂', '其他'];

export const RECEIPT_TYPES = {
  tax_inclusive: '內稅',
  tax_exclusive: '外稅',
  instant_tax_free: '即時免稅',
  net_tax_free: '淨價免稅',
  vat_refund_later: '離境退稅',
  unknown: '未知',
  standard: '一般',
  '': '未分類',
};

export const RECEIPT_TYPE_OPTIONS = [
  { value: '', label: '未分類（自動）' },
  { value: 'tax_inclusive', label: '內稅（行價含稅＝實付）' },
  { value: 'tax_exclusive', label: '外稅（行價未稅，另加稅）' },
  { value: 'instant_tax_free', label: '即時免稅（標價含稅＞實付）' },
  { value: 'net_tax_free', label: '淨價免稅（品項已扣稅＝實付）' },
  { value: 'vat_refund_later', label: '離境退稅（實付含稅）' },
  { value: 'unknown', label: '未知' },
];

export const PERSON_COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#6366F1', '#14B8A6',
];

export const PERSON_BG_CLASSES = [
  'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-blue-500', 'bg-red-500', 'bg-indigo-500', 'bg-teal-500',
];

export const PRESET_TRIPS_DATA = {
  trips: [
    {
      id: 'trip-default',
      name: '✈️ 我的第一個旅程',
      startDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      expenses: [],
      tripCurrency: 'JPY',
      settings: {
        exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
        people: ['共同', '人物A', '人物B'],
        homeCurrency: 'HKD',
        customCurrencyCode: '',
        customCurrencyRate: 1,
        uiLanguage: 'zh-TW',
      },
    },
  ],
  currentTripId: 'trip-default',
};
