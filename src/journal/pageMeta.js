import { dayCounter } from '../proto/shared/display.js';

export const PAGE_TABS = ['home', 'ledger', 'charts', 'settings'];

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ZH_WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * 1-based page number in nav order: home (1), ledger (2), charts (3), settings (4), fallback 1.
 */
export function pageNumberForTab(tab) {
  const idx = PAGE_TABS.indexOf(tab);
  return idx >= 0 ? idx + 1 : 1;
}

function isEnglishLang(lang, t) {
  if (typeof lang === 'string' && lang.trim().length > 0) {
    return lang.trim().toLowerCase().startsWith('en');
  }
  if (typeof t === 'function') {
    const sample = t('notebook.page.dateLine', { date: 'D', weekday: 'W', day: 1 });
    if (typeof sample === 'string' && sample.includes('Day')) {
      return true;
    }
  }
  return false;
}

function isValidIsoDate(iso) {
  if (!iso || typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Resolves the ISO date for the notebook page header:
 * returns `day` when `screen === 'day'` and `day` is a valid YYYY-MM-DD; otherwise returns `today`.
 */
export function pageDateIso({ screen, day, today } = {}) {
  if (screen === 'day' && isValidIsoDate(day)) {
    return day;
  }
  return today;
}

/**
 * Formats the notebook page header date line, e.g.
 * - zh-TW inside trip: "2026年10月22日 星期四 · 第5天"
 * - zh-TW outside trip: "2026年10月15日 星期四"
 * - en inside trip: "Oct 22, 2026 Thu · Day 5"
 * - en outside trip: "Oct 15, 2026 Thu"
 */
export function formatPageDateLine(t, todayIso, trip, lang) {
  if (!isValidIsoDate(todayIso)) {
    return '';
  }

  const [y, m, d] = todayIso.split('-').map(Number);
  const wIdx = new Date(y, m - 1, d).getDay();
  const wKey = WEEKDAY_KEYS[wIdx];
  const isEn = isEnglishLang(lang, t);
  const resolvedLng = isEn ? 'en' : 'zh-TW';

  const date = isEn ? `${MONTH_EN[m - 1]} ${d}, ${y}` : `${y}年${m}月${d}日`;

  let weekday = isEn ? EN_WEEKDAYS[wIdx] : ZH_WEEKDAYS[wIdx];
  if (typeof t === 'function') {
    const translatedWeekday = t(`notebook.page.weekdays.${wKey}`, { lng: resolvedLng });
    if (
      typeof translatedWeekday === 'string' &&
      translatedWeekday.length > 0 &&
      !translatedWeekday.startsWith('notebook.')
    ) {
      weekday = translatedWeekday;
    }
  }

  const hasValidTripRange =
    Boolean(trip) &&
    typeof trip.startDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(trip.startDate) &&
    typeof trip.endDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(trip.endDate);

  const counter = hasValidTripRange ? dayCounter(trip, todayIso) : null;
  const inTrip = Boolean(counter && counter.phase === 'during');

  if (inTrip) {
    const day = counter.n;
    if (typeof t === 'function') {
      const line = t('notebook.page.dateLine', { date, weekday, day, lng: resolvedLng });
      if (typeof line === 'string' && line.length > 0 && !line.startsWith('notebook.')) {
        return line;
      }
    }
    return isEn ? `${date} ${weekday} · Day ${day}` : `${date} ${weekday} · 第${day}天`;
  }

  if (typeof t === 'function') {
    const lineNoDay = t('notebook.page.dateLineNoDay', { date, weekday, lng: resolvedLng });
    if (typeof lineNoDay === 'string' && lineNoDay.length > 0 && !lineNoDay.startsWith('notebook.')) {
      return lineNoDay;
    }
  }
  return `${date} ${weekday}`;
}
