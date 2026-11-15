// @vitest-environment jsdom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import SettingsView from './SettingsView';

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('zh-TW');
});

function renderSettings(props = {}) {
  const trip = props.trip || createRefTrip();
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(SettingsView, {
        trip,
        trips: props.trips || [trip],
        today: '2026-10-22',
        onUpdateTrip: props.onUpdateTrip || vi.fn(),
        onSelectTrip() {},
        onToast: props.onToast,
        onApplyCalendarImport: props.onApplyCalendarImport,
        onResetAccountTrialData: props.onResetAccountTrialData,
        calendarSource: props.calendarSource,
        uiLanguage: props.uiLanguage || 'zh-TW',
      }),
    ),
  );
}

async function chooseFile(name, text, type = 'text/csv') {
  const input = screen.getByTestId('import-calendar-input');
  const file = new File([text], name, { type });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  return screen.findByTestId('import-calendar-preview');
}

const SAMPLE = [
  '日期,時間,行程,當日標題,短註,地點,金額',
  '2026-10-22,09:30,淺草寺,不應覆蓋,不應覆蓋註,淺草,999',
  '2026-10-22,07:30,新宿 高速巴士出發,x,y,新宿,1',
  '2026-12-01,10:00,箱根,,,,',
  '05/06/2026,08:00,歧義,,,,',
].join('\n');

describe('SettingsView calendar import and account reset', () => {
  it('shows import and reset in 資料管理 and keeps the three export buttons', async () => {
    await i18n.changeLanguage('zh-TW');
    renderSettings();
    expect(screen.getByText('資料管理')).toBeTruthy();
    expect(screen.getByTestId('import-calendar').textContent).toContain('匯入行程');
    expect(screen.getByTestId('reset-account').textContent).toContain('清除帳戶資料');
    expect(screen.getByTestId('export-json')).toBeTruthy();
    expect(screen.getByTestId('export-backup')).toBeTruthy();
    expect(screen.getByTestId('copy-report')).toBeTruthy();
    expect(screen.getByTestId('import-calendar-input').getAttribute('accept')).toContain('.xlsx');
    expect(screen.getByTestId('import-calendar-input').getAttribute('accept')).toContain('text/csv');
    expect(screen.queryByTestId('import-calendar-preview')).toBeNull();
    expect(screen.queryByTestId('reset-account-panel')).toBeNull();
  });

  it('uses English copy for import, preview, and reset', async () => {
    await i18n.changeLanguage('en');
    renderSettings({ uiLanguage: 'en' });
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByTestId('import-calendar').textContent).toContain('Import itinerary');
    expect(screen.getByTestId('reset-account').textContent).toContain('Clear account data');
    expect(screen.getByTestId('export-json').textContent).toContain('Export JSON');
    expect(screen.getByTestId('export-backup').textContent).toContain('Full backup');
    expect(screen.getByTestId('copy-report').textContent).toContain('Copy report');
    fireEvent.click(screen.getByTestId('reset-account'));
    expect(screen.getByTestId('reset-account-warning').textContent).toMatch(/does not delete your login/i);
    expect(screen.getByTestId('reset-account-confirm').textContent).toContain('Confirm clear');
  });

  it('previews a file without writing, then confirms with the merged payload', async () => {
    await i18n.changeLanguage('zh-TW');
    const onApply = vi.fn();
    const onUpdateTrip = vi.fn();
    const onToast = vi.fn();
    renderSettings({ onApplyCalendarImport: onApply, onUpdateTrip, onToast });

    await chooseFile('plan.csv', SAMPLE);
    expect(onApply).not.toHaveBeenCalled();
    expect(onUpdateTrip).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('新增 1 項');
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('略過 3 項');
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('範圍外 1');
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('無效 1');
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('重複 1');
    expect(screen.getByTestId('import-calendar-counts').textContent).toContain('更新 1 日');
    expect(screen.getByTestId('import-calendar-preview').textContent).toContain('2026-12-01');
    expect(screen.queryByTestId('import-calendar-set-dates')).toBeNull();

    fireEvent.click(screen.getByTestId('import-calendar-cancel'));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByTestId('import-calendar-preview')).toBeNull();

    await chooseFile('plan.csv', SAMPLE);
    fireEvent.click(screen.getByTestId('import-calendar-confirm'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onUpdateTrip).not.toHaveBeenCalled();
    const payload = onApply.mock.calls[0][0];
    expect(payload.setDates).toBe(false);
    expect(payload.createTrip).toBe(false);
    expect(payload.newTrip).toBeNull();
    expect(payload.counts).toMatchObject({
      added: 1,
      skipped: 3,
      outside: 1,
      invalid: 1,
      duplicate: 1,
      daysUpdated: 1,
    });
    const day = payload.days['2026-10-22'];
    expect(day.title).toBe('富士山一日遊');
    expect(day.note).toBe('富士');
    expect(day.journal).toContain('暖包');
    expect(day.sticker).toBe('fuji');
    expect(day.itinerary.some((item) => item.title === '淺草寺' && item.time === '09:30' && item.place === '淺草' && item.done === false)).toBe(true);
    expect(day.itinerary.some((item) => item.id === 's9' && item.title === '新宿 高速巴士出發')).toBe(true);
    expect(payload.days['2026-12-01']).toBeUndefined();
    expect(JSON.stringify(day.itinerary)).not.toContain('999');
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining('新增 1 項'));
    expect(screen.queryByTestId('import-calendar-preview')).toBeNull();
  });

  it('offers to set dates only after confirm when the current trip has no dates', async () => {
    await i18n.changeLanguage('zh-TW');
    const onApply = vi.fn();
    const bare = { id: 'bare', name: '空白', expenses: [], days: {}, settings: { people: ['共同'] } };
    renderSettings({
      onApplyCalendarImport: onApply,
      calendarSource: { trip: bare, trips: [bare] },
    });
    await chooseFile('open.csv', '日期,行程\n2026-11-10,開始\n2026-11-12,結束\n');
    expect(onApply).not.toHaveBeenCalled();
    const box = screen.getByTestId('import-calendar-set-dates');
    expect(box.checked).toBe(true);
    fireEvent.click(screen.getByTestId('import-calendar-confirm'));
    const payload = onApply.mock.calls[0][0];
    expect(payload.setDates).toBe(true);
    expect(payload.applyDates).toBe(true);
    expect(payload.startDate).toBe('2026-11-10');
    expect(payload.endDate).toBe('2026-11-12');
    expect(payload.createTrip).toBe(false);
  });

  it('offers to create one trip only after confirm when there are no trips', async () => {
    await i18n.changeLanguage('en');
    const onApply = vi.fn();
    renderSettings({
      uiLanguage: 'en',
      onApplyCalendarImport: onApply,
      calendarSource: { trip: null, trips: [] },
    });
    await chooseFile('new.csv', 'Date,Title\n2026-11-02,Arrive\n');
    expect(screen.getByTestId('import-calendar-preview').textContent).toContain('Import preview');
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-calendar-create-trip').checked).toBe(true);
    fireEvent.click(screen.getByTestId('import-calendar-confirm'));
    const payload = onApply.mock.calls[0][0];
    expect(payload.createTrip).toBe(true);
    expect(payload.newTrip).toMatchObject({
      name: 'New trip',
      tripCurrency: 'JPY',
      accountingCurrency: 'HKD',
      people: ['共同'],
      startDate: '2026-11-02',
      endDate: '2026-11-02',
    });
    expect(payload.days['2026-11-02'].itinerary[0].title).toBe('Arrive');
  });

  it('requires a second confirm before clearing account data', async () => {
    await i18n.changeLanguage('zh-TW');
    const onReset = vi.fn();
    const onToast = vi.fn();
    renderSettings({ onResetAccountTrialData: onReset, onToast });
    fireEvent.click(screen.getByTestId('reset-account'));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByTestId('reset-account-warning').textContent).toContain('不會刪除登入');
    fireEvent.click(screen.getByTestId('reset-account-cancel'));
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reset-account-panel')).toBeNull();
    fireEvent.click(screen.getByTestId('reset-account'));
    fireEvent.click(screen.getByTestId('reset-account-confirm'));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith('已清除帳戶資料');
    expect(screen.queryByTestId('reset-account-panel')).toBeNull();
  });
});
