import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseHHMM } from '../proto/ref/refRules';
import {
  applyCalendarImport,
  excelSerialToISO,
  parseCalendarCsv,
  parseCalendarFile,
  parseCalendarXlsx,
  parseCsvMatrix,
  parseImportDate,
  parseImportTime,
  previewCalendarImport,
} from './importCalendar';

function tripWith(days, extra = {}) {
  return {
    id: 'trip-1',
    name: '東京',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    expenses: [{ id: 'exp-1', originalAmount: 500 }],
    days,
    ...extra,
  };
}

describe('parseHHMM seconds and parseImportTime', () => {
  it('keeps HH:mm from HH:mm:ss and still rejects corrupted clocks', () => {
    expect(parseHHMM('09:15:30')).toBe('09:15');
    expect(parseHHMM('9:5:3')).toBe('09:05');
    expect(parseHHMM('09:15:0030')).toBeNull();
    expect(parseHHMM('09:15:60')).toBeNull();
    expect(parseImportTime('9:05')).toBe('09:05');
    expect(parseImportTime('09:15:30')).toBe('09:15');
    expect(parseImportTime('')).toBe('');
    expect(parseImportTime(null)).toBe('');
    expect(parseImportTime('   ')).toBe('');
    expect(parseImportTime('abc')).toBeNull();
    expect(parseImportTime('25:00')).toBeNull();
  });

  it('reads Excel time fractions and the fractional part of a datetime serial', () => {
    expect(parseImportTime(0)).toBe('00:00');
    expect(parseImportTime(0.5)).toBe('12:00');
    expect(parseImportTime(0.25)).toBe('06:00');
    expect(parseImportTime(1439 / 1440)).toBe('23:59');
    expect(parseImportTime('0.5')).toBe('12:00');
    expect(parseImportTime(46341)).toBe('');
    expect(parseImportTime(46341.5)).toBe('12:00');
    expect(parseImportTime(-0.1)).toBeNull();
  });
});

describe('parseImportDate', () => {
  it('parses ISO, year-first, unambiguous DMY/MDY, and skips ambiguous numbers', () => {
    expect(parseImportDate('2026-11-15')).toBe('2026-11-15');
    expect(parseImportDate(' 2026/11/15 ')).toBe('2026-11-15');
    expect(parseImportDate('2026.11.15')).toBe('2026-11-15');
    expect(parseImportDate('2026年11月15日')).toBe('2026-11-15');
    expect(parseImportDate('2026-11-15T09:30:00')).toBe('2026-11-15');
    expect(parseImportDate('15/11/2026')).toBe('2026-11-15');
    expect(parseImportDate('15-11-2026')).toBe('2026-11-15');
    expect(parseImportDate('11/15/2026')).toBe('2026-11-15');
    expect(parseImportDate('05/06/2026')).toBeNull();
    expect(parseImportDate('06-05-2026')).toBeNull();
    expect(parseImportDate('13/13/2026')).toBeNull();
    expect(parseImportDate('2026-02-31')).toBeNull();
    expect(parseImportDate('2026-02-29')).toBeNull();
    expect(parseImportDate('2024-02-29')).toBe('2024-02-29');
    expect(parseImportDate('')).toBeNull();
    expect(parseImportDate(null)).toBeNull();
  });

  it('uses the Excel 1900 system in UTC, including the fake leap day', () => {
    expect(excelSerialToISO(1)).toBe('1900-01-01');
    expect(excelSerialToISO(59)).toBe('1900-02-28');
    expect(excelSerialToISO(60)).toBeNull();
    expect(excelSerialToISO(61)).toBe('1900-03-01');
    expect(excelSerialToISO(25569)).toBe('1970-01-01');
    expect(excelSerialToISO(44927)).toBe('2023-01-01');
    expect(parseImportDate(46341)).toBe('2026-11-15');
    expect(parseImportDate(46341.75)).toBe('2026-11-15');
    expect(parseImportDate('46341')).toBe('2026-11-15');
    expect(parseImportDate('20261115')).toBe('2026-11-15');
    expect(parseImportDate(0.5)).toBeNull();
  });

  it('does not shift a UTC midnight or a local midnight onto the wrong day', () => {
    expect(parseImportDate(new Date(Date.UTC(2026, 10, 15)))).toBe('2026-11-15');
    expect(parseImportDate(new Date(2026, 10, 15))).toBe('2026-11-15');
  });
});

describe('parseCalendarCsv', () => {
  it('handles BOM, quoted commas, escaped quotes, newlines in quotes, and English aliases', () => {
    const text = `\uFEFF日期,行程,短註,金額\n2026-11-15,"淺草, 寺","他說""你好""\n第二行",1200\n`;
    const matrix = parseCsvMatrix(text);
    expect(matrix[1][1]).toBe('淺草, 寺');
    expect(matrix[1][2]).toBe('他說"你好"\n第二行');
    const parsed = parseCalendarCsv(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      date: '2026-11-15',
      title: '淺草, 寺',
      note: '他說"你好" 第二行',
    });
    expect(parsed.records[0].title).not.toMatch(/1200/);

    const english = parseCalendarCsv('DATE,Time,TITLE,Day Title,Note,Place,Hotel\n2026-11-16,9:05,Museum,Day,Quiet,Ueno,Park Hyatt\n');
    expect(english.ok).toBe(true);
    expect(english.records[0]).toMatchObject({
      date: '2026-11-16',
      time: '09:05',
      title: 'Museum',
      dayTitle: 'Day',
      note: 'Quiet',
      place: 'Ueno',
    });
    expect(english.records[0].hotel).toBeUndefined();
  });

  it('rejects a file without the required columns and skips blank lines', () => {
    expect(parseCalendarCsv('金額,酒店\n1,A\n').ok).toBe(false);
    const parsed = parseCalendarCsv('日期,行程\n\n2026-11-15,博物館\n\n');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].title).toBe('博物館');
  });

  it('reads an embedded clock and a time fraction from the date cell when time is empty', () => {
    const parsed = parseCalendarCsv('日期,時間,行程\n2026-11-15 09:30,,散步\n46341.5,,午餐\n');
    expect(parsed.records[0]).toMatchObject({ date: '2026-11-15', time: '09:30', title: '散步' });
    expect(parsed.records[1]).toMatchObject({ date: '2026-11-15', time: '12:00', title: '午餐' });
  });
});

describe('parseCalendarXlsx', () => {
  it('reads Chinese headers, Excel serials, time fractions, and ignores extra columns', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['日期', '時間', '行程', '當日標題', '短註', '地點', '金額'],
      ['2026-11-15', '09:30', '博物館', '東京', '晴', '上野', 1800],
      [46341, 0.25, '清晨散步', '', '', '', 0],
      ['05/06/2026', '10:00', '歧義', '', '', '', 50],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Calendar');
    const buf = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    const parsed = parseCalendarXlsx(buf);
    expect(parsed.ok).toBe(true);
    expect(parsed.records[0]).toMatchObject({
      date: '2026-11-15',
      time: '09:30',
      title: '博物館',
      dayTitle: '東京',
      note: '晴',
      place: '上野',
    });
    expect(parsed.records[1]).toMatchObject({ date: '2026-11-15', time: '06:00', title: '清晨散步' });
    expect(parsed.records[2].dateStatus).toBe('ambiguous');
    expect(parsed.records[0].amount).toBeUndefined();
  });
});

describe('parseCalendarFile', () => {
  it('dispatches csv by extension without writing', async () => {
    const file = new File(['日期,行程\n2026-11-15,美術館\n'], 'plan.csv', { type: 'text/csv' });
    const parsed = await parseCalendarFile(file);
    expect(parsed.ok).toBe(true);
    expect(parsed.records[0].title).toBe('美術館');
  });
});

describe('previewCalendarImport and applyCalendarImport', () => {
  const existingDay = {
    title: '既有標題',
    note: '既有註',
    sticker: 'fuji',
    journal: '秘密日記',
    itinerary: [
      { id: 'keep', time: '09:00', title: '早餐', done: true },
      { id: 'placed', time: '11:00', title: '公園', place: '上野', done: false },
    ],
  };

  function rows() {
    return [
      { date: '2026-11-15', time: '13:00', title: '博物館', dayTitle: '新標題', note: '新註', place: '上野' },
      { date: '2026-11-15', time: '09:00', title: '早餐', dayTitle: '第二', note: '第二註', place: '淺草' },
      { date: '2026-11-15', time: '11:00', title: '公園', place: '淺草', dayTitle: '', note: '' },
      { date: '2026-11-15', time: '11:00', title: '公園', place: '上野' },
      { date: '2026-12-01', time: '10:00', title: '範圍外' },
      { date: '05/06/2026', time: '08:00', title: '歧義' },
      { date: '2026-11-16', time: 'bad', title: '壞時間' },
      { date: '', title: '' },
    ];
  }

  it('appends items, skips duplicates / outside / invalid, and keeps title, note, journal, and sticker', () => {
    const trip = tripWith({
      '2026-11-15': existingDay,
      '2026-11-02': { title: '別日', note: '', sticker: null, journal: '留低', itinerary: [] },
    });
    const expenses = trip.expenses;
    const preview = previewCalendarImport({ rows: rows(), trip, trips: [trip] });
    expect(preview.counts).toEqual({
      added: 2,
      skipped: 5,
      outside: 1,
      invalid: 2,
      duplicate: 2,
      daysUpdated: 1,
    });
    expect(preview.offerSetDates).toBe(false);
    expect(preview.offerCreateTrip).toBe(false);
    expect(preview.skipped.map((row) => row.reason).sort()).toEqual([
      'duplicate',
      'duplicate',
      'invalid',
      'invalid',
      'outside',
    ]);

    const applied = applyCalendarImport({
      preview,
      trip,
      trips: [trip],
      now: new Date('2026-11-15T00:00:00.000Z'),
      idFactory: (() => {
        let n = 0;
        return () => `new-${++n}`;
      })(),
      setDates: true,
    });
    expect(applied.applyDates).toBe(false);
    expect(applied.newTrip).toBeNull();
    expect(applied.counts.added).toBe(2);
    expect(applied.counts.daysUpdated).toBe(1);
    const day = applied.days['2026-11-15'];
    expect(day.title).toBe('既有標題');
    expect(day.note).toBe('既有註');
    expect(day.journal).toBe('秘密日記');
    expect(day.sticker).toBe('fuji');
    expect(day.itinerary.map((item) => item.title)).toEqual(['早餐', '公園', '博物館', '公園']);
    expect(day.itinerary[0]).toMatchObject({ id: 'keep', done: true, time: '09:00' });
    expect(day.itinerary[2]).toEqual({ id: 'new-1', time: '13:00', title: '博物館', done: false, place: '上野' });
    expect(day.itinerary[3]).toEqual({ id: 'new-2', time: '11:00', title: '公園', done: false, place: '淺草' });
    expect(day.itinerary[3].price).toBeUndefined();
    expect(applied.days['2026-11-02'].journal).toBe('留低');
    expect(applied.days['2026-12-01']).toBeUndefined();
    expect(trip.days['2026-11-15'].itinerary).toHaveLength(2);
    expect(trip.expenses).toBe(expenses);
  });

  it('fills an empty title and note from the first non-empty cell and leaves journal alone', () => {
    const trip = tripWith({
      '2026-11-15': {
        title: '',
        note: '  ',
        sticker: 'torii',
        journal: '原手記',
        itinerary: [],
      },
    });
    const preview = previewCalendarImport({
      records: [
        { date: '2026-11-15', time: '', title: '散步', dayTitle: '', note: '' },
        { date: '2026-11-15', time: '15:00', title: '咖啡', dayTitle: '第一標題', note: '' },
        { date: '2026-11-15', time: '16:00', title: '書店', dayTitle: '第二標題', note: '短句' },
      ],
      trip,
      trips: [trip],
    });
    const applied = applyCalendarImport({ preview, trip, trips: [trip], idFactory: () => 'id-a' });
    expect(applied.days['2026-11-15']).toMatchObject({
      title: '第一標題',
      note: '短句',
      journal: '原手記',
      sticker: 'torii',
    });
    expect(applied.days['2026-11-15'].itinerary).toHaveLength(3);
    expect(applied.days['2026-11-15'].itinerary[0].place).toBeUndefined();
    expect(applied.counts).toMatchObject({ added: 3, duplicate: 0, daysUpdated: 1, outside: 0, invalid: 0 });
  });

  it('skips a second identical row in the same file', () => {
    const trip = tripWith({});
    const preview = previewCalendarImport({
      rows: [
        { date: '2026-11-15', time: '10:00', title: '美術館' },
        { date: '2026-11-15', time: '10:00', title: '美術館' },
      ],
      trip,
      trips: [trip],
    });
    expect(preview.counts).toMatchObject({ added: 1, duplicate: 1, skipped: 1, daysUpdated: 1 });
  });

  it('does not extend a bounded trip, and sets dates only when opted in', () => {
    const open = { id: 'open', name: '空白', expenses: [], days: {}, settings: { people: ['共同', '人物A'] } };
    const preview = previewCalendarImport({
      rows: [
        { date: '2026-11-10', time: '09:00', title: '開始' },
        { date: '2026-11-12', time: '', title: '結束' },
      ],
      trip: open,
      trips: [open],
    });
    expect(preview.offerSetDates).toBe(true);
    expect(preview.fileStart).toBe('2026-11-10');
    expect(preview.fileEnd).toBe('2026-11-12');
    expect(preview.counts.outside).toBe(0);

    const declined = applyCalendarImport({ preview, trip: open, trips: [open], setDates: false });
    expect(declined.applyDates).toBe(false);
    expect(declined.startDate).toBeNull();
    expect(declined.days['2026-11-10'].itinerary[0].title).toBe('開始');
    expect(open.startDate).toBeUndefined();

    const accepted = applyCalendarImport({ preview, trip: open, trips: [open], setDates: true });
    expect(accepted.applyDates).toBe(true);
    expect(accepted.startDate).toBe('2026-11-10');
    expect(accepted.endDate).toBe('2026-11-12');
    expect(accepted.newTrip).toBeNull();

    const bounded = tripWith({});
    const outside = previewCalendarImport({
      rows: [{ date: '2026-12-20', title: '太遲' }],
      trip: bounded,
      trips: [bounded],
    });
    const kept = applyCalendarImport({ preview: outside, trip: bounded, trips: [bounded], setDates: true });
    expect(kept.counts.outside).toBe(1);
    expect(kept.counts.added).toBe(0);
    expect(kept.days).toBeNull();
    expect(kept.applyDates).toBe(false);
  });

  it('offers one new JPY/HKD trip when there are no trips, and only after confirm', () => {
    const preview = previewCalendarImport({
      rows: [
        { date: '2026-11-02', time: '08:00', title: '抵達', place: '成田' },
        { date: '2026-11-04', title: '離開' },
        { date: '05/06/2026', title: '跳過' },
      ],
      trip: null,
      trips: [],
    });
    expect(preview.offerCreateTrip).toBe(true);
    expect(preview.offerSetDates).toBe(false);
    expect(preview.counts).toMatchObject({ added: 2, invalid: 1, outside: 0 });

    const declined = applyCalendarImport({ preview, trip: null, trips: [], createTrip: false });
    expect(declined.newTrip).toBeNull();
    expect(declined.days).toBeNull();
    expect(declined.counts.added).toBe(0);

    const created = applyCalendarImport({
      preview,
      trip: null,
      trips: [],
      createTrip: true,
      newTripName: '新旅程',
      idFactory: () => 'fresh',
    });
    expect(created.newTrip).toEqual({
      name: '新旅程',
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      tripCurrency: 'JPY',
      accountingCurrency: 'HKD',
      people: ['共同'],
    });
    expect(created.applyDates).toBe(true);
    expect(created.days['2026-11-02'].itinerary[0]).toMatchObject({
      title: '抵達',
      time: '08:00',
      place: '成田',
      done: false,
    });
    expect(JSON.stringify(created.newTrip)).not.toContain('人物A');
    expect(created.days['2026-11-02'].journal).toBe('');
    expect(created.days['2026-11-02'].sticker).toBeNull();
  });
});
