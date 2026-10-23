import { useEffect, useState } from 'react';
import { REF_CATEGORIES, REF_PEOPLE, REF_RATE } from './mockRefTrip';
import { Icon, Sakura, Tape, cardDots } from './parts';
import { fmtHKD, zhDate } from './refLogic';
import { normalizeDate } from '../../utils/duplicates';

/**
 * Add / edit expense (approved refinement 4): scan entry on top, then amount + currency (big),
 * then 店舖, 日期 (zh-HK label), 地點, 類別 + 分配給. 進階 is collapsed. Mock only, no network.
 */
export default function AddForm({ initial, defaultDate, startScan, onCancel, onSave }) {
  const [f, setF] = useState(() => initial ? {
    ...initial, date: normalizeDate(initial.date) || '', amount: String(initial.originalAmount), note: initial.note || '',
  } : {
    currency: 'JPY', amount: '', store: '', date: defaultDate || '', place: '', category: '飲食', assignedTo: '共同', note: '', scanned: false,
  });
  const [advanced, setAdvanced] = useState(false);
  const [scanMsg, setScanMsg] = useState(startScan ? '已讀取收據（示範資料），請核對。' : '');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const amt = Number(f.amount) || 0;
  const hkd = f.currency === 'HKD' ? amt : Math.round(amt * REF_RATE);
  const scan = () => {
    setF((s) => ({ ...s, currency: 'JPY', amount: '1680', store: 'ローソン 河口湖駅前店', place: '河口湖', category: '飲食', scanned: true, date: s.date || defaultDate || '' }));
    setScanMsg('已讀取收據（示範資料），請核對。');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (startScan && !initial) scan(); }, []);
  const valid = amt > 0 && f.store.trim();
  const field = 'w-full rounded-control border border-line bg-cream-soft px-3 py-3 text-[16px] text-ink outline-none focus:border-teal';
  const label = 'mb-1 block whitespace-nowrap text-[14px] font-bold text-ink-soft';

  return (
    <div data-testid="expense-form" className="px-4 pb-28 pt-3">
      <div className="flex items-center gap-2">
        <button type="button" data-testid="back" aria-label="返回" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-full text-ink">{Icon.back()}</button>
        <div>
          <div className="text-meta text-ink-muted">記帳</div>
          <h1 className="whitespace-nowrap font-display text-[24px] leading-tight text-ink">{initial ? '編輯記錄' : '新增記錄'}</h1>
        </div>
        <Sakura className="ml-auto h-8 w-8" />
      </div>

      {!initial && (
        <button type="button" data-testid="form-scan" onClick={scan} className="mt-3 flex w-full items-center gap-3 rounded-card border-[1.5px] border-dashed border-teal bg-teal-soft/70 px-3.5 py-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-strong text-white">{Icon.camera()}</span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-[16px] font-bold text-teal-strong">掃描收據自動填寫</span>
            <span className="block whitespace-nowrap text-meta text-ink-muted">{scanMsg || '影相或揀相，金額、店舖自動填好'}</span>
          </span>
        </button>
      )}

      <div className="relative mt-4 rounded-card border border-line p-3.5 shadow-sm" style={cardDots}>
        <Tape tone="mustard" className="-top-2.5 left-6 -rotate-2" />
        <h2 className="mb-2 mt-1 font-display text-[18px] text-ink">金額</h2>
        <div className="flex items-stretch gap-2">
          <select aria-label="貨幣" value={f.currency} onChange={set('currency')} className="shrink-0 rounded-control border border-line bg-cream-soft px-2 text-[15px] font-bold text-ink outline-none">
            <option value="JPY">JPY - 日元</option>
            <option value="HKD">HKD - 港幣</option>
          </select>
          <input data-testid="form-amount" aria-label="金額" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0"
            className="min-w-0 flex-1 rounded-control border border-line bg-cream-soft px-3 py-2 text-right text-[30px] font-bold text-ink outline-none focus:border-teal" />
        </div>
        <div className="mt-1 text-right text-[14px] text-ink-muted">≈ {fmtHKD(hkd)}</div>
      </div>

      <div className="mt-3 space-y-3 rounded-card border border-line bg-cream-soft/70 p-3.5 shadow-sm">
        <h2 className="font-display text-[18px] text-ink">基本資料</h2>
        <div>
          <label htmlFor="ref-store" className={label}>店舖</label>
          <input id="ref-store" className={field} value={f.store} onChange={set('store')} placeholder="例如：ほうとう不動" />
        </div>
        <div>
          <label htmlFor="ref-date" className={label}>日期</label>
          <div className={`${field} relative flex items-center justify-between`}>
            <span className={f.date ? 'text-ink' : 'text-ink-muted'}>{zhDate(f.date)}</span>
            <span className="text-ink-muted">▾</span>
            <input id="ref-date" type="date" value={f.date} onChange={set('date')} className="absolute inset-0 h-full w-full opacity-0" aria-label="日期" />
          </div>
        </div>
        <div>
          <label htmlFor="ref-place" className={label}>地點</label>
          <input id="ref-place" className={field} value={f.place} onChange={set('place')} placeholder="例如：河口湖" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="ref-cat" className={label}>類別</label>
            <select id="ref-cat" className={field} value={f.category} onChange={set('category')}>{REF_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label htmlFor="ref-who" className={label}>分配給</label>
            <select id="ref-who" className={field} value={f.assignedTo} onChange={set('assignedTo')}>{REF_PEOPLE.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
        </div>
        <button type="button" aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)} className="flex w-full items-center justify-between whitespace-nowrap py-1 text-[14px] font-bold text-ink-soft">
          進階（備註、項目） <span className={advanced ? 'rotate-180' : ''}>{Icon.chevDown()}</span>
        </button>
        {advanced && (
          <div>
            <label htmlFor="ref-note2" className={label}>備註</label>
            <textarea id="ref-note2" rows={2} className={`${field} resize-none`} value={f.note} onChange={set('note')} />
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-md px-4 pb-2">
        <button type="button" data-testid="form-save" disabled={!valid}
          onClick={() => onSave({ ...f, originalAmount: amt, hkdAmount: hkd, store: f.store.trim() })}
          className="w-full whitespace-nowrap rounded-control bg-teal-strong py-3.5 text-[17px] font-bold text-white shadow-lg disabled:opacity-50">
          儲存
        </button>
      </div>
    </div>
  );
}
