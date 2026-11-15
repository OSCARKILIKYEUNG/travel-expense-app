import * as XLSX from 'xlsx';
import { isValidISODate, parseHHMM } from '../proto/ref/refRules';
import { mergeDayPatch } from './tripRate';

/**
 * Calendar import (Excel / CSV) → itinerary days.
 * Pure parsers and merge. Persistence stays in the notebook settings callback.
 *
 * Excel dates use the 1900 date system, including the fake 1900-02-29 (serial 60),
 * and are converted in UTC so the calendar day does not shift with the timezone.
 */

const HEADER_FIELDS = [
  ['date', ['日期', 'date']],
  ['time', ['時間', 'time']],
  ['title', ['行程', 'title', '活動']],
  ['dayTitle', ['當日標題', 'day title', 'daytitle']],
  ['note', ['短註', 'note']],
  ['place', ['地點', 'place']],
];

const SERIAL_MIN_YEAR = 1900;
const SERIAL_MAX_YEAR = 2200;

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t\u3000]+/g, ' ')
    .trim();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatISODate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < SERIAL_MIN_YEAR || year > SERIAL_MAX_YEAR) return null;
  const iso = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  return isValidISODate(iso) ? iso : null;
}

/**
 * Excel 1900 serial → YYYY-MM-DD.
 * Serial 1 is 1900-01-01. Serial 60 (the nonexistent 1900-02-29) is rejected.
 * Later serials subtract that phantom day. The calendar day is read in UTC.
 *
 * @param {number} serial
 * @returns {string | null}
 */
export function excelSerialToISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial + 1e-8);
  if (whole < 1 || whole === 60) return null;
  const days = whole > 60 ? whole - 1 : whole;
  const ms = Date.UTC(1899, 11, 31) + days * 86400000;
  const dt = new Date(ms);
  return formatISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function fractionToHHMM(frac) {
  if (typeof frac !== 'number' || !Number.isFinite(frac)) return null;
  let f = frac;
  if (f < 0) return null;
  if (f >= 1) f -= Math.floor(f);
  const totalMinutes = Math.round(f * 1440);
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
}

function dateObjectToISO(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const utcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  const localMidnight =
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0;
  if (!utcMidnight && localMidnight) {
    return formatISODate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  return formatISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function splitEmbeddedTime(raw) {
  const m = String(raw).match(/^(.*\d)[T\s]+(\d{1,2}:\d{1,2}(?::\d{1,2})?)$/);
  if (!m) return { datePart: String(raw).trim(), timePart: '' };
  return { datePart: m[1].trim(), timePart: m[2] };
}

/**
 * @param {unknown} value
 * @returns {{ iso: string | null, status: 'ok' | 'empty' | 'ambiguous' | 'invalid' }}
 */
export function parseImportDateDetail(value) {
  if (value == null || value === '') return { iso: null, status: 'empty' };
  if (value instanceof Date) {
    const iso = dateObjectToISO(value);
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { iso: null, status: 'invalid' };
    const iso = excelSerialToISO(value);
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }

  const raw = String(value).trim();
  if (!raw) return { iso: null, status: 'empty' };
  const { datePart } = splitEmbeddedTime(raw);
  const s = datePart.trim();

  const zh = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
  if (zh) {
    const iso = formatISODate(Number(zh[1]), Number(zh[2]), Number(zh[3]));
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }

  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const iso = formatISODate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (a > 12 && b > 12) return { iso: null, status: 'invalid' };
    if (a >= 1 && a <= 12 && b >= 1 && b <= 12) return { iso: null, status: 'ambiguous' };
    if (a > 12) {
      const iso = formatISODate(year, b, a);
      return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
    }
    const iso = formatISODate(year, a, b);
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }

  if (/^\d{8}$/.test(s)) {
    const iso = formatISODate(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
    if (iso) return { iso, status: 'ok' };
  }

  if (/^\d+(\.\d+)?$/.test(s)) {
    const iso = excelSerialToISO(Number(s));
    return iso ? { iso, status: 'ok' } : { iso: null, status: 'invalid' };
  }

  return { iso: null, status: 'invalid' };
}

/**
 * Parse a calendar date. Ambiguous day/month numbers and bad values return null.
 * Year-first forms (2026-11-15, 2026/11/15) are not ambiguous.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseImportDate(value) {
  return parseImportDateDetail(value).iso;
}

/**
 * Parse a clock time. Empty input is allowed and returns ''.
 * Invalid input returns null. Excel fractions (0 <= x < 1) and the fractional
 * part of a datetime serial become HH:mm. Integers >= 1 have no clock component.
 *
 * @param {unknown} value
 * @returns {string | null} 'HH:mm', '' when empty, or null when invalid
 */
export function parseImportTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    const frac = value >= 1 ? value - Math.floor(value) : value;
    if (value >= 1 && frac < 1e-8) return '';
    return fractionToHHMM(frac);
  }
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d+(\.\d+)?$/.test(raw)) return parseImportTime(Number(raw));
  const { datePart, timePart } = splitEmbeddedTime(raw);
  const clock = timePart || (datePart.includes(':') ? raw : '');
  if (!clock) return null;
  return parseHHMM(clock);
}

function embeddedTimeFromDateValue(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
    const frac = value - Math.floor(value);
    if (frac >= 1e-8) return fractionToHHMM(frac);
    return '';
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return embeddedTimeFromDateValue(Number(trimmed));
    const { timePart } = splitEmbeddedTime(trimmed);
    if (timePart) return parseHHMM(timePart) || '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hh = value.getUTCHours();
    const mm = value.getUTCMinutes();
    const ss = value.getUTCSeconds();
    if (hh === 0 && mm === 0 && ss === 0) return '';
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  return '';
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\uFEFF/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ');
}

function headerField(header) {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const [field, aliases] of HEADER_FIELDS) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

function mapHeaders(headers) {
  const index = {};
  headers.forEach((header, i) => {
    const field = headerField(header);
    if (field && index[field] == null) index[field] = i;
  });
  return index;
}

function cellAt(row, index) {
  if (index == null || !Array.isArray(row)) return '';
  const value = row[index];
  return value == null ? '' : value;
}

/**
 * @param {unknown[]} row
 * @param {Record<string, number>} index
 */
export function recordFromCells(row, index) {
  const dateValue = cellAt(row, index.date);
  const timeValue = cellAt(row, index.time);
  const dateDetail = parseImportDateDetail(dateValue);
  let time = parseImportTime(timeValue);
  let timeStatus = time == null ? 'invalid' : 'ok';
  if (time === '' && (timeValue == null || String(timeValue).trim() === '')) {
    const embedded = embeddedTimeFromDateValue(dateValue);
    if (embedded) time = embedded;
  }
  if (time == null) {
    time = '';
    timeStatus = 'invalid';
  }
  const title = cleanText(cellAt(row, index.title));
  const dayTitle = cleanText(cellAt(row, index.dayTitle));
  const note = cleanText(cellAt(row, index.note));
  const place = cleanText(cellAt(row, index.place));
  const rawDate = cleanText(dateValue instanceof Date ? '' : dateValue).slice(0, 40);
  return {
    date: dateDetail.iso,
    dateStatus: dateDetail.status,
    time,
    timeStatus,
    title,
    dayTitle,
    note,
    place,
    rawDate: dateDetail.iso || rawDate,
  };
}

function isBlankRecord(record) {
  return (
    record.dateStatus === 'empty' &&
    !record.title &&
    !record.dayTitle &&
    !record.note &&
    !record.place &&
    !record.time &&
    record.timeStatus !== 'invalid'
  );
}

function isEmptyRow(row) {
  if (!Array.isArray(row)) return true;
  return row.every((cell) => cleanText(cell instanceof Date ? 'x' : cell) === '' && !(cell instanceof Date) && typeof cell !== 'number');
}

/**
 * RFC-style CSV matrix. Handles BOM, quotes, escaped quotes, and newlines inside quotes.
 * Delimiter is comma, or tab / semicolon when the header line clearly uses those.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvMatrix(text) {
  let src = String(text ?? '');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const headerLine = src.split(/\r?\n/, 1)[0] || '';
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  let delimiter = ',';
  if (tabs > commas && tabs >= semis) delimiter = '\t';
  else if (semis > commas && semis > tabs) delimiter = ';';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && isEmptyRow(rows[rows.length - 1])) rows.pop();
  return rows;
}

function matrixToRecords(matrix) {
  const rows = Array.isArray(matrix) ? matrix : [];
  let start = 0;
  while (start < rows.length && isEmptyRow(rows[start])) start += 1;
  if (start >= rows.length) return { ok: false, error: 'format', records: [] };
  const index = mapHeaders(rows[start]);
  if (index.date == null || index.title == null) {
    return { ok: false, error: 'format', records: [] };
  }
  const records = [];
  for (let i = start + 1; i < rows.length; i += 1) {
    if (isEmptyRow(rows[i])) continue;
    records.push(recordFromCells(rows[i], index));
  }
  return { ok: true, error: null, records };
}

/**
 * @param {string} text
 * @returns {{ ok: boolean, error: string | null, records: object[] }}
 */
export function parseCalendarCsv(text) {
  if (text == null || String(text).trim() === '') {
    return { ok: false, error: 'format', records: [] };
  }
  return matrixToRecords(parseCsvMatrix(text));
}

/**
 * @param {ArrayBuffer | Uint8Array} arrayBuffer
 * @returns {{ ok: boolean, error: string | null, records: object[] }}
 */
export function parseCalendarXlsx(arrayBuffer) {
  try {
    const data = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: false,
      cellNF: false,
      cellStyles: false,
    });
    const sheetName = workbook.SheetNames && workbook.SheetNames[0];
    if (!sheetName) return { ok: false, error: 'format', records: [] };
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    return matrixToRecords(matrix);
  } catch {
    return { ok: false, error: 'failed', records: [] };
  }
}

function readFileText(file) {
  if (typeof file?.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsText(file);
  });
}

function readFileBuffer(file) {
  if (typeof file?.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsArrayBuffer(file);
  });
}

function isCsvFile(name, mime) {
  return name.endsWith('.csv') || mime === 'text/csv' || mime === 'application/csv' || mime === 'text/comma-separated-values';
}

function isExcelFile(name, mime) {
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xlsm') ||
    name.endsWith('.xls') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel')
  );
}

/**
 * Dispatch on extension / MIME. Does not write trip data.
 *
 * @param {Blob & { name?: string }} file
 */
export async function parseCalendarFile(file) {
  if (!file) return { ok: false, error: 'format', records: [] };
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  try {
    if (isCsvFile(name, mime) && !name.endsWith('.xlsx')) {
      const text = await readFileText(file);
      return parseCalendarCsv(text);
    }
    if (isExcelFile(name, mime)) {
      const buf = await readFileBuffer(file);
      if (!buf) return { ok: false, error: 'format', records: [] };
      return parseCalendarXlsx(buf);
    }
    return { ok: false, error: 'format', records: [] };
  } catch {
    return { ok: false, error: 'failed', records: [] };
  }
}

function coerceRecord(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.dateStatus) return row;
  const dateValue = row.date ?? row.日期 ?? row.Date ?? '';
  const timeValue = row.time ?? row.時間 ?? row.Time ?? '';
  const dateDetail = parseImportDateDetail(dateValue);
  let time = parseImportTime(timeValue);
  let timeStatus = time == null ? 'invalid' : 'ok';
  if (time === '' && (timeValue == null || String(timeValue).trim() === '')) {
    const embedded = embeddedTimeFromDateValue(dateValue);
    if (embedded) time = embedded;
  }
  if (time == null) {
    time = '';
    timeStatus = 'invalid';
  }
  return {
    date: dateDetail.iso,
    dateStatus: dateDetail.status,
    time,
    timeStatus,
    title: cleanText(row.title ?? row['行程'] ?? row.Title ?? row['活動'] ?? ''),
    dayTitle: cleanText(row.dayTitle ?? row['當日標題'] ?? row['Day title'] ?? ''),
    note: cleanText(row.note ?? row['短註'] ?? row.Note ?? ''),
    place: cleanText(row.place ?? row['地點'] ?? row.Place ?? ''),
    rawDate: dateDetail.iso || cleanText(dateValue).slice(0, 40),
  };
}

function resolveRange(trip) {
  const start = isValidISODate(trip?.startDate) ? trip.startDate : null;
  const end = isValidISODate(trip?.endDate) ? trip.endDate : null;
  if (start && end && start <= end) return { start, end, bounded: true };
  if (start && !end) return { start, end: start, bounded: true };
  if (!start && end) return { start: end, end, bounded: true };
  return { start: null, end: null, bounded: false };
}

function currentTripContext(trip, trips) {
  const list = Array.isArray(trips) ? trips : trip ? [trip] : [];
  const current = trip || list[0] || null;
  return {
    list,
    current,
    empty: list.length === 0,
    range: list.length === 0 ? { start: null, end: null, bounded: false } : resolveRange(current),
  };
}

function skipLabel(record) {
  const when = record.date || record.rawDate || '';
  return [when, record.title].filter(Boolean).join(' ').trim();
}

function placeText(item) {
  if (!item || item.place == null) return '';
  return cleanText(item.place);
}

function sameItineraryItem(existing, incoming) {
  const existingTime = parseHHMM(existing?.time) || cleanText(existing?.time);
  const incomingTime = incoming.time || '';
  if (existingTime !== incomingTime) return false;
  if (cleanText(existing?.title) !== cleanText(incoming.title)) return false;
  const a = placeText(existing);
  const b = placeText(incoming);
  if (a && b) return a === b;
  return true;
}

function firstText(values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function nextId(idFactory, used) {
  for (let guard = 0; guard < 10000; guard += 1) {
    const raw = String(idFactory() || `itin-${guard + 1}`);
    const id = !raw || used.has(raw) ? `${raw || 'itin'}-${guard + 1}` : raw;
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
  const fallback = `itin-fallback-${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

function defaultIdFactory(now) {
  const seed = now instanceof Date ? now.getTime() : Number.isFinite(Number(now)) ? Number(now) : Date.now();
  let n = 0;
  return () => {
    n += 1;
    return `itin-${seed}-${n}`;
  };
}

/**
 * Partition parsed rows. Does not mutate `trip`.
 */
function analyzeRecords(records, trip, trips) {
  const ctx = currentTripContext(trip, trips);
  const accepted = [];
  const skipped = [];
  let invalid = 0;
  let outside = 0;
  for (const record of records) {
    if (!record || isBlankRecord(record)) continue;
    const badDate = record.dateStatus !== 'ok' || !record.date;
    if (badDate || !record.title || record.timeStatus === 'invalid') {
      invalid += 1;
      skipped.push({
        reason: 'invalid',
        detail: record.dateStatus === 'ambiguous' ? 'ambiguous' : !record.title ? 'missing-title' : 'invalid',
        date: record.date,
        title: record.title,
        label: skipLabel(record),
      });
      continue;
    }
    if (ctx.range.bounded && (record.date < ctx.range.start || record.date > ctx.range.end)) {
      outside += 1;
      skipped.push({
        reason: 'outside',
        detail: 'outside',
        date: record.date,
        title: record.title,
        label: skipLabel(record),
      });
      continue;
    }
    accepted.push(record);
  }
  const dates = accepted.map((row) => row.date).sort();
  return {
    ctx,
    accepted,
    skipped,
    invalid,
    outside,
    fileStart: dates[0] || null,
    fileEnd: dates[dates.length - 1] || null,
  };
}

function mergeAccepted(accepted, baseTrip, idFactory) {
  const groups = new Map();
  for (const row of accepted) {
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date).push(row);
  }
  let days =
    baseTrip?.days && typeof baseTrip.days === 'object' && !Array.isArray(baseTrip.days) ? baseTrip.days : {};
  const used = new Set();
  for (const day of Object.values(days)) {
    const items = Array.isArray(day?.itinerary) ? day.itinerary : [];
    for (const item of items) {
      if (item?.id != null && item.id !== '') used.add(String(item.id));
    }
  }
  let added = 0;
  let duplicate = 0;
  let daysUpdated = 0;
  const skippedDup = [];
  for (const [iso, rows] of groups) {
    const prev = days[iso] && typeof days[iso] === 'object' && !Array.isArray(days[iso]) ? days[iso] : {};
    const items = Array.isArray(prev.itinerary) ? [...prev.itinerary] : [];
    let appended = 0;
    for (const row of rows) {
      const probe = { time: row.time || '', title: row.title, done: false };
      if (row.place) probe.place = row.place;
      if (items.some((existing) => sameItineraryItem(existing, probe))) {
        duplicate += 1;
        skippedDup.push({
          reason: 'duplicate',
          detail: 'duplicate',
          date: row.date,
          title: row.title,
          label: skipLabel(row),
        });
        continue;
      }
      const item = {
        id: nextId(idFactory, used),
        time: row.time || '',
        title: row.title,
        done: false,
      };
      if (row.place) item.place = row.place;
      items.push(item);
      appended += 1;
      added += 1;
    }
    const patch = {};
    if (appended > 0) patch.itinerary = items;
    const dayTitle = firstText(rows.map((row) => row.dayTitle));
    const dayNote = firstText(rows.map((row) => row.note));
    if (!cleanText(prev.title) && dayTitle) patch.title = dayTitle;
    if (!cleanText(prev.note) && dayNote) patch.note = dayNote;
    if (Object.keys(patch).length === 0) continue;
    days = mergeDayPatch(days, iso, patch);
    daysUpdated += 1;
  }
  return {
    days: daysUpdated > 0 ? days : null,
    added,
    duplicate,
    daysUpdated,
    skippedDup,
  };
}

function emptyCounts() {
  return {
    added: 0,
    skipped: 0,
    outside: 0,
    invalid: 0,
    duplicate: 0,
    daysUpdated: 0,
  };
}

function sourceRecords(input) {
  const list = input?.records || input?.rows || input || [];
  return (Array.isArray(list) ? list : []).map(coerceRecord).filter(Boolean);
}

/**
 * Preview a calendar import. Does not write.
 *
 * @param {{ rows?: object[], records?: object[], trip?: object | null, trips?: object[] }} [input]
 */
export function previewCalendarImport({ rows, records, trip, trips } = {}) {
  const normalized = sourceRecords({ rows, records });
  const analysis = analyzeRecords(normalized, trip, trips);
  const merged = mergeAccepted(analysis.accepted, analysis.ctx.empty ? { days: {} } : analysis.ctx.current, () => 'preview');
  const duplicate = merged.duplicate;
  const skipped = analysis.skipped.concat(merged.skippedDup);
  const skippedTotal = analysis.invalid + analysis.outside + duplicate;
  const offerCreateTrip = analysis.ctx.empty && Boolean(analysis.fileStart);
  const offerSetDates = !analysis.ctx.empty && !analysis.ctx.range.bounded && Boolean(analysis.fileStart);
  return {
    records: normalized,
    accepted: analysis.accepted,
    skipped,
    fileStart: analysis.fileStart,
    fileEnd: analysis.fileEnd,
    offerSetDates,
    offerCreateTrip,
    bounded: analysis.ctx.range.bounded,
    counts: {
      added: merged.added,
      skipped: skippedTotal,
      outside: analysis.outside,
      invalid: analysis.invalid,
      duplicate,
      daysUpdated: merged.daysUpdated,
    },
  };
}

/**
 * Pure merge. `days` is built with `mergeDayPatch` and omits journal/sticker from the patch.
 * Dates are returned only when the caller opted in, or when creating the sole trip.
 *
 * @param {{
 *   preview?: object,
 *   trip?: object | null,
 *   trips?: object[],
 *   now?: Date | number | string,
 *   idFactory?: () => string,
 *   setDates?: boolean,
 *   createTrip?: boolean,
 *   newTripName?: string,
 * }} [input]
 */
export function applyCalendarImport({
  preview,
  trip,
  trips,
  now,
  idFactory,
  setDates = false,
  createTrip = false,
  newTripName = '新旅程',
} = {}) {
  const normalized = sourceRecords(preview);
  const analysis = analyzeRecords(normalized, trip, trips);
  const wantCreate = Boolean(createTrip && analysis.ctx.empty && analysis.fileStart);
  const baseTrip = wantCreate ? { days: {} } : analysis.ctx.current;
  const merged = mergeAccepted(analysis.accepted, baseTrip, idFactory || defaultIdFactory(now));
  const counts = {
    added: wantCreate || !analysis.ctx.empty ? merged.added : 0,
    skipped: analysis.invalid + analysis.outside + merged.duplicate,
    outside: analysis.outside,
    invalid: analysis.invalid,
    duplicate: merged.duplicate,
    daysUpdated: wantCreate || !analysis.ctx.empty ? merged.daysUpdated : 0,
  };
  if (analysis.ctx.empty && !wantCreate) {
    return {
      days: null,
      applyDates: false,
      startDate: null,
      endDate: null,
      newTrip: null,
      counts: { ...counts, added: 0, daysUpdated: 0 },
    };
  }
  const applyDates = Boolean((wantCreate || (setDates && !analysis.ctx.range.bounded)) && analysis.fileStart);
  const name = cleanText(newTripName) || '新旅程';
  return {
    days: counts.daysUpdated > 0 ? merged.days : null,
    applyDates,
    startDate: applyDates ? analysis.fileStart : null,
    endDate: applyDates ? analysis.fileEnd : null,
    newTrip: wantCreate
      ? {
          name,
          startDate: analysis.fileStart,
          endDate: analysis.fileEnd,
          tripCurrency: 'JPY',
          accountingCurrency: 'HKD',
          people: ['共同'],
        }
      : null,
    counts,
  };
}

export const CALENDAR_IMPORT_ACCEPT =
  '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.ms-excel.sheet.macroEnabled.12';
