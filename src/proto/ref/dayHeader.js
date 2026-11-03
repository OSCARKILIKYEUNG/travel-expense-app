import { fmtHKD, shortenTitle } from './refLogic';

const MONTH_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function isEnLang(lang) {
  return typeof lang === 'string' && lang.trim().toLowerCase().startsWith('en');
}

/**
 * Build localized DayStrip text:
 * - zh: "第5天・富士山一日遊・HKD $1,086"
 * - en: "Day 5・富士山一日遊・HKD $1,086"
 * Omits the day part when `n` is null/falsy.
 */
export function localDayStrip({ n, title, hkd, t, lang } = {}, max = 8) {
  const parts = [];
  if (n != null && n > 0) {
    const translated =
      typeof t === 'function' ? t('notebook.day.dayBadge', { n }) : '';
    const dayPart =
      translated && translated !== 'notebook.day.dayBadge'
        ? translated
        : isEnLang(lang)
          ? `Day ${n}`
          : `第${n}天`;
    parts.push(dayPart);
  }
  if (title) {
    parts.push(shortenTitle(title, max));
  }
  parts.push(fmtHKD(hkd));
  return parts.join('・');
}

/**
 * Build localized top/bottom lines for the round DayView stamp:
 * - In trip (zh): { top: "第5天", bottom: "10月22日" }
 * - In trip (en): { top: "Day 5", bottom: "Oct 22" }
 * - Outside trip (zh): { top: "10/15", bottom: "旅程外" }
 * - Outside trip (en): { top: "10/15", bottom: "Off trip" }
 */
export function dayStampLines({ dayN, m, d, lang, t } = {}) {
  const isEn = isEnLang(lang);
  const monthNum = Number(m) || 1;
  const dayNum = Number(d) || 1;
  const monthEn = MONTH_EN[monthNum - 1] || MONTH_EN[0];

  if (dayN != null && dayN > 0) {
    const translatedTop =
      typeof t === 'function' ? t('notebook.day.dayBadge', { n: dayN }) : '';
    const top =
      translatedTop && translatedTop !== 'notebook.day.dayBadge'
        ? translatedTop
        : isEn
          ? `Day ${dayN}`
          : `第${dayN}天`;

    const translatedBottom =
      typeof t === 'function'
        ? t('notebook.day.stampDate', {
            month: monthNum,
            day: dayNum,
            monthEn,
          })
        : '';
    const bottom =
      translatedBottom && translatedBottom !== 'notebook.day.stampDate'
        ? translatedBottom
        : isEn
          ? `${monthEn} ${dayNum}`
          : `${monthNum}月${dayNum}日`;

    return { top, bottom };
  }

  const top = `${monthNum}/${dayNum}`;
  if (isEn) {
    return { top, bottom: 'Off trip' };
  }
  const translatedOut =
    typeof t === 'function' ? t('notebook.day.outsideTrip') : '';
  const bottom =
    translatedOut && translatedOut !== 'notebook.day.outsideTrip'
      ? translatedOut
      : '旅程外';
  return { top, bottom };
}
