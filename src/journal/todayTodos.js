import { expenseDateKey } from '../utils/date.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const TOKEN_SPLIT_RE = /[\s·・,，、/／()（）-]+/;

function isValidIsoDate(iso) {
  return typeof iso === 'string' && ISO_DATE_RE.test(iso);
}

function parseTimeMinutes(rawTime) {
  if (typeof rawTime !== 'string') return Infinity;
  const m = rawTime.trim().match(TIME_RE);
  if (!m) return Infinity;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return Infinity;
  return hh * 60 + mm;
}

function isWithinTripRange(trip, iso) {
  if (!trip || typeof trip !== 'object' || !isValidIsoDate(iso)) return false;
  const start = isValidIsoDate(trip.startDate) ? trip.startDate : null;
  const end = isValidIsoDate(trip.endDate) ? trip.endDate : null;
  if (start && iso < start) return false;
  if (end && iso > end) return false;
  return true;
}

function stopMatchesExpense(stopTitle, expense) {
  if (!stopTitle || !expense || typeof expense !== 'object') return false;
  const a = String(stopTitle).trim().toLowerCase();
  if (!a) return false;

  const candidates = [expense.store, expense.title, expense.storeOriginal, expense.storeEn]
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim().toLowerCase());

  if (candidates.length === 0) return false;

  const aTokens = a.split(TOKEN_SPLIT_RE).filter((t) => t.length >= 2);

  for (const b of candidates) {
    if (a === b) return true;
    if (b.length >= 2 && a.includes(b)) return true;
    if (a.length >= 2 && b.includes(a)) return true;
    if (aTokens.some((tok) => b.includes(tok))) return true;
  }

  return false;
}

function normalizeItineraryStops(itinerary, dayIso = 'day') {
  if (!Array.isArray(itinerary) || itinerary.length === 0) return [];

  const indexed = [];
  itinerary.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const rawTitle =
      typeof raw.title === 'string'
        ? raw.title.trim()
        : typeof raw.name === 'string'
          ? raw.name.trim()
          : '';
    const rawPlace =
      typeof raw.place === 'string'
        ? raw.place.trim()
        : typeof raw.location === 'string'
          ? raw.location.trim()
          : '';
    const title = rawTitle || rawPlace;
    if (!title) return;

    const id =
      raw.id != null && String(raw.id).trim() !== ''
        ? String(raw.id).trim()
        : `todo-${dayIso}-${index}`;
    const time = typeof raw.time === 'string' ? raw.time.trim() : '';
    const minutes = parseTimeMinutes(time);

    indexed.push({
      id,
      time,
      title,
      place: rawPlace || undefined,
      minutes,
      index,
    });
  });

  indexed.sort((a, b) => {
    if (a.minutes !== b.minutes) return a.minutes - b.minutes;
    return a.index - b.index;
  });

  return indexed;
}

/**
 * Derives today's checklist items from `trip.days[todayIso].itinerary`, sorted stably by time.
 * Returns `[]` if `todayIso` is outside the trip or the day has no valid itinerary stops.
 *
 * @param {Record<string, any> | null | undefined} trip
 * @param {string} todayIso
 * @returns {Array<{ id: string, time: string, title: string, place?: string, spentHkd?: number }>}
 */
export function deriveTodayTodos(trip, todayIso) {
  if (!isWithinTripRange(trip, todayIso)) return [];
  const days = trip.days && typeof trip.days === 'object' ? trip.days : null;
  const day = days ? days[todayIso] : null;
  if (!day || typeof day !== 'object' || !Array.isArray(day.itinerary)) return [];

  const sortedStops = normalizeItineraryStops(day.itinerary, todayIso);
  if (sortedStops.length === 0) return [];

  const dayExpenses = Array.isArray(trip.expenses)
    ? trip.expenses.filter(
        (e) => e && typeof e === 'object' && e.date && expenseDateKey(e.date) === todayIso,
      )
    : [];

  return sortedStops.map((stop) => {
    const item = {
      id: stop.id,
      time: stop.time,
      title: stop.title,
    };
    if (stop.place) {
      item.place = stop.place;
    }

    if (dayExpenses.length > 0) {
      const matchedSum = dayExpenses
        .filter((e) => stopMatchesExpense(stop.title, e))
        .reduce((sum, e) => sum + (Number(e.hkdAmount) || 0), 0);
      if (matchedSum > 0) {
        item.spentHkd = Math.round(matchedSum);
      }
    }

    return item;
  });
}

/**
 * Returns a preview of up to `n` following trip days (`iso > todayIso`) that contain data.
 *
 * @param {Record<string, any> | null | undefined} trip
 * @param {string} todayIso
 * @param {number} [n=3]
 * @returns {Array<{ iso: string, weekdayIndex: number, title: string, stops: string[] }>}
 */
export function nextDaysPreview(trip, todayIso, n = 3) {
  const limit = Number(n);
  if (
    !trip ||
    typeof trip !== 'object' ||
    !trip.days ||
    typeof trip.days !== 'object' ||
    !isValidIsoDate(todayIso) ||
    !Number.isFinite(limit) ||
    limit <= 0
  ) {
    return [];
  }

  const candidateIsos = Object.keys(trip.days)
    .filter((iso) => isValidIsoDate(iso) && iso > todayIso && isWithinTripRange(trip, iso))
    .sort((a, b) => a.localeCompare(b));

  const results = [];
  for (const iso of candidateIsos) {
    if (results.length >= limit) break;
    const day = trip.days[iso];
    if (!day || typeof day !== 'object') continue;

    const title = typeof day.title === 'string' ? day.title.trim() : '';
    const note = typeof day.note === 'string' ? day.note.trim() : '';
    const sortedStops = normalizeItineraryStops(day.itinerary, iso);

    const stopLabels = [];
    for (const s of sortedStops) {
      const label = s.place || s.title;
      if (label && stopLabels[stopLabels.length - 1] !== label) {
        stopLabels.push(label);
      }
    }

    if (stopLabels.length === 0 && !title && !note) {
      continue;
    }

    const effectiveStops =
      stopLabels.length > 0 ? stopLabels : [note || title].filter(Boolean);

    const [y, m, d] = iso.split('-').map(Number);
    const weekdayIndex = new Date(y, m - 1, d).getDay();

    results.push({
      iso,
      weekdayIndex,
      title: title || note || effectiveStops[0] || '',
      stops: effectiveStops,
    });
  }

  return results;
}
