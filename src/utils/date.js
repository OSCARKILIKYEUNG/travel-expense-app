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

export function sortExpenses(list) {
  return [...list].sort((a, b) => {
    const da = parseExpenseDate(a.date);
    const db = parseExpenseDate(b.date);
    if (da.getTime() !== db.getTime()) return db.getTime() - da.getTime();
    return a.hkdAmount - b.hkdAmount;
  });
}
