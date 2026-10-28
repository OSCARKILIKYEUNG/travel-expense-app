import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveStickerIdAfterSave } from '../../motion/stickerKeyframes';
import DayView from './DayView';
import ExpenseCard from './ExpenseCard';
import { createRefTrips } from './mockRefTrip';
import { Toast } from './parts';

const sampleExpense = {
  id: 'e-added-1',
  date: '2026-10-22',
  category: '飲食',
  assignedTo: '共同',
  payer: 'Oscar',
  payment: 'cash',
  scanned: false,
  store: '一蘭拉麵 新宿店',
  place: '新宿',
  currency: 'JPY',
  originalAmount: 1960,
  hkdAmount: 103,
};

describe('PR-anim-1 — ExpenseCard, DayView, and Toast motion wiring', () => {
  it('marks ExpenseCard with data-sticker-pop only when stickerPop is true (add), not on edit', () => {
    const addedHtml = renderToStaticMarkup(
      createElement(ExpenseCard, {
        expense: sampleExpense,
        highlighted: true,
        stickerPop: Boolean(
          resolveStickerIdAfterSave({ isEdit: false, savedId: sampleExpense.id }),
        ),
        onEdit: () => {},
        onDelete: () => {},
      }),
    );
    expect(addedHtml).toContain('data-testid="expense-e-added-1"');
    expect(addedHtml).toContain('data-highlighted="true"');
    expect(addedHtml).toContain('data-sticker-pop="true"');

    const editedHtml = renderToStaticMarkup(
      createElement(ExpenseCard, {
        expense: sampleExpense,
        highlighted: true,
        stickerPop: Boolean(
          resolveStickerIdAfterSave({ isEdit: true, savedId: sampleExpense.id }),
        ),
        onEdit: () => {},
        onDelete: () => {},
      }),
    );
    expect(editedHtml).toContain('data-highlighted="true"');
    expect(editedHtml).not.toContain('data-sticker-pop');
  });

  it('threads stickerId through DayView to DayExpenses so only the newly added row receives stickerPop', () => {
    const baseTrip = createRefTrips()[0];
    const trip = {
      ...baseTrip,
      expenses: [...baseTrip.expenses, sampleExpense],
    };

    const htmlWithAddPop = renderToStaticMarkup(
      createElement(DayView, {
        trip,
        iso: '2026-10-22',
        pane: 'expenses',
        editing: false,
        highlightId: sampleExpense.id,
        stickerId: sampleExpense.id,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );

    expect(htmlWithAddPop).toContain('data-expense-id="e-added-1" data-highlighted="true" data-sticker-pop="true"');
    // Pre-existing expenses on 2026-10-22 do not get data-sticker-pop
    const popOccurrences = htmlWithAddPop.split('data-sticker-pop="true"').length - 1;
    expect(popOccurrences).toBe(1);

    // Edit case: highlightId is set, stickerId is null -> 0 sticker pops
    const htmlWithEditOnly = renderToStaticMarkup(
      createElement(DayView, {
        trip,
        iso: '2026-10-22',
        pane: 'expenses',
        editing: false,
        highlightId: sampleExpense.id,
        stickerId: null,
        onPane: () => {},
        onEditToggle: () => {},
        onBack: () => {},
        onDay: () => {},
        onUpdateDay: () => {},
        onScan: () => {},
        onAdd: () => {},
        onEditExpense: () => {},
        onDeleteExpense: () => {},
      }),
    );
    expect(htmlWithEditOnly).toContain('data-expense-id="e-added-1" data-highlighted="true"');
    expect(htmlWithEditOnly).not.toContain('data-sticker-pop');
  });

  it('renders Toast with undo action or dismiss button and returns empty when toast is null', () => {
    expect(renderToStaticMarkup(createElement(Toast, { toast: null }))).toBe('');

    const undoToastHtml = renderToStaticMarkup(
      createElement(Toast, {
        toast: { id: 1, message: '已記錄 HK$103 · 10月22日', undo: { kind: 'add' } },
        onUndo: () => {},
      }),
    );
    expect(undoToastHtml).toContain('data-testid="toast"');
    expect(undoToastHtml).toContain('data-testid="toast-undo"');
    expect(undoToastHtml).toContain('已記錄 HK$103 · 10月22日');

    const longNotice = '收據沒有日期，已記入你在日曆選取的 10月20日，可在編輯中修改。';
    const dismissToastHtml = renderToStaticMarkup(
      createElement(Toast, {
        toast: { id: 2, message: longNotice, undo: null },
        onDismiss: () => {},
      }),
    );
    expect(dismissToastHtml).toContain(longNotice);
    expect(dismissToastHtml).toContain('line-clamp-3');
    expect(dismissToastHtml).toContain('whitespace-normal');
    expect(dismissToastHtml).toContain('break-words');
    const spanMatch = dismissToastHtml.match(/<span class="([^"]*)">/);
    expect(spanMatch?.[1] || '').not.toContain('truncate');
    expect(spanMatch?.[1] || '').not.toContain('whitespace-nowrap');
  });
});
