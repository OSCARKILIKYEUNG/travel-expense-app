import { useEffect, useState } from 'react';
import { REF_CATEGORIES } from './mockRefTrip';
import { Icon, Sakura, Tape } from './parts';
import { fmtHKD, zhDate } from './refLogic';
import { normalizeDate } from '../../utils/duplicates';

/**
 * Add / edit expense form:
 * - Scan banner at top
 * - 金額與細項 first (big amount + currency), then 基本資料 (店舖, zh-HK 日期, 地點, 類別, 分配給, 進階)
 * - Sticky save bar sits fixed directly above BottomNav; form has bottom padding + scroll-padding so no field is covered.
 */
export default function AddForm({
  initial,
  defaultDate,
  startScan,
  people = ['共同'],
  rate = 0.0526,
  onCancel,
  onSave,
}) {
  const defaultAssignee = people.includes('共同') ? '共同' : people[0] || '共同';
  const [f, setF] = useState(() =>
    initial
      ? {
          ...initial,
          date: normalizeDate(initial.date) || '',
          amount: String(initial.originalAmount),
          subtotal: initial.subtotal ? String(initial.subtotal) : '',
          tax: initial.tax ? String(initial.tax) : '',
          taxRefund: initial.taxRefund ? String(initial.taxRefund) : '',
          discount: initial.discount ? String(initial.discount) : '',
          note: initial.note || '',
        }
      : {
          currency: 'JPY',
          amount: '',
          store: '',
          date: defaultDate || '',
          place: '',
          category: '飲食',
          assignedTo: defaultAssignee,
          subtotal: '',
          tax: '',
          taxRefund: '',
          discount: '',
          note: '',
          scanned: false,
        },
  );
  const [advanced, setAdvanced] = useState(false);
  const [scanMsg, setScanMsg] = useState(startScan ? '已讀取收據（示範資料），請核對。' : '');

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const amt = Number(f.amount) || 0;
  const activeRate = Number(rate) > 0 ? Number(rate) : 0.0526;
  const hkd = f.currency === 'HKD' ? amt : Math.round(amt * activeRate);

  const scan = () => {
    setF((s) => ({
      ...s,
      currency: 'JPY',
      amount: '1680',
      store: 'ローソン 河口湖駅前店',
      place: '河口湖',
      category: '飲食',
      scanned: true,
      date: s.date || defaultDate || '',
    }));
    setScanMsg('已讀取收據（示範資料），請核對。');
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (startScan && !initial) scan();
  }, []);

  const valid = amt > 0 && Boolean(f.store.trim());
  const field =
    'min-h-11 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal';
  const label = 'mb-1 block whitespace-nowrap text-sm font-medium text-ink-soft';

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!valid) return;
    onSave({
      ...f,
      originalAmount: amt,
      hkdAmount: hkd,
      store: f.store.trim(),
    });
  };

  return (
    <form
      onSubmit={submit}
      data-testid="expense-form"
      className="space-y-3.5 px-4 pb-44 pt-4 scroll-pb-44"
      style={{ scrollPaddingBottom: '11rem' }}
    >
      <div className="relative flex items-center gap-3">
        <Sakura className="absolute -right-1 -top-1 h-7 w-7 opacity-70" />
        <button
          type="button"
          data-testid="back"
          aria-label="返回"
          onClick={onCancel}
          className="btn-icon h-11 w-11 min-h-11 min-w-11 shrink-0"
        >
          {Icon.back('h-5 w-5')}
        </button>
        <div className="min-w-0">
          <p className="whitespace-nowrap text-meta font-medium tracking-[0.12em] text-ink-muted">記帳</p>
          <h1 className="whitespace-nowrap font-display text-2xl leading-tight tracking-[-0.03em] text-ink">
            {initial ? '編輯記錄' : '新增記錄'}
          </h1>
        </div>
      </div>

      {!initial && (
        <button
          type="button"
          data-testid="form-scan"
          onClick={scan}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-dashed border-teal/60 bg-teal-soft/75 px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-teal-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-strong text-white">
            {Icon.camera('h-4 w-4')}
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-sm font-bold text-teal-strong">掃描收據自動填寫</span>
            <span className="block truncate whitespace-nowrap text-meta text-ink-muted">
              {scanMsg || '影相或揀相，金額、店舖自動填好'}
            </span>
          </span>
        </button>
      )}

      {/* Card 1: Amount & currency first */}
      <div className="paper-panel relative space-y-2.5 p-4">
        <Tape tone="mustard" className="-top-2 left-6 z-10 h-4 w-20 -rotate-1" />
        <div className="flex items-baseline justify-between">
          <h2 className="whitespace-nowrap font-display text-lg leading-snug tracking-[-0.02em] text-ink">金額</h2>
          <span className="whitespace-nowrap font-mono text-meta font-semibold text-teal-strong">
            ≈ {fmtHKD(hkd)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ref-currency" className={label}>
              幣別
            </label>
            <select
              id="ref-currency"
              aria-label="貨幣"
              value={f.currency}
              onChange={set('currency')}
              className={field}
            >
              <option value="JPY">JPY - 日元</option>
              <option value="HKD">HKD - 港幣</option>
            </select>
          </div>
          <div>
            <label htmlFor="ref-amount" className={label}>
              實付金額
            </label>
            <input
              id="ref-amount"
              data-testid="form-amount"
              aria-label="金額"
              inputMode="decimal"
              value={f.amount}
              onChange={set('amount')}
              placeholder="0"
              className={`${field} font-semibold`}
            />
          </div>
        </div>
      </div>

      {/* Card 2: Basic info */}
      <div className="paper-panel space-y-3 p-4">
        <h2 className="whitespace-nowrap font-display text-lg leading-snug tracking-[-0.02em] text-ink">基本資料</h2>

        <div>
          <label htmlFor="ref-store" className={label}>
            店舖
          </label>
          <input
            id="ref-store"
            className={field}
            value={f.store}
            onChange={set('store')}
            placeholder="商店名稱…"
            autoComplete="off"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="ref-date" className="whitespace-nowrap text-sm font-medium text-ink-soft">
              日期
            </label>
            {f.date && (
              <button
                type="button"
                data-testid="form-clear-date"
                onClick={() => setF((s) => ({ ...s, date: '' }))}
                className="-my-2 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-lg px-2 text-meta font-semibold text-teal-strong hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                設為未有日期
              </button>
            )}
          </div>
          <div className={`${field} relative flex items-center justify-between`}>
            <span className={f.date ? 'whitespace-nowrap text-ink' : 'whitespace-nowrap text-ink-muted'}>
              {zhDate(f.date)}
            </span>
            <span className="text-ink-muted">{Icon.calendar('h-4 w-4')}</span>
            <input
              id="ref-date"
              type="date"
              value={f.date}
              onChange={set('date')}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="日期"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ref-place" className={label}>
            地點
          </label>
          <input
            id="ref-place"
            className={field}
            value={f.place}
            onChange={set('place')}
            placeholder="城市或區域…"
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ref-cat" className={label}>
              類別
            </label>
            <select id="ref-cat" className={field} value={f.category} onChange={set('category')}>
              {REF_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ref-who" className={label}>
              分配給
            </label>
            <select id="ref-who" className={field} value={f.assignedTo} onChange={set('assignedTo')}>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-cream">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between whitespace-nowrap px-3 py-2.5 text-left text-sm font-bold text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
          >
            <span>進階</span>
            <span className={`transition-transform ${advanced ? 'rotate-180' : ''}`}>
              {Icon.chevDown('h-3.5 w-3.5')}
            </span>
          </button>
          {advanced && (
            <div className="space-y-2 border-t border-line px-3 pb-3 pt-2">
              <p className="whitespace-nowrap text-meta font-bold text-ink-muted">稅務／折扣（選填）</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ref-subtotal" className="mb-0.5 block whitespace-nowrap text-meta text-ink-muted">
                    標價小計
                  </label>
                  <input
                    id="ref-subtotal"
                    type="number"
                    value={f.subtotal}
                    onChange={set('subtotal')}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="ref-tax" className="mb-0.5 block whitespace-nowrap text-meta text-ink-muted">
                    消費稅
                  </label>
                  <input id="ref-tax" type="number" value={f.tax} onChange={set('tax')} className={field} />
                </div>
                <div>
                  <label htmlFor="ref-refund" className="mb-0.5 block whitespace-nowrap text-meta text-ink-muted">
                    退稅
                  </label>
                  <input
                    id="ref-refund"
                    type="number"
                    value={f.taxRefund}
                    onChange={set('taxRefund')}
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="ref-discount" className="mb-0.5 block whitespace-nowrap text-meta text-ink-muted">
                    折扣
                  </label>
                  <input
                    id="ref-discount"
                    type="number"
                    value={f.discount}
                    onChange={set('discount')}
                    className={field}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ref-note2" className="mb-0.5 block whitespace-nowrap text-meta text-ink-muted">
                  備註
                </label>
                <textarea
                  id="ref-note2"
                  rows={2}
                  className={`${field} resize-none`}
                  value={f.note}
                  onChange={set('note')}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky save bar directly above BottomNav */}
      <div
        data-testid="form-save-bar"
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-20 border-t border-line bg-cream-soft px-4 py-2.5 shadow-sm"
      >
        <div className="mx-auto flex max-w-5xl gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary min-h-11 flex-1 whitespace-nowrap !py-2.5 text-sm"
          >
            取消
          </button>
          <button
            type="submit"
            data-testid="form-save"
            disabled={!valid}
            className="btn-primary min-h-11 flex-1 gap-1.5 whitespace-nowrap !py-2.5 text-sm"
          >
            {Icon.check('h-4 w-4')}
            <span>儲存</span>
          </button>
        </div>
      </div>
    </form>
  );
}
