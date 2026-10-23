import { normalizeDate } from './duplicates';

export function formatDateToDisplay(dateStr) {
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}年${parseInt(match[2])}月${parseInt(match[3])}日`;
  }
  return dateStr;
}

export function formatDateToInput(dateStr) {
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Calendar-day key shared by `2025-12-21` and `2025年12月21日`. */
export function expenseDateKey(dateStr) {
  return normalizeDate(dateStr) || String(dateStr ?? '');
}

/** Group header / card label. ISO manual dates display as zh-TW dates. */
export function expenseDateLabel(dateStr) {
  const key = normalizeDate(dateStr);
  if (!key) return dateStr == null ? '' : String(dateStr);
  return formatDateToDisplay(key);
}

export function parseExpenseDate(dateStr) {
  const iso = normalizeDate(dateStr);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (dateStr == null) return new Date(NaN);
  const match = String(dateStr).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) return new Date(match[1], parseInt(match[2], 10) - 1, match[3]);
  return new Date(dateStr);
}

export function expenseTimeMinutes(e) {
  if (!e) return null;
  const raw = e.time || e.receiptTime;
  if (raw == null) return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function expenseRecordedAt(e) {
  if (!e) return -Infinity;
  if (e.createdAt != null && e.createdAt !== '') {
    const parsed = Date.parse(e.createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof e.id === 'number' && Number.isFinite(e.id) && e.id >= 1e12) {
    return e.id;
  }
  if (e.id != null) {
    const m = String(e.id).match(/\d{13}/);
    if (m) return Number(m[0]);
  }
  return -Infinity;
}

/**
 * Sort expenses newest date first. Within the same day: timed before untimed,
 * timed by minutes desc, then expenseRecordedAt desc, then original input index desc.
 */
export function sortExpenses(list) {
  return [...list]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const da = parseExpenseDate(a.item.date).getTime();
      const db = parseExpenseDate(b.item.date).getTime();
      const aNaN = Number.isNaN(da);
      const bNaN = Number.isNaN(db);
      if (aNaN !== bNaN) return db - da;
      if (!aNaN && da !== db) return db - da;

      const ma = expenseTimeMinutes(a.item);
      const mb = expenseTimeMinutes(b.item);
      if (ma !== null && mb !== null) {
        if (ma !== mb) return mb - ma;
      } else if (ma !== null) {
        return -1;
      } else if (mb !== null) {
        return 1;
      }

      const ra = expenseRecordedAt(a.item);
      const rb = expenseRecordedAt(b.item);
      if (ra !== rb) return rb - ra;

      return b.index - a.index;
    })
    .map((entry) => entry.item);
}
