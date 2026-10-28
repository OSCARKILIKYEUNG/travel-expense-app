import { addDays, localISODate } from '../shared/dates';
import { normalizeDate } from '../../utils/duplicates';
import { REF_CATEGORIES } from './mockRefTrip';
import {
  buildAddHash,
  fmtHKD,
  fmtJPY,
  groupLedger,
  matchesPerson,
  parseRoute,
  zhDate,
} from './refLogic';

/** Check whether a string is a real calendar YYYY-MM-DD date. */
export function isValidISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * P0-1: Parse raw HH:MM input into zero-padded 'HH:MM' (00:00..23:59).
 * Rejects corrupted strings like '09:15:0030', '25:00', '12:60', '', 'abc' -> null.
 */
export function parseHHMM(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Format local Date as zero-padded 'HH:MM' for new expense default time. */
export function defaultTime(now = new Date()) {
  if (typeof now === 'string' && parseHHMM(now)) return parseHHMM(now);
  const dt = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

/** First person in `people` other than '共同', else ''. */
export function defaultPayer(people) {
  if (!Array.isArray(people)) return '';
  const found = people.find((p) => p && String(p).trim() && String(p).trim() !== '共同');
  return found ? String(found).trim() : '';
}

/** Default payment method: trip.lastPayment ('cash'|'card'), else last valid expense payment, else 'cash'. */
export function defaultPayment(trip) {
  if (trip?.lastPayment === 'cash' || trip?.lastPayment === 'card') {
    return trip.lastPayment;
  }
  const list = Array.isArray(trip?.expenses) ? trip.expenses : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i]?.payment;
    if (p === 'cash' || p === 'card') return p;
  }
  return 'cash';
}

/** Set or clear trip budget (positive integer HKD or null). Pure. */
export function setBudget(trip, raw) {
  if (!trip) return trip;
  let budget = null;
  if (raw != null && typeof raw !== 'boolean') {
    const cleaned = String(raw).replace(/[,\s]/g, '');
    if (cleaned !== '') {
      const num = Number(cleaned);
      if (Number.isFinite(num)) {
        const rounded = Math.round(num);
        if (rounded > 0) budget = rounded;
      }
    }
  }
  return {
    ...trip,
    settings: {
      ...trip.settings,
      budget,
    },
  };
}

/**
 * Validate and update a trip's `startDate` and `endDate` (ISO `YYYY-MM-DD`).
 * - Accepts `(trip, startRaw, endRaw)` or `(trip, { startDate, endDate })`.
 * - `startDate` is required and must be a valid calendar ISO `YYYY-MM-DD`.
 * - `endDate` may be a valid calendar ISO `YYYY-MM-DD` with `startDate <= endDate`,
 *   or empty/`null` to clear `endDate` to `null` (so adapter derives display span).
 * - Pure: never mutates `trip`.
 *
 * @param {Record<string, any> | null | undefined} trip
 * @param {unknown} startOrObj
 * @param {unknown} [maybeEnd]
 * @returns {{ ok: true, startDate: string, endDate: string | null, trip: Record<string, any> } | { ok: false, errorKey: string }}
 */
export function setTripDates(trip, startOrObj, maybeEnd) {
  let rawStart = startOrObj;
  let rawEnd = maybeEnd;
  if (startOrObj && typeof startOrObj === 'object' && !Array.isArray(startOrObj)) {
    rawStart = startOrObj.startDate !== undefined ? startOrObj.startDate : startOrObj.start;
    rawEnd = startOrObj.endDate !== undefined ? startOrObj.endDate : startOrObj.end;
  }

  if (typeof rawStart === 'boolean' || typeof rawStart === 'number') {
    return { ok: false, errorKey: 'notebook.settings.datesInvalid' };
  }
  if (typeof rawEnd === 'boolean' || typeof rawEnd === 'number') {
    return { ok: false, errorKey: 'notebook.settings.datesInvalid' };
  }

  const startStr = rawStart == null ? '' : String(rawStart).trim();
  const endStr = rawEnd == null ? '' : String(rawEnd).trim();

  if (!startStr || !isValidISODate(startStr)) {
    return { ok: false, errorKey: 'notebook.settings.datesInvalid' };
  }

  if (endStr !== '' && !isValidISODate(endStr)) {
    return { ok: false, errorKey: 'notebook.settings.datesInvalid' };
  }

  if (endStr !== '' && startStr > endStr) {
    return { ok: false, errorKey: 'notebook.settings.datesOrderError' };
  }

  const nextEnd = endStr === '' ? null : endStr;
  const baseTrip = trip && typeof trip === 'object' ? trip : {};
  const nextTrip = {
    ...baseTrip,
    startDate: startStr,
    endDate: nextEnd,
  };

  return {
    ok: true,
    startDate: startStr,
    endDate: nextEnd,
    trip: nextTrip,
  };
}

/**
 * P0-1: Check whether a time input entry is invalid.
 * - empty + not badInput -> false (valid untimed stop)
 * - empty + badInput -> true (partial native time input, e.g. only hour typed)
 * - non-empty -> must be strict 2-digit HH:MM and valid in parseHHMM ('09:30' valid; '9:5', '25:00' invalid)
 */
export function isTimeEntryInvalid({ value = '', badInput = false } = {}) {
  if (badInput) return true;
  const s = String(value ?? '').trim();
  if (!s) return false;
  if (!/^\d{2}:\d{2}$/.test(s)) return true;
  return parseHHMM(s) === null;
}

/**
 * P0-1: Convert 'HH:MM' to minutes from midnight; untimed/invalid -> Infinity so they sort last.
 */
export function stopMinutes(time) {
  const parsed = parseHHMM(time);
  if (!parsed) return Infinity;
  const [hh, mm] = parsed.split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * P0-1: Stable sort stops by stopMinutes; untimed stops stay at the end in insertion order.
 */
export function sortStops(stops) {
  if (!Array.isArray(stops)) return [];
  return stops
    .map((item, idx) => ({ item, idx, mins: stopMinutes(item?.time) }))
    .sort((a, b) => (a.mins === b.mins ? a.idx - b.idx : a.mins - b.mins))
    .map((x) => x.item);
}

/**
 * P1-1: Resolve 'today' from URL search query (?today=YYYY-MM-DD when valid ISO),
 * falling back to device-local YYYY-MM-DD from `now`.
 */
export function resolveToday(search, now = new Date()) {
  const raw = String(search || '');
  const qIndex = raw.indexOf('?');
  const qs = qIndex >= 0 ? raw.slice(qIndex + 1) : raw;
  const params = new URLSearchParams(qs);
  const override = params.get('today');
  if (override && isValidISODate(override)) return override;
  if (typeof now === 'string' && isValidISODate(now)) return now;
  const dt = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return localISODate(dt);
}

/**
 * P1-1: Default date for new expenses opened without an explicit day (e.g. from Ledger or Home).
 *
 * Proposed rule when `today` is outside `[trip.startDate, trip.endDate]`:
 * Clamp `today` to the trip's nearest boundary date:
 * - Before trip (`today < trip.startDate`) -> `trip.startDate` (Day 1, where pre-trip bookings & Day 1 items belong)
 * - During trip (`trip.startDate <= today <= trip.endDate`) -> `today`
 * - After trip (`today > trip.endDate`) -> `trip.endDate` (Final day, where post-trip catch-up receipts land)
 *
 * Why: Prevents 記一筆 / 掃描收據 from silently creating undated ('未有日期') or out-of-trip ('旅程外')
 * orphan records when planning ahead, catching up after a trip, or switching to a future/past trip.
 * The date field remains editable and can still be explicitly cleared to '未有日期'.
 */
export function defaultExpenseDate(trip, today) {
  const start = trip?.startDate;
  const end = trip?.endDate;
  const validStart = isValidISODate(start) ? start : null;
  const validEnd = isValidISODate(end) ? end : null;
  const validToday = isValidISODate(today) ? today : null;

  if (!validStart || !validEnd) return validToday || validStart || validEnd || null;
  if (!validToday) return validStart;
  if (validToday < validStart) return validStart;
  if (validToday > validEnd) return validEnd;
  return validToday;
}

/**
 * P1-4: The single post-save routing rule.
 * - Launched from ledger -> 'ledger'
 * - Otherwise -> savedDate ? `day=${savedDate}&pane=expenses` : 'ledger'
 */
export function postSaveTarget({ origin, savedDate } = {}) {
  if (origin === 'ledger') return 'ledger';
  const iso = savedDate ? normalizeDate(savedDate) : null;
  return iso ? `day=${iso}&pane=expenses` : 'ledger';
}

export const TOAST_DURATION_MS = 6000;
export const ERROR_TOAST_DURATION_MS = 8000;

export function toastDurationMs(toast) {
  const tone = typeof toast === 'string' ? toast : toast?.tone;
  return tone === 'error' ? ERROR_TOAST_DURATION_MS : TOAST_DURATION_MS;
}

function resolveScreenName(s) {
  if (!s) return 'home';
  if (typeof s === 'object') return s.screen ? String(s.screen) : 'home';
  const raw = String(s).trim();
  if (['home', 'day', 'add', 'ledger', 'charts', 'settings'].includes(raw)) return raw;
  return parseRoute(raw).screen;
}

/**
 * Dismiss any visible toast when entering the add/edit form screen ('add') so it never
 * sits over the sticky save bar; keep toasts on other transitions (e.g. add -> day/ledger after save).
 */
export function shouldKeepToastOnRoute(prevScreen, nextScreen) {
  if (
    prevScreen &&
    typeof prevScreen === 'object' &&
    nextScreen === undefined &&
    ('prevScreen' in prevScreen || 'nextScreen' in prevScreen)
  ) {
    return shouldKeepToastOnRoute(prevScreen.prevScreen, prevScreen.nextScreen);
  }
  const next = resolveScreenName(nextScreen);
  return next !== 'add';
}

/**
 * P1-3: Toast copy after add / edit / delete.
 * e.g. '已記錄 HKD $88 · 10月22日' / '已更新 …' / '已刪除 …' (undated -> '未有日期').
 */
export function saveToastMessage({ kind, expense } = {}) {
  const verb = kind === 'edit' ? '已更新' : kind === 'delete' ? '已刪除' : '已記錄';
  const amountText = fmtHKD(expense?.hkdAmount ?? 0);
  const iso = expense?.date ? normalizeDate(expense.date) : null;
  let dateText = '未有日期';
  if (iso && isValidISODate(iso)) {
    const [, m, d] = iso.split('-').map(Number);
    dateText = `${m}月${d}日`;
  }
  return `${verb} ${amountText} · ${dateText}`;
}

/**
 * P1-3: Create an inverse-op undo descriptor for 'add' | 'delete' | 'edit'.
 */
export function makeUndo(kindOrObj, payload = {}) {
  const isObjCall = typeof kindOrObj === 'object' && kindOrObj !== null;
  const kind = isObjCall ? kindOrObj.kind : kindOrObj;
  const opts = isObjCall ? kindOrObj : payload || {};
  const isDirectRecord =
    opts && typeof opts === 'object' && !('expense' in opts) && !('previous' in opts) && 'id' in opts;
  const expense = isDirectRecord ? opts : opts.expense ?? null;
  const previous = opts.previous ?? opts.before ?? (kind === 'edit' && isDirectRecord ? opts : null);
  const index = typeof opts.index === 'number' && Number.isFinite(opts.index) ? Math.trunc(opts.index) : null;
  const id = opts.id ?? expense?.id ?? previous?.id ?? null;
  return {
    kind,
    id,
    expense: expense ? { ...expense } : null,
    previous: previous ? { ...previous } : null,
    index,
  };
}

/**
 * P1-3: Apply an inverse-op undo descriptor to the current `expenses` array without clobbering
 * concurrent changes (other added expenses, renamed people, or updated exchange rates).
 * - 'add' -> remove the expense with that id
 * - 'delete' -> reinsert the deleted record at its original index (clamped to [0, expenses.length])
 * - 'edit' -> replace the record with that id by `previous`
 */
export function applyUndo(expenses, undo) {
  if (!Array.isArray(expenses)) return [];
  if (!undo || typeof undo !== 'object') return [...expenses];

  const sameId = (a, b) => a != null && b != null && String(a) === String(b);

  if (undo.kind === 'add') {
    const targetId = undo.id ?? undo.expense?.id;
    if (!targetId) return [...expenses];
    return expenses.filter((e) => !sameId(e?.id, targetId));
  }

  if (undo.kind === 'delete') {
    const record = undo.expense ?? undo.previous;
    if (!record) return [...expenses];
    const base = record.id ? expenses.filter((e) => !sameId(e?.id, record.id)) : [...expenses];
    const rawIdx = typeof undo.index === 'number' && Number.isFinite(undo.index) ? Math.trunc(undo.index) : base.length;
    const clamped = Math.max(0, Math.min(base.length, rawIdx));
    return [...base.slice(0, clamped), { ...record }, ...base.slice(clamped)];
  }

  if (undo.kind === 'edit') {
    const prev = undo.previous ?? undo.expense;
    const targetId = undo.id ?? prev?.id ?? undo.expense?.id;
    if (!targetId || !prev) return [...expenses];
    return expenses.map((e) => (sameId(e?.id, targetId) ? { ...prev } : e));
  }

  return [...expenses];
}

/**
 * P1-2/P1-4: Return a one-line zh-HK hint when AddForm save is disabled, or null when valid.
 */
export function saveBlockReason({ amount, store } = {}) {
  const rawAmt = typeof amount === 'boolean' ? '' : String(amount ?? '').trim();
  const numAmt = Number(rawAmt);
  const hasAmount = rawAmt !== '' && Number.isFinite(numAmt) && numAmt > 0;
  const hasStore = Boolean(String(store ?? '').trim());

  if (!hasAmount && !hasStore) return '請填寫金額及店舗';
  if (!hasAmount) return '請填寫金額';
  if (!hasStore) return '請填寫店舗';
  return null;
}

/**
 * P1-6: Count active non-'全部' filters in the filter sheet (category, date, payment, payer).
 */
export function activeFilterCount({
  category = '全部',
  date = '全部',
  payment = '全部',
  payer = '全部',
} = {}) {
  let count = 0;
  if (category && category !== '全部') count += 1;
  if (date && date !== '全部') count += 1;
  if (payment && payment !== '全部') count += 1;
  if (payer && payer !== '全部') count += 1;
  return count;
}

/**
 * P1-7: Compute target hash route when switching active trip.
 * - Day route outside new trip range -> '' (home)
 * - Add/edit route for an unknown expense id or out-of-range date -> '' (home)
 * - Otherwise keep the current route hash.
 */
export function switchTripRoute(route, trip) {
  if (!trip) return '';
  const isString = typeof route === 'string';
  const rawHash = isString ? route.replace(/^#/, '') : '';
  const parsed = isString ? parseRoute(rawHash) : route || { screen: 'home' };

  if (parsed.screen === 'day') {
    const iso = parsed.day;
    if (!iso || iso < trip.startDate || iso > trip.endDate) return '';
    if (isString && rawHash) return rawHash;
    const pane = parsed.pane === 'expenses' ? 'expenses' : 'itinerary';
    return `day=${iso}&pane=${pane}${parsed.edit && pane === 'itinerary' ? '&edit=1' : ''}`;
  }

  if (parsed.screen === 'add') {
    if (parsed.expenseId) {
      const exists = (trip.expenses || []).some((e) => e.id === parsed.expenseId);
      if (!exists) return '';
    }
    if (parsed.date && (parsed.date < trip.startDate || parsed.date > trip.endDate)) {
      return '';
    }
    return isString && rawHash ? rawHash : buildAddHash({ date: parsed.date, scan: parsed.scan, id: parsed.expenseId });
  }

  if (['ledger', 'charts', 'settings'].includes(parsed.screen)) {
    return isString && rawHash ? rawHash : parsed.screen;
  }

  return '';
}

/**
 * P1-7: Calendar month (YYYY-MM) to show for a trip: today's month if today is inside the trip,
 * otherwise the trip's start month.
 */
export function tripMonth(trip, today) {
  if (!trip?.startDate) return today ? String(today).slice(0, 7) : '';
  if (today && today >= trip.startDate && today <= trip.endDate) {
    return String(today).slice(0, 7);
  }
  return trip.startDate.slice(0, 7);
}

/**
 * P1-8: Single-trip JSON export payload.
 */
export function exportTripJSON(trip) {
  return {
    filename: `trip-${trip?.id || 'export'}.json`,
    text: JSON.stringify(trip, null, 2),
  };
}

/**
 * P1-8: Multi-trip full backup JSON payload.
 */
export function exportBackupJSON(trips, now = new Date()) {
  let dateStr;
  let exportedAt;
  if (typeof now === 'string' && isValidISODate(now.slice(0, 10))) {
    dateStr = now.slice(0, 10);
    exportedAt = now;
  } else {
    const dt = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
    dateStr = localISODate(dt);
    exportedAt = dt.toISOString();
  }
  return {
    filename: `travel-backup-${dateStr}.json`,
    text: JSON.stringify(
      {
        version: 1,
        exportedAt,
        trips: Array.isArray(trips) ? trips : [],
      },
      null,
      2,
    ),
  };
}

/**
 * P1-8: Build a plain-text zh-HK summary report with trip name, dates, total HKD,
 * per-person breakdown, per-category breakdown, and per-day breakdown.
 */
export function buildReport(trip) {
  if (!trip) return '';
  const expenses = trip.expenses || [];
  const people = trip.settings?.people || ['共同'];
  const totalHKD = expenses.reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
  const totalJPY = expenses
    .filter((e) => (e.currency || e.originalCurrency) === 'JPY')
    .reduce((s, e) => s + Number(e.originalAmount || 0), 0);

  const lines = [
    `【${trip.name}】花費報告`,
    `日期：${trip.startDate} – ${trip.endDate}`,
    `總花費：${fmtHKD(totalHKD)}（共 ${expenses.length} 筆，原幣 ${fmtJPY(totalJPY)}）`,
    '',
    '【人物花費】',
  ];

  for (const p of people) {
    const items = expenses.filter((e) => matchesPerson(e, p, people));
    const sum = items.reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
    lines.push(`- ${p}：${fmtHKD(sum)}（${items.length} 筆）`);
  }

  lines.push('', '【類別分佈】');
  for (const cat of REF_CATEGORIES) {
    const items = expenses.filter((e) => (e.category || '其他') === cat);
    if (items.length > 0) {
      const sum = items.reduce((s, e) => s + Number(e.hkdAmount || 0), 0);
      lines.push(`- ${cat}：${fmtHKD(sum)}（${items.length} 筆）`);
    }
  }

  lines.push('', '【每日花費】');
  const groups = groupLedger(expenses);
  for (const g of groups) {
    const label = g.iso ? zhDate(g.iso) : '未有日期';
    lines.push(`- ${label}：${fmtHKD(g.total)}（${g.items.length} 筆）`);
  }

  return lines.join('\n');
}

/**
 * P1-8: Rename a person in `trip.settings.people` and update matching `expense.assignedTo`, `expense.payer` (and line items).
 * Rejects blank, unchanged, '共同', or duplicate names by returning `trip` unchanged.
 */
export function renamePerson(trip, from, to) {
  if (!trip) return trip;
  const cleanFrom = String(from ?? '').trim();
  const cleanTo = String(to ?? '').trim();
  const people = trip.settings?.people || [];
  if (!cleanFrom || !cleanTo || cleanFrom === '共同') return trip;
  if (!people.includes(cleanFrom)) return trip;
  if (cleanFrom === cleanTo || people.includes(cleanTo)) return trip;

  return {
    ...trip,
    settings: {
      ...trip.settings,
      people: people.map((p) => (p === cleanFrom ? cleanTo : p)),
    },
    expenses: (trip.expenses || []).map((e) => ({
      ...e,
      assignedTo: e.assignedTo === cleanFrom ? cleanTo : e.assignedTo,
      ...(e.payer !== undefined ? { payer: e.payer === cleanFrom ? cleanTo : e.payer } : {}),
      items: Array.isArray(e.items)
        ? e.items.map((it) => (it?.assignedTo === cleanFrom ? { ...it, assignedTo: cleanTo } : it))
        : e.items,
    })),
  };
}

/**
 * P1-8: Add a new person to `trip.settings.people`.
 * Rejects blank or duplicate names by returning `trip` unchanged.
 */
export function addPerson(trip, name) {
  if (!trip) return trip;
  const clean = String(name ?? '').trim();
  const people = trip.settings?.people || [];
  if (!clean || people.includes(clean)) return trip;
  return {
    ...trip,
    settings: {
      ...trip.settings,
      people: [...people, clean],
    },
  };
}

/**
 * P1-8: Remove a person from `trip.settings.people`.
 * '共同' cannot be removed; expenses of the removed person are reassigned to '共同';
 * expenses whose `payer` is removed get `payer` = first remaining non-共同 person (or '').
 */
export function removePerson(trip, name) {
  if (!trip) return trip;
  const target = String(name ?? '').trim();
  const people = trip.settings?.people || [];
  if (!target || target === '共同' || !people.includes(target)) return trip;

  const remainingPeople = people.filter((p) => p !== target);
  const fallbackPayer = defaultPayer(remainingPeople);

  return {
    ...trip,
    settings: {
      ...trip.settings,
      people: remainingPeople,
    },
    expenses: (trip.expenses || []).map((e) => ({
      ...e,
      assignedTo: e.assignedTo === target ? '共同' : e.assignedTo,
      ...(e.payer === target ? { payer: fallbackPayer } : {}),
      items: Array.isArray(e.items)
        ? e.items.map((it) => (it?.assignedTo === target ? { ...it, assignedTo: '共同' } : it))
        : e.items,
    })),
  };
}

/**
 * P1-8: Parse a rate string/number into a finite number > 0, or null if invalid.
 */
export function parseRate(str) {
  if (str == null || typeof str === 'boolean') return null;
  const s = String(str).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Count the number of trip-currency (JPY) expenses whose HKD amount is recomputed on a rate change.
 */
export function countRecomputed(trip) {
  if (!trip || !Array.isArray(trip.expenses)) return 0;
  const tripCurr = trip.tripCurrency || 'JPY';
  return trip.expenses.filter((e) => (e?.currency || e?.originalCurrency || 'JPY') === tripCurr).length;
}

/**
 * P1-8: Update `trip.settings.rate` (must be finite and > 0) and recompute `hkdAmount`
 * for all JPY expenses (`Math.round(originalAmount * rate)`) so totals stay consistent
 * across Home, Ledger, Charts, and Settings. HKD expenses keep their original HKD amount.
 */
export function setRate(trip, rate) {
  if (!trip) return trip;
  const r = parseRate(rate);
  if (r === null) return trip;

  const tripCurr = trip.tripCurrency || 'JPY';
  let recomputed = 0;
  const nextTrip = {
    ...trip,
    settings: {
      ...trip.settings,
      rate: r,
    },
    expenses: (trip.expenses || []).map((e) => {
      const curr = e.currency || e.originalCurrency || 'JPY';
      if (curr === tripCurr) {
        recomputed += 1;
        return {
          ...e,
          hkdAmount: Math.round(Number(e.originalAmount || 0) * r),
        };
      }
      return e;
    }),
  };
  Object.defineProperty(nextTrip, 'recomputedCount', {
    value: recomputed,
    enumerable: false,
    configurable: true,
  });
  return nextTrip;
}

/**
 * P1-9: Bounded day navigation for DayView.
 * - Inside `[startDate, endDate]`: `prev` is null on `startDate`, `next` is null on `endDate`.
 * - Outside the trip: only the direction pointing back toward the nearest in-trip boundary is active
 *   (`iso < startDate` -> `{ prev: null, next: startDate, inTrip: false }`;
 *    `iso > endDate` -> `{ prev: endDate, next: null, inTrip: false }`).
 */
export function dayNav(trip, iso) {
  if (!trip?.startDate || !trip?.endDate || !isValidISODate(iso)) {
    return { prev: null, next: null, inTrip: false };
  }
  if (iso < trip.startDate) {
    return { prev: null, next: trip.startDate, inTrip: false };
  }
  if (iso > trip.endDate) {
    return { prev: trip.endDate, next: null, inTrip: false };
  }
  return {
    prev: iso === trip.startDate ? null : addDays(iso, -1),
    next: iso === trip.endDate ? null : addDays(iso, 1),
    inTrip: true,
  };
}

/** List all ISO dates in `[trip.startDate, trip.endDate]` inclusive. */
export function tripDates(trip) {
  if (!trip?.startDate || !trip?.endDate || !isValidISODate(trip.startDate) || !isValidISODate(trip.endDate)) {
    return [];
  }
  const out = [];
  let cur = trip.startDate;
  let guard = 0;
  while (cur <= trip.endDate && guard < 120) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}
