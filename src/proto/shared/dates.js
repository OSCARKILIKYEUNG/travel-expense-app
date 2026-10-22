/** Device-local calendar helpers for the prototypes (never UTC slicing). */
export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + n);
  return localISODate(dt);
}

/** 1-based trip day for isoDate, or null when outside the trip. */
export function tripDayIndex(trip, isoDate) {
  if (!trip?.startDate || !isoDate) return null;
  const ms = parseISODate(isoDate) - parseISODate(trip.startDate);
  const idx = Math.round(ms / 86400000) + 1;
  if (idx < 1) return null;
  if (trip.endDate && isoDate > trip.endDate) return null;
  return idx;
}

/** Weeks (Mon-first) covering the month of isoDate; each cell is an ISO date or null. */
export function monthGrid(isoDate) {
  const first = parseISODate(isoDate);
  first.setDate(1);
  const year = first.getFullYear();
  const month = first.getMonth();
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(localISODate(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
