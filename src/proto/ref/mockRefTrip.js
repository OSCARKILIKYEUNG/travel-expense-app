/**
 * Seeded data matching Oscar's 2026-10-23 reference screenshots
 * (design/2026-10-23-oscar-reference/). Local only: no Supabase, no sign-in.
 * One expense has no date (the 帳本 ledger shows it under 未有日期); it still counts in the trip total.
 * Totals match the references: 17 expenses, JPY 213,352, HKD 11,222; 10/22 = HKD 1,086 (scanned 2, manual 1).
 */
export const REF_RATE = 0.0526; // 1 JPY -> HKD (mock)
export const REF_TODAY = '2026-10-22';
export const REF_PEOPLE = ['共同', 'Oscar', '阿明'];
export const REF_CATEGORIES = ['飲食', '交通', '購物', '住宿', '娛樂', '其他'];

/** Sticker ids are data (trip.days[iso].sticker); the UI maps id -> icon. */
export const STICKERS = [
  { id: 'plane', label: '飛機', emoji: '✈️' },
  { id: 'torii', label: '鳥居', emoji: '⛩️' },
  { id: 'tower', label: '鐵塔', emoji: '🗼' },
  { id: 'ramen', label: '拉麵', emoji: '🍜' },
  { id: 'shopping', label: '購物', emoji: '🛍️' },
  { id: 'train', label: '電車', emoji: '🚃' },
  { id: 'fuji', label: '富士山', emoji: '🗻' },
  { id: 'wheel', label: '摩天輪', emoji: '🎡' },
  { id: 'onsen', label: '溫泉', emoji: '♨️' },
];

let seq = 0;
function exp(date, store, place, category, assignedTo, jpy, scanned) {
  seq += 1;
  return {
    id: `r${seq}`,
    date,
    store,
    place,
    category,
    assignedTo,
    currency: 'JPY',
    originalCurrency: 'JPY',
    originalAmount: jpy,
    hkdAmount: Math.round(jpy * REF_RATE),
    scanned,
    items: [],
  };
}

const stop = (id, time, title) => ({ id, time, title, done: false });

export function createRefTrip() {
  seq = 0;
  return {
    id: 'trip-ref-tokyo-autumn',
    name: '東京秋日之旅',
    startDate: '2026-10-18',
    endDate: '2026-10-27',
    tripCurrency: 'JPY',
    accountingCurrency: 'HKD',
    settings: { people: REF_PEOPLE },
    days: {
      '2026-10-18': { title: '抵達東京', note: '成田', sticker: null, journal: '', itinerary: [stop('s1', '15:10', '成田機場 Skyliner'), stop('s2', '18:00', '入住淺草酒店')] },
      '2026-10-19': { title: '淺草散步', note: '淺草', sticker: null, journal: '', itinerary: [stop('s3', '09:00', '雷門打卡'), stop('s4', '16:00', '晴空塔展望台')] },
      '2026-10-20': { title: '銀座購物日', note: '銀座', sticker: null, journal: '', itinerary: [stop('s5', '11:00', '銀座 伊東屋'), stop('s6', '18:30', '久兵衛晚餐')] },
      '2026-10-21': { title: '澀谷夜景', note: '澀谷', sticker: null, journal: '', itinerary: [stop('s7', '13:00', '澀谷 PARCO'), stop('s8', '17:30', 'SHIBUYA SKY')] },
      '2026-10-22': {
        title: '富士山一日遊',
        note: '富士',
        sticker: 'fuji',
        journal: '記得帶暖包，山上 5 度。',
        itinerary: [
          stop('s9', '07:30', '新宿 高速巴士出發'),
          stop('s10', '10:00', '河口湖站 寄存行李'),
          stop('s11', '11:30', '天上山纜車 看富士山'),
          stop('s12', '', '晚餐 ほうとう不動'),
        ],
      },
      '2026-10-23': { title: '橫濱半日', note: '', sticker: 'wheel', journal: '', itinerary: [stop('s13', '10:00', '橫濱 港未來')] },
      '2026-10-24': { title: '箱根溫泉', note: '', sticker: 'onsen', journal: '', itinerary: [stop('s14', '09:00', '箱根湯本')] },
      '2026-10-25': { title: '返回東京', note: '返程', sticker: null, journal: '', itinerary: [stop('s15', '14:00', '小田急浪漫特快')] },
      '2026-10-26': { title: '最後採購', note: '', sticker: 'shopping', journal: '', itinerary: [stop('s16', '13:00', '唐吉訶德')] },
      '2026-10-27': { title: '回程', note: '回程', sticker: null, journal: '', itinerary: [stop('s17', '14:20', '羽田機場 回港')] },
    },
    expenses: [
      exp('2026-10-18', '成田機場 Skyliner', '成田', '交通', '共同', 5160, true),
      exp('2026-10-18', '7-Eleven 成田空港店', '成田', '飲食', 'Oscar', 1980, true),
      exp('2026-10-18', '淺草 雷門酒店', '淺草', '住宿', '共同', 38600, false),
      exp('2026-10-18', '一蘭拉麵 淺草店', '淺草', '飲食', '阿明', 2960, true),
      exp('2026-10-19', '淺草今半 午餐', '淺草', '飲食', '共同', 12800, true),
      exp('2026-10-19', '仲見世通 手信', '淺草', '購物', 'Oscar', 4350, true),
      exp('2026-10-19', '晴空塔展望台', '押上', '娛樂', '共同', 7200, true),
      exp('2026-10-20', '銀座 伊東屋', '銀座', '購物', '阿明', 6820, true),
      exp('2026-10-20', '壽司 銀座 久兵衛', '銀座', '飲食', '共同', 36500, true),
      exp('2026-10-20', 'Suica 增值', '銀座', '交通', 'Oscar', 5000, false),
      exp('2026-10-20', 'UNIQLO 銀座', '銀座', '購物', 'Oscar', 17890, true),
      exp('2026-10-21', 'SHIBUYA SKY', '澀谷', '娛樂', '共同', 5400, true),
      exp('2026-10-21', '澀谷 PARCO', '澀谷', '購物', '共同', 29342, true),
      exp('', '燒肉 敘敘苑', '澀谷', '飲食', '共同', 18700, true), // undated: shows in the 帳本 '未有日期' group
      exp('2026-10-22', '富士急行 河口湖站', '河口湖', '交通', '共同', 5000, true),
      exp('2026-10-22', 'ほうとう不動 東恋路店', '河口湖', '飲食', 'Oscar', 7400, true),
      exp('2026-10-22', '天上山纜車', '河口湖', '娛樂', '共同', 8250, false),
    ],
  };
}

/** Sunday-first weeks for the month of isoDate, including faded adjacent-month days. */
export function monthGridSunday(isoDate) {
  const [y, m] = isoDate.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const daysInMonth = new Date(y, m, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const weeks = [];
  for (let i = 0; i < cellCount; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({ iso: iso(d), inMonth: d.getMonth() === m - 1 });
  }
  return weeks;
}
