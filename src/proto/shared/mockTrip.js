/**
 * Seeded local data for the prototypes. No Supabase, no sign-in.
 * Shape follows the planned trips_data extension: trip.endDate + trip.days[iso].
 */
const RATE = 0.052; // 1 JPY -> HKD (mock)

function exp(id, date, store, category, jpy, assignedTo, items = []) {
  return {
    id,
    date,
    store,
    category,
    currency: 'JPY',
    originalCurrency: 'JPY',
    originalAmount: jpy,
    hkdAmount: Math.round(jpy * RATE * 10) / 10,
    assignedTo,
    items,
    scanned: true,
  };
}

export const MOCK_PEOPLE = ['Oscar', '阿晴', '共同'];

export const MOCK_CATEGORIES = ['飲食', '交通', '購物', '住宿', '娛樂', '其他'];

export function createMockTrip() {
  return {
    id: 'trip-proto-tokyo',
    name: '東京賞楓之旅',
    startDate: '2026-10-19',
    endDate: '2026-10-27',
    tripCurrency: 'JPY',
    accountingCurrency: 'HKD',
    budgetHkd: 12000,
    settings: { people: MOCK_PEOPLE },
    days: {
      '2026-10-19': {
        note: '抵達成田',
        itinerary: [
          { id: 'i1', time: '09:40', title: '飛往東京', place: '香港國際機場', kind: 'transport', done: true },
          { id: 'i2', time: '15:10', title: '成田特快', place: '成田機場', kind: 'transport', done: true },
          { id: 'i3', time: '18:00', title: '入住酒店', place: '淺草', kind: 'stay', done: true },
        ],
      },
      '2026-10-20': {
        note: '淺草寺',
        itinerary: [
          { id: 'i4', time: '09:00', title: '雷門打卡', place: '淺草寺', kind: 'sight', done: true },
          { id: 'i5', time: '12:30', title: '天婦羅午餐', place: '大黑家', kind: 'food', done: true },
          { id: 'i6', time: '16:00', title: '晴空塔', place: '押上', kind: 'sight', done: true },
        ],
      },
      '2026-10-21': {
        note: '鎌倉',
        itinerary: [
          { id: 'i7', time: '08:30', title: '江之電一日遊', place: '鎌倉站', kind: 'transport', done: true },
          { id: 'i8', time: '11:00', title: '鎌倉大佛', place: '高德院', kind: 'sight', done: true },
        ],
      },
      '2026-10-22': {
        note: '澀谷',
        itinerary: [
          { id: 'i9', time: '10:00', title: '明治神宮', place: '原宿', kind: 'sight', done: true },
          { id: 'i10', time: '19:00', title: 'Shibuya Sky', place: '澀谷', kind: 'sight', done: true },
        ],
      },
      '2026-10-23': {
        note: '築地',
        itinerary: [
          { id: 'i11', time: '08:00', title: '築地場外市場', place: '築地', kind: 'food', done: true },
          { id: 'i12', time: '11:30', title: 'teamLab', place: '豐洲', kind: 'sight', done: false },
          { id: 'i13', time: '18:30', title: '銀座晚餐', place: '銀座', kind: 'food', done: false },
        ],
      },
      '2026-10-24': {
        note: '河口湖',
        itinerary: [
          { id: 'i14', time: '07:30', title: '富士回遊', place: '新宿站', kind: 'transport', done: false },
          { id: 'i15', time: '11:00', title: '紅葉迴廊', place: '河口湖', kind: 'sight', done: false },
        ],
      },
      '2026-10-25': { note: '箱根', itinerary: [{ id: 'i16', time: '09:00', title: '箱根溫泉', place: '箱根湯本', kind: 'stay', done: false }] },
      '2026-10-26': { note: '購物', itinerary: [{ id: 'i17', time: '13:00', title: '銀座購物', place: '銀座', kind: 'shop', done: false }] },
      '2026-10-27': { note: '回程', itinerary: [{ id: 'i18', time: '14:20', title: '飛返香港', place: '羽田機場', kind: 'transport', done: false }] },
    },
    expenses: [
      exp(1, '2026-10-19', '成田特快 N’EX', '交通', 6140, '共同'),
      exp(2, '2026-10-19', 'Lawson 淺草店', '飲食', 1286, 'Oscar', [{ name: '飯糰', price: 180 }, { name: '綠茶', price: 160 }]),
      exp(3, '2026-10-20', '大黑家天婦羅', '飲食', 4400, '共同'),
      exp(4, '2026-10-20', '晴空塔展望台', '娛樂', 6200, '共同'),
      exp(5, '2026-10-21', '江之電一日券', '交通', 1600, '共同'),
      exp(6, '2026-10-21', '鎌倉小町通', '飲食', 2380, '阿晴'),
      exp(7, '2026-10-22', 'Uniqlo 澀谷', '購物', 8990, 'Oscar', [{ name: '輕羽絨外套', price: 5990 }, { name: '圍巾', price: 3000 }]),
      exp(8, '2026-10-22', 'Shibuya Sky', '娛樂', 5000, '共同'),
      exp(9, '2026-10-23', '築地 壽司大', '飲食', 7800, '共同', [{ name: '主廚精選', price: 5200 }, { name: '玉子燒', price: 400 }]),
      exp(10, '2026-10-23', 'Suica 增值', '交通', 3000, 'Oscar'),
      exp(11, '2026-10-23', '唐吉訶德 銀座', '購物', 4620, '阿晴'),
    ],
  };
}

/** Fixed demo "today" so screenshots are stable; ?today=YYYY-MM-DD overrides. */
export const DEMO_TODAY = '2026-10-23';
