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

export function parseExpenseDate(dateStr) {
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) return new Date(match[1], parseInt(match[2]) - 1, match[3]);
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
