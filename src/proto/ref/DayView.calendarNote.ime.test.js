// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import DayView from './DayView';

const ISO = '2026-11-15';
const STROKE_MARKS = ['一', '丨', '丿', '丶', '乛'];
const FIVE_STROKES = STROKE_MARKS.join('');

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await i18n.changeLanguage('zh-TW');
});

function emptyDay(note) {
  return {
    title: '標題',
    note,
    sticker: null,
    journal: '',
    itinerary: [],
  };
}

function CalendarNoteHarness({ initialNote = '', sink }) {
  const [note, setNote] = useState(initialNote);
  const trip = {
    id: 'trip-calendar-note-ime',
    name: '筆劃測試',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    settings: { people: ['共同'], rate: 0.05, budget: 1000 },
    expenses: [],
    days: { [ISO]: emptyDay(note) },
  };
  return createElement(DayView, {
    trip,
    iso: ISO,
    pane: 'itinerary',
    editing: true,
    onPane: () => {},
    onEditToggle: () => {},
    onBack: () => {},
    onDay: () => {},
    onUpdateDay: (iso, patch) => {
      sink.calls.push({ iso, patch });
      if (Object.prototype.hasOwnProperty.call(patch, 'note')) setNote(patch.note ?? '');
    },
    onScan: () => {},
    onAdd: () => {},
    onEditExpense: () => {},
    onDeleteExpense: () => {},
  });
}

function noteSaves(sink) {
  return sink.calls
    .filter((call) => Object.prototype.hasOwnProperty.call(call.patch, 'note'))
    .map((call) => call.patch.note);
}

function renderNote(initialNote = '') {
  const sink = { calls: [] };
  render(createElement(CalendarNoteHarness, { initialNote, sink }));
  const input = screen.getByLabelText('月曆小字');
  return { sink, input };
}

function placeCaret(input, start = input.value.length, end = start) {
  input.focus();
  input.setSelectionRange(start, end);
}

function beginComposition(input, start = input.value.length, end = start) {
  placeCaret(input, start, end);
  fireEvent.compositionStart(input);
}

function pushPreedit(input, value) {
  fireEvent.change(input, { target: { value } });
}

function fiveStrokePreedit(base = '') {
  return `${base}${FIVE_STROKES}`;
}

describe('calendar note stroke composition', () => {
  it('keeps a five-stroke preedit visible and does not save it', () => {
    const { sink, input } = renderNote('');
    beginComposition(input);
    for (let i = 1; i <= STROKE_MARKS.length; i += 1) {
      pushPreedit(input, STROKE_MARKS.slice(0, i).join(''));
    }

    expect.soft(input.value).toBe(FIVE_STROKES);
    expect.soft(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
  });

  it('commits the candidate once when change arrives before compositionend', () => {
    const { sink, input } = renderNote('');
    beginComposition(input);
    pushPreedit(input, FIVE_STROKES);
    expect.soft(input.value).toBe(FIVE_STROKES);
    expect.soft(noteSaves(sink)).toEqual([]);

    pushPreedit(input, '想');
    fireEvent.compositionEnd(input, { data: '想' });

    expect(input.value).toBe('想');
    expect(noteSaves(sink)).toEqual(['想']);
    expect(sink.calls.every((call) => call.iso === ISO)).toBe(true);
  });

  it('commits the candidate once when compositionend arrives before the final change', () => {
    const { sink, input } = renderNote('');
    beginComposition(input);
    pushPreedit(input, FIVE_STROKES);
    expect.soft(input.value).toBe(FIVE_STROKES);
    expect.soft(noteSaves(sink)).toEqual([]);

    fireEvent.compositionEnd(input, { data: '想' });
    pushPreedit(input, '想');

    expect(input.value).toBe('想');
    expect(noteSaves(sink)).toEqual(['想']);
    expect(noteSaves(sink).some((note) => note.includes('乛') || note === '一丨丿丶')).toBe(false);
  });

  it('drops a cancelled composition without saving the preedit', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    fireEvent.compositionEnd(input, { data: '' });

    expect(input.value).toBe('富士');
    expect(noteSaves(sink)).toEqual([]);
  });

  it('restores the committed note on blur while a preedit is still open', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    expect.soft(input.value).toBe(fiveStrokePreedit('富士'));
    expect.soft(noteSaves(sink)).toEqual([]);

    fireEvent.blur(input);

    expect(input.value).toBe('富士');
    expect(noteSaves(sink)).toEqual([]);
  });

  it('does not save or submit when Enter is composing, including keyCode 229, then still commits the candidate', () => {
    const { sink, input } = renderNote('');
    const addStopForm = document.querySelector('form');
    const submits = [];
    addStopForm.addEventListener('submit', () => {
      submits.push('submit');
    });
    beginComposition(input);
    pushPreedit(input, FIVE_STROKES);

    // The note sits outside the add-stop form. These keydowns must not pin
    // dispatchEvent's return value: preventDefault here can swallow the IME's
    // own candidate confirmation, and nothing in the app submits this field.
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 });

    expect(input.closest('form')).toBeNull();
    expect(addStopForm.contains(input)).toBe(false);
    expect(input.value).toBe(FIVE_STROKES);
    expect(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
    expect(submits).toEqual([]);

    fireEvent.compositionEnd(input, { data: '想' });

    expect(input.value).toBe('想');
    expect(noteSaves(sink)).toEqual(['想']);
    expect(submits).toEqual([]);
  });

  it('appends one committed character onto an existing note without storing the strokes', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    expect.soft(input.value).toBe(fiveStrokePreedit('富士'));
    expect.soft(noteSaves(sink)).toEqual([]);

    fireEvent.compositionEnd(input, { data: '山' });

    expect(input.value).toBe('富士山');
    expect(noteSaves(sink)).toEqual(['富士山']);
  });

  it('commits several Chinese characters and still caps the fifth committed character', () => {
    const { sink, input } = renderNote('');
    const chars = ['東', '京', '站', '前', '後'];
    let committed = '';
    for (const ch of chars) {
      beginComposition(input);
      const preedit = `${committed}${FIVE_STROKES}`;
      pushPreedit(input, preedit);
      expect.soft(input.value).toBe(preedit);
      expect.soft(noteSaves(sink).at(-1) ?? '').toBe(committed);
      fireEvent.compositionEnd(input, { data: ch });
      committed = '東京站前'.startsWith(committed + ch) ? committed + ch : '東京站前';
    }

    expect(input.value).toBe('東京站前');
    expect(noteSaves(sink)).toEqual(['東', '東京', '東京站', '東京站前']);
    expect(noteSaves(sink).some((note) => FIVE_STROKES.split('').some((mark) => note.includes(mark)))).toBe(false);
  });

  it('inserts a committed character in the middle of an existing note', () => {
    const { sink, input } = renderNote('東京');
    beginComposition(input, 1, 1);
    pushPreedit(input, `東${FIVE_STROKES}京`);
    expect.soft(input.value).toBe(`東${FIVE_STROKES}京`);
    expect.soft(noteSaves(sink)).toEqual([]);

    fireEvent.compositionEnd(input, { data: '站' });

    expect(input.value).toBe('東站京');
    expect(noteSaves(sink)).toEqual(['東站京']);
  });

  it('caps a committed Latin paste and a committed CJK paste', () => {
    const { sink, input } = renderNote('');
    pushPreedit(input, 'Shibuya Sky');
    expect(input.value).toBe('Shibuy');
    expect(noteSaves(sink)).toEqual(['Shibuy']);

    pushPreedit(input, 'Kyoto');
    expect(input.value).toBe('Kyoto');

    pushPreedit(input, '淺草寺與晴空塔');
    expect(input.value).toBe('淺草寺與');
    expect(noteSaves(sink)).toEqual(['Shibuy', 'Kyoto', '淺草寺與']);
  });

  it('caps committed emoji and non-BMP characters on the existing width unit', () => {
    const { sink, input } = renderNote('');
    const emoji = '😀';
    pushPreedit(input, emoji.repeat(7));
    expect(input.value).toBe(emoji.repeat(6));
    expect(Array.from(input.value)).toHaveLength(6);

    const ext = '𠮷';
    pushPreedit(input, ext.repeat(7));
    expect(input.value).toBe(ext.repeat(6));
    expect(Array.from(input.value)).toHaveLength(6);
    expect(noteSaves(sink)).toEqual([emoji.repeat(6), ext.repeat(6)]);
  });

  it('shows the saved note after the editor is reopened and does not write on mount', () => {
    const first = renderNote('');
    beginComposition(first.input);
    pushPreedit(first.input, FIVE_STROKES);
    fireEvent.compositionEnd(first.input, { data: '東' });
    expect(first.input.value).toBe('東');
    expect(noteSaves(first.sink)).toEqual(['東']);

    cleanup();
    const reopened = renderNote('東');
    expect(reopened.input.value).toBe('東');
    expect(reopened.sink.calls).toEqual([]);
  });

  it('blur after a non-composing edit commits once and does not repeat the save', () => {
    const { sink, input } = renderNote('');
    pushPreedit(input, 'Kyoto');
    expect(noteSaves(sink)).toEqual(['Kyoto']);

    fireEvent.blur(input);

    expect(input.value).toBe('Kyoto');
    expect(noteSaves(sink)).toEqual(['Kyoto']);
  });
});

function focusTitle() {
  const title = screen.getByLabelText('今日標題');
  act(() => {
    title.focus();
  });
  return title;
}

function expectCommittedFujiSan(sink, input) {
  expect(input.value).toBe('富士山');
  expect(noteSaves(sink)).toEqual(['富士山']);
  expect(noteSaves(sink)).not.toContain('山');
  expect(input.value).not.toContain('乛');
  expect(input.value.startsWith('富士')).toBe(true);
}

describe('calendar note blur then a later compositionend', () => {
  it('moves focus to the title, then compositionend data 山 commits 富士山 and not 山', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    expect.soft(input.value).toBe(fiveStrokePreedit('富士'));
    expect.soft(noteSaves(sink)).toEqual([]);

    const title = focusTitle();

    expect(document.activeElement).toBe(title);
    expect(input.value).toBe('富士');
    expect(noteSaves(sink)).toEqual([]);

    fireEvent.compositionEnd(input, { data: '山' });

    expectCommittedFujiSan(sink, input);
    expect(document.activeElement).toBe(title);
  });

  it('after that blur, compositionend then the final 富士山 input saves the candidate once', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    const title = focusTitle();
    expect(document.activeElement).toBe(title);

    fireEvent.compositionEnd(input, { data: '山' });
    fireEvent.change(input, { target: { value: '富士山' } });

    expectCommittedFujiSan(sink, input);
  });

  it('after that blur, the final 富士山 input then compositionend does not replace it with 山', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    const title = focusTitle();
    expect(document.activeElement).toBe(title);

    fireEvent.change(input, { target: { value: '富士山' } });
    fireEvent.compositionEnd(input, { data: '山' });

    expectCommittedFujiSan(sink, input);
  });

  it('ignores a preedit echo after blur and still commits the later candidate', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    focusTitle();

    fireEvent.change(input, { target: { value: fiveStrokePreedit('富士') } });

    expect(input.value).toBe('富士');
    expect(noteSaves(sink)).toEqual([]);

    fireEvent.compositionEnd(input, { data: '山' });

    expectCommittedFujiSan(sink, input);
  });

  it('a blur followed by an empty compositionend still restores 富士 and saves nothing', () => {
    const { sink, input } = renderNote('富士');
    beginComposition(input);
    pushPreedit(input, fiveStrokePreedit('富士'));
    focusTitle();

    fireEvent.compositionEnd(input, { data: '' });

    expect(input.value).toBe('富士');
    expect(noteSaves(sink)).toEqual([]);
    expect(input.value).not.toContain('乛');
  });
});

const OVER_BUDGET_NOTE = '淺草寺與晴空塔';

describe('imported note longer than the entry budget', () => {
  it('does not emit onUpdateDay or truncate when an imported note is only focused and blurred', () => {
    const { sink, input } = renderNote(OVER_BUDGET_NOTE);
    expect(input.value).toBe(OVER_BUDGET_NOTE);

    act(() => {
      input.focus();
    });
    expect(document.activeElement).toBe(input);
    fireEvent.blur(input);

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
  });

  it('does not modify the stored note when composition starts, cancels, and blurs', () => {
    const { sink, input } = renderNote(OVER_BUDGET_NOTE);
    beginComposition(input);
    fireEvent.compositionEnd(input, { data: '' });

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(sink.calls).toEqual([]);

    fireEvent.blur(input);

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
  });

  it('does not modify the stored note when a preedit is cancelled and the field then blurs', () => {
    const { sink, input } = renderNote(OVER_BUDGET_NOTE);
    beginComposition(input);
    pushPreedit(input, `${OVER_BUDGET_NOTE}${FIVE_STROKES}`);
    fireEvent.compositionEnd(input, { data: '' });

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(sink.calls).toEqual([]);

    fireEvent.blur(input);

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
  });

  it('keeps the stored note when blur cancels an open preedit and compositionend follows', () => {
    const { sink, input } = renderNote(OVER_BUDGET_NOTE);
    beginComposition(input);
    pushPreedit(input, `${OVER_BUDGET_NOTE}${FIVE_STROKES}`);
    focusTitle();

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(sink.calls).toEqual([]);

    fireEvent.compositionEnd(input, { data: '' });

    expect(input.value).toBe(OVER_BUDGET_NOTE);
    expect(noteSaves(sink)).toEqual([]);
    expect(sink.calls).toEqual([]);
  });

  it('still caps a real non-composing edit of an over-budget imported note', () => {
    const { sink, input } = renderNote(OVER_BUDGET_NOTE);
    pushPreedit(input, '京都站前');

    expect(input.value).toBe('京都站前');
    expect(noteSaves(sink)).toEqual(['京都站前']);
  });
});
