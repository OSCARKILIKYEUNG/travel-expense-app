/**
 * Display rules (confirmed by Oscar 2026-10-23 00:51 HKT).
 * Calendar cell note: max 4 CJK chars or ~6 Latin letters, single line, hard cut (no wrap).
 * Width units: CJK/full-width = 3, everything else = 2; budget = 12 units.
 */
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;

export const CELL_NOTE_BUDGET = 12;

export function capCellNote(note, budget = CELL_NOTE_BUDGET) {
  const chars = Array.from(String(note || '').trim());
  let used = 0;
  let out = '';
  for (const ch of chars) {
    const w = WIDE.test(ch) ? 3 : 2;
    if (used + w > budget) break;
    used += w;
    out += ch;
  }
  return out;
}

function dayDiff(fromIso, toIso) {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}

export const DAY_COUNTER_KEYS = {
  before: 'notebook.home.counterBefore',
  during: 'notebook.home.counterDuring',
  after: 'notebook.home.counterAfter',
};

function resolveCounterOptions(optionsOrT) {
  if (typeof optionsOrT === 'function') return { t: optionsOrT, lang: undefined };
  if (typeof optionsOrT === 'string') return { t: undefined, lang: optionsOrT };
  if (optionsOrT && typeof optionsOrT === 'object') return optionsOrT;
  return {};
}

export function dayCounterLabel(counter, optionsOrT) {
  const { phase, n, total } = counter;
  const labelKey = DAY_COUNTER_KEYS[phase] || DAY_COUNTER_KEYS.during;
  const { t, lang } = resolveCounterOptions(optionsOrT);
  if (typeof t === 'function') {
    return t(labelKey, { n, total });
  }
  const isEn = typeof lang === 'string' && lang.toLowerCase().startsWith('en');
  if (isEn) {
    if (phase === 'before') return `${n} days to go`;
    if (phase === 'after') return `Trip complete · ${total} days`;
    return `Day ${n} / ${total} days`;
  }
  if (phase === 'before') return `倒數 ${n} 日`;
  if (phase === 'after') return `旅程完成，共 ${total} 日`;
  return `第 ${n} 日／共 ${total} 日`;
}

/**
 * Day counter:
 * - zh-TW: before → 倒數 N 日; during → 第 N 日／共 M 日; after → 旅程完成，共 M 日
 * - en: before → N days to go; during → Day N / M days; after → Trip complete · M days
 */
export function dayCounter(trip, todayIso, optionsOrT) {
  const total = dayDiff(trip.startDate, trip.endDate) + 1;
  let phase = 'during';
  let n;
  if (todayIso < trip.startDate) {
    phase = 'before';
    n = dayDiff(todayIso, trip.startDate);
  } else if (todayIso > trip.endDate) {
    phase = 'after';
    n = total;
  } else {
    n = dayDiff(trip.startDate, todayIso) + 1;
  }
  const labelKey = DAY_COUNTER_KEYS[phase];
  const label = dayCounterLabel({ phase, n, total }, optionsOrT);
  return { phase, n, total, labelKey, label };
}

/** Sum HKD for one date (today's spend line under the whole-trip total). */
export function spendOnDate(expenses, iso) {
  return (expenses || [])
    .filter((e) => e.date === iso)
    .reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
}
