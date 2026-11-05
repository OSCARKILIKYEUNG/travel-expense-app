import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { JournalIcon } from '../../journal/art/core.jsx';
import { WashBlob, WashiLabel } from '../../journal/art/decor.jsx';
import { scanResultToFormFields } from '../../notebook/useReceiptScan';
import { formatAccountingAmount } from '../../utils/currency';
import { normalizeDate } from '../../utils/duplicates';
import { REF_CATEGORIES } from './mockRefTrip';
import { Icon } from './parts';
import { formatNotebookDate } from './refLogic';
import { defaultPayer, defaultTime, saveBlockReason } from './refRules';

const CATEGORY_WASH_TONE = {
  飲食: 'wheat',
  交通: 'sky',
  購物: 'berry',
  住宿: 'wheat',
  娛樂: 'leaf',
  其他: 'leaf',
};

const CATEGORY_WASH_SHAPE = {
  飲食: 1,
  交通: 2,
  購物: 3,
  住宿: 1,
  娛樂: 2,
  其他: 3,
};

/**
 * Add / edit expense form:
 * - Scan banner at top
 * - 金額與細項 first (big amount + currency + 付款人 + 付款方式), then 基本資料 (店舖, 日期 + 時間, 地點, 類別貼紙 + 分配給, 進階)
 * - In-flow save bar sits at the bottom of the form content above BottomNav so no field is ever covered.
 */
export default function AddForm({
  initial,
  defaultDate,
  startScan,
  people = ['共同'],
  rate = 0.0526,
  accountingCurrency = 'HKD',
  payerDefault,
  paymentDefault,
  now,
  onRequestScan,
  scanState,
  scanDraft,
  onCancel,
  onSave,
}) {
  const { t, i18n: activeI18n } = useTranslation();
  const defaultAssignee = people.includes('共同') ? '共同' : people[0] || '共同';
  const resolvedPayerDefault = payerDefault !== undefined ? payerDefault : defaultPayer(people);
  const resolvedPaymentDefault = paymentDefault || 'cash';
  const payers = people.filter((p) => p && p !== '共同');
  const hasExternalScanner = typeof onRequestScan === 'function';
  const activeDraft = scanDraft || scanState?.draft || null;

  const [f, setF] = useState(() => {
    if (initial) {
      return {
        ...initial,
        category: initial.category || '飲食',
        date: normalizeDate(initial.date) || '',
        time: initial.time || initial.receiptTime || '',
        payer: initial.payer || resolvedPayerDefault,
        payment: initial.payment || resolvedPaymentDefault,
        amount: String(initial.originalAmount),
        subtotal: initial.subtotal ? String(initial.subtotal) : '',
        tax: initial.tax ? String(initial.tax) : '',
        taxRefund: initial.taxRefund ? String(initial.taxRefund) : '',
        discount: initial.discount ? String(initial.discount) : '',
        note: initial.note || '',
      };
    }
    const baseForm = {
      currency: 'JPY',
      amount: '',
      store: '',
      date: defaultDate || '',
      time: defaultTime(now),
      payer: resolvedPayerDefault,
      payment: resolvedPaymentDefault,
      place: '',
      category: '飲食',
      assignedTo: defaultAssignee,
      subtotal: '',
      tax: '',
      taxRefund: '',
      discount: '',
      note: '',
      scanned: false,
    };
    if (activeDraft) {
      return scanResultToFormFields(activeDraft, {
        defaultDate,
        now,
        currentForm: baseForm,
        payerDefault: resolvedPayerDefault,
        paymentDefault: resolvedPaymentDefault,
        defaultAssignee,
      });
    }
    return baseForm;
  });
  const [advanced, setAdvanced] = useState(false);
  const [demoScanned, setDemoScanned] = useState(() => Boolean(startScan && !hasExternalScanner));

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const amt = Number(f.amount) || 0;
  const activeRate = Number(rate) > 0 ? Number(rate) : 0.0526;
  const hkd = f.currency === 'HKD' ? amt : Math.round(amt * activeRate);

  const mockScan = () => {
    setF((s) => ({
      ...s,
      currency: 'JPY',
      amount: '1680',
      store: 'ローソン 河口湖駅前店',
      place: '河口湖',
      category: '飲食',
      scanned: true,
      date: s.date || defaultDate || '',
      time: '13:05',
    }));
    setDemoScanned(true);
  };

  const handleScanClick = () => {
    if (hasExternalScanner) {
      onRequestScan({ date: f.date || defaultDate || '', fromForm: true, currentForm: f });
      return;
    }
    mockScan();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!startScan || initial) return;
    if (hasExternalScanner) {
      onRequestScan({ date: defaultDate || '', fromForm: true, auto: true });
    } else {
      mockScan();
    }
  }, []);

  const appliedTokenRef = useRef(
    !initial && activeDraft ? scanState?.token || activeDraft : null,
  );

  useEffect(() => {
    if (!activeDraft || initial) return;
    const tokenKey = scanState?.token || activeDraft;
    if (appliedTokenRef.current === tokenKey) return;
    appliedTokenRef.current = tokenKey;
    setF((prev) =>
      scanResultToFormFields(activeDraft, {
        defaultDate,
        now,
        currentForm: prev,
        payerDefault: resolvedPayerDefault,
        paymentDefault: resolvedPaymentDefault,
        defaultAssignee,
      }),
    );
  }, [
    activeDraft,
    scanState?.token,
    initial,
    defaultDate,
    now,
    resolvedPayerDefault,
    resolvedPaymentDefault,
    defaultAssignee,
  ]);

  const saveBarRef = useRef(null);
  const catPillRefs = useRef([]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.scrollPaddingBottom;
    const prevBody = body.style.scrollPaddingBottom;
    html.style.scrollPaddingBottom = '7rem';
    body.style.scrollPaddingBottom = '7rem';
    return () => {
      html.style.scrollPaddingBottom = prevHtml;
      body.style.scrollPaddingBottom = prevBody;
    };
  }, []);

  const ensureFieldAboveSaveBar = (target) => {
    if (!target || typeof window === 'undefined') return;
    if (saveBarRef.current && saveBarRef.current.contains(target)) return;
    const rect = target.getBoundingClientRect?.();
    if (!rect || (rect.width === 0 && rect.height === 0)) return;
    const navEl =
      typeof document !== 'undefined' ? document.querySelector('[data-testid="nav"]') : null;
    const navRect = navEl?.getBoundingClientRect?.();
    const navTop =
      navRect && navRect.height > 0 && navRect.top > 0 ? navRect.top : window.innerHeight - 68;
    const barRect = saveBarRef.current?.getBoundingClientRect?.();
    const barPos =
      saveBarRef.current && typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(saveBarRef.current).position
        : '';
    const isFloatingBar = barPos === 'fixed' || barPos === 'sticky';
    const bottomLimit =
      isFloatingBar && barRect && barRect.top > 0 ? Math.min(barRect.top, navTop) : navTop;
    const safeBottom = bottomLimit - 16;
    const safeTop = 76;
    if (rect.bottom > safeBottom) {
      try {
        window.scrollBy({ top: rect.bottom - safeBottom, behavior: 'auto' });
      } catch {
        // Ignore unimplemented window.scrollBy in test environments
      }
    } else if (rect.top < safeTop) {
      try {
        window.scrollBy({ top: rect.top - safeTop, behavior: 'auto' });
      } catch {
        // Ignore unimplemented window.scrollBy in test environments
      }
    }
  };

  const handleFocusCapture = (e) => {
    const target = e.target;
    ensureFieldAboveSaveBar(target);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => ensureFieldAboveSaveBar(target));
    }
  };

  const blockReason = saveBlockReason({ amount: f.amount, store: f.store, t });
  const valid = !blockReason;
  const field =
    'min-h-11 w-full rounded-sm border border-ink-soft bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-route focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route';
  const label = 'mb-1 block font-hand text-sm font-bold text-ink-soft';
  const displayCategory = (cat) => t(`categories.${cat}`, { defaultValue: cat });
  const displayPerson = (name) => (name === '共同' ? t('expenseCard.shared') : name);
  const categoryOptions =
    f.category && !REF_CATEGORIES.includes(f.category)
      ? [...REF_CATEGORIES, f.category]
      : REF_CATEGORIES;
  const selectedCatIdx = categoryOptions.indexOf(f.category);
  const rovingCatIndex = selectedCatIdx >= 0 ? selectedCatIdx : 0;

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!valid) return;
    onSave({
      ...f,
      originalAmount: amt,
      hkdAmount: hkd,
      store: f.store.trim(),
      time: f.time || '',
      payer: f.payer,
      payment: f.payment,
    });
  };

  const eyebrow = t('notebook.addForm.eyebrow');
  const pageTitle = initial ? t('notebook.addForm.editTitle') : t('notebook.addForm.addTitle');

  return (
    <form
      onSubmit={submit}
      onFocusCapture={handleFocusCapture}
      data-testid="expense-form"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-3.5 px-4 pb-6 pt-4 scroll-pb-28 lg:mx-auto lg:max-w-2xl"
      style={{ scrollPaddingBottom: '7rem' }}
    >
      <div className="relative flex min-w-0 items-center gap-3">
        <button
          type="button"
          data-testid="back"
          aria-label={t('notebook.addForm.backAria')}
          onClick={onCancel}
          className="jr-btn-paper inline-flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        >
          {Icon.back('h-5 w-5')}
        </button>
        <div className="min-w-0 flex-1">
          {eyebrow && eyebrow !== pageTitle && (
            <p className="font-hand text-xs font-bold tracking-wider text-ink-soft">
              {eyebrow}
            </p>
          )}
          <h1 className="font-hand text-2xl font-bold leading-tight tracking-wider text-ink">
            {pageTitle}
          </h1>
        </div>
      </div>

      {!initial && (
        <div className="relative min-w-0">
          <button
            type="button"
            data-testid="form-scan"
            onClick={handleScanClick}
            className="jr-paper flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-sm border border-dashed border-ink-soft/65 bg-paper px-3 py-2.5 text-left transition-colors hover:bg-paper-shade/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            <WashBlob tone="wheat" shape={1} className="h-9 w-9 shrink-0">
              <JournalIcon name="camera" className="h-5 w-5 text-ink" />
            </WashBlob>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-hand text-sm font-bold text-ink">
                {t('notebook.addForm.scanTitle')}
              </span>
              <span
                data-testid="form-scan-status"
                className={`mt-0.5 block break-words text-meta leading-snug ${
                  scanState?.status === 'error' ? 'font-semibold text-stamp' : 'text-ink-muted'
                }`}
              >
                {scanState?.message ||
                  (activeDraft ? t('notebook.scan.ready') : '') ||
                  (demoScanned ? t('notebook.addForm.scanDemoReady') : '') ||
                  t('notebook.addForm.scanHint')}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Card 1: Amount & currency first */}
      <div className="jr-taped-card jr-ruled relative min-w-0 space-y-3 p-3.5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pb-0.5">
          <WashiLabel tone="kraft" tilt={-1}>
            {t('notebook.addForm.amountTitle')}
          </WashiLabel>
          <span className="whitespace-nowrap font-display text-meta font-bold tabular-nums text-route">
            ≈ {formatAccountingAmount(hkd, accountingCurrency)}
          </span>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="ref-currency" className={label}>
              {t('notebook.addForm.currencyLabel')}
            </label>
            <select
              id="ref-currency"
              aria-label={t('notebook.addForm.currencyAria')}
              value={f.currency}
              onChange={set('currency')}
              className={field}
            >
              <option value="JPY">{t('notebook.addForm.currencyJPY')}</option>
              <option value="HKD">{t('notebook.addForm.currencyHKD')}</option>
              {f.currency && f.currency !== 'JPY' && f.currency !== 'HKD' && (
                <option value={f.currency}>{f.currency}</option>
              )}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor="ref-amount" className={label}>
              {t('notebook.addForm.amountPaidLabel')}
            </label>
            <input
              id="ref-amount"
              data-testid="form-amount"
              aria-label={t('notebook.addForm.amountAria')}
              inputMode="decimal"
              value={f.amount}
              onChange={set('amount')}
              placeholder="0"
              className={`${field} font-display text-lg font-bold tabular-nums`}
            />
          </div>
        </div>

        {payers.length > 0 && (
          <div className="flex min-w-0 items-center justify-between gap-2 pt-0.5">
            <span className="shrink-0 whitespace-nowrap font-hand text-sm font-bold text-ink-soft">
              {t('notebook.addForm.payerLabel')}
            </span>
            <div
              className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label={t('notebook.addForm.payerLabel')}
            >
              {payers.map((name) => {
                const active = f.payer === name;
                return (
                  <button
                    key={name}
                    type="button"
                    data-testid={`form-payer-${name}`}
                    aria-pressed={active}
                    onClick={() => setF((s) => ({ ...s, payer: name }))}
                    className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border px-3.5 py-1.5 font-hand text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                      active
                        ? 'border-ink-soft bg-tape-navy text-paper'
                        : 'border-ink-soft/45 bg-paper text-ink hover:bg-paper-shade'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0 whitespace-nowrap font-hand text-sm font-bold text-ink-soft">
            {t('notebook.addForm.paymentMethodLabel')}
          </span>
          <div
            className="inline-flex items-center gap-1.5"
            role="group"
            aria-label={t('notebook.addForm.paymentMethodLabel')}
          >
            {[
              { id: 'cash', label: t('notebook.addForm.payCash'), testid: 'form-pay-cash' },
              { id: 'card', label: t('notebook.addForm.payCard'), testid: 'form-pay-card' },
            ].map((opt) => {
              const active = f.payment === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={opt.testid}
                  aria-pressed={active}
                  onClick={() => setF((s) => ({ ...s, payment: opt.id }))}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm border px-3.5 py-1.5 font-hand text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                    active
                      ? 'border-ink-soft bg-tape-navy text-paper'
                      : 'border-ink-soft/45 bg-paper text-ink hover:bg-paper-shade'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 2: Basic info */}
      <div className="jr-taped-card jr-ruled relative min-w-0 space-y-3 p-3.5">
        <div className="flex min-w-0 items-center justify-between gap-2 pb-0.5">
          <WashiLabel tone="kraft" tilt={-1}>
            {t('notebook.addForm.basicTitle')}
          </WashiLabel>
        </div>

        <div>
          <label htmlFor="ref-store" className={label}>
            {t('notebook.addForm.storeLabel')}
          </label>
          <input
            id="ref-store"
            className={field}
            value={f.store}
            onChange={set('store')}
            placeholder={t('notebook.addForm.storePlaceholder')}
            autoComplete="off"
          />
        </div>

        <div className="flex min-w-0 items-end gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex h-7 items-center justify-between">
              <label htmlFor="ref-date" className="font-hand text-sm font-bold text-ink-soft">
                {t('notebook.addForm.dateLabel')}
              </label>
              {f.date && (
                <button
                  type="button"
                  data-testid="form-clear-date"
                  onClick={() => setF((s) => ({ ...s, date: '' }))}
                  className="-my-2 inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-sm px-2 font-hand text-meta font-bold text-route hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
                >
                  {t('notebook.addForm.clearDate')}
                </button>
              )}
            </div>
            <div className={`${field} relative flex min-h-[46px] items-center justify-between`}>
              <span
                className={
                  f.date
                    ? 'whitespace-nowrap font-display tabular-nums text-ink'
                    : 'whitespace-nowrap text-ink-muted'
                }
              >
                {formatNotebookDate(f.date, { t, lang: activeI18n.language })}
              </span>
              <span className="text-ink-muted">{Icon.calendar('h-4 w-4')}</span>
              <input
                id="ref-date"
                type="date"
                value={f.date}
                onChange={set('date')}
                className="absolute inset-0 h-full min-h-11 w-full cursor-pointer opacity-0"
                aria-label={t('notebook.addForm.dateLabel')}
              />
            </div>
          </div>

          <div className="w-28 shrink-0">
            <div className="mb-1 flex h-7 items-center">
              <label htmlFor="ref-time" className="font-hand text-sm font-bold text-ink-soft">
                {t('notebook.addForm.timeLabel')}
              </label>
            </div>
            <div className={`${field} relative flex min-h-[46px] w-28 items-center justify-between`}>
              <span
                className={
                  f.time
                    ? 'whitespace-nowrap font-display tabular-nums text-ink'
                    : 'whitespace-nowrap font-display tabular-nums text-ink-muted'
                }
              >
                {f.time || '--:--'}
              </span>
              <span className="text-ink-muted">{Icon.clock('h-4 w-4')}</span>
              <input
                id="ref-time"
                data-testid="form-time"
                type="time"
                value={f.time || ''}
                onChange={set('time')}
                className="absolute inset-0 h-full min-h-11 w-full cursor-pointer opacity-0"
                aria-label={t('notebook.addForm.timeLabel')}
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="ref-place" className={label}>
            {t('notebook.addForm.placeLabel')}
          </label>
          <input
            id="ref-place"
            className={field}
            value={f.place}
            onChange={set('place')}
            placeholder={t('notebook.addForm.placePlaceholder')}
            autoComplete="off"
          />
        </div>

        <div>
          <span id="ref-cat-label" className={label}>
            {t('notebook.addForm.categoryLabel')}
          </span>
          <div
            data-testid="form-category-pills"
            role="radiogroup"
            aria-labelledby="ref-cat-label"
            className="flex flex-wrap gap-1.5 pt-0.5"
          >
            {categoryOptions.map((c, idx) => {
              const active = f.category === c;
              const washTone = CATEGORY_WASH_TONE[c] || 'leaf';
              const washShape = CATEGORY_WASH_SHAPE[c] || 1;
              return (
                <button
                  key={c}
                  ref={(el) => {
                    catPillRefs.current[idx] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={idx === rovingCatIndex ? 0 : -1}
                  data-testid={`form-cat-${c}`}
                  onClick={() => setF((s) => ({ ...s, category: c }))}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const nextIdx = (idx + 1) % categoryOptions.length;
                      const nextCat = categoryOptions[nextIdx];
                      setF((s) => ({ ...s, category: nextCat }));
                      catPillRefs.current[nextIdx]?.focus();
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prevIdx = (idx - 1 + categoryOptions.length) % categoryOptions.length;
                      const prevCat = categoryOptions[prevIdx];
                      setF((s) => ({ ...s, category: prevCat }));
                      catPillRefs.current[prevIdx]?.focus();
                    } else if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
                      e.preventDefault();
                      setF((s) => ({ ...s, category: c }));
                    }
                  }}
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border px-3 py-1.5 font-hand text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route ${
                    active
                      ? 'border-tape-navy bg-route-soft/80 text-route ring-1 ring-tape-navy'
                      : 'border-ink-soft/45 bg-paper text-ink hover:bg-paper-shade'
                  }`}
                >
                  <WashBlob tone={washTone} shape={washShape} className="h-6 w-6 shrink-0">
                    <JournalIcon name={c} className="h-3.5 w-3.5 text-ink" />
                  </WashBlob>
                  <span>{displayCategory(c)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="ref-who" className={label}>
            {t('notebook.addForm.assignToLabel')}
          </label>
          <select id="ref-who" className={field} value={f.assignedTo} onChange={set('assignedTo')}>
            {people.map((p) => (
              <option key={p} value={p}>
                {displayPerson(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-sm border border-ink-soft/45 bg-paper">
          <button
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between px-3 py-2.5 text-left font-hand text-sm font-bold text-ink-soft transition-colors hover:bg-paper-shade/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-route"
          >
            <span>{t('notebook.addForm.advancedToggle')}</span>
            <span className={`transition-transform ${advanced ? 'rotate-180' : ''}`}>
              {Icon.chevDown('h-3.5 w-3.5')}
            </span>
          </button>
          {advanced && (
            <div className="space-y-2 border-t border-dashed border-ink-soft/35 px-3 pb-3 pt-2">
              <p className="font-hand text-meta font-bold text-ink-muted">
                {t('notebook.addForm.taxSectionTitle')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="ref-subtotal" className="mb-0.5 block font-hand text-meta text-ink-muted">
                    {t('notebook.addForm.subtotalLabel')}
                  </label>
                  <input
                    id="ref-subtotal"
                    type="number"
                    value={f.subtotal}
                    onChange={set('subtotal')}
                    className={`${field} font-display tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="ref-tax" className="mb-0.5 block font-hand text-meta text-ink-muted">
                    {t('notebook.addForm.taxLabel')}
                  </label>
                  <input
                    id="ref-tax"
                    type="number"
                    value={f.tax}
                    onChange={set('tax')}
                    className={`${field} font-display tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="ref-refund" className="mb-0.5 block font-hand text-meta text-ink-muted">
                    {t('notebook.addForm.taxRefundLabel')}
                  </label>
                  <input
                    id="ref-refund"
                    type="number"
                    value={f.taxRefund}
                    onChange={set('taxRefund')}
                    className={`${field} font-display tabular-nums`}
                  />
                </div>
                <div>
                  <label htmlFor="ref-discount" className="mb-0.5 block font-hand text-meta text-ink-muted">
                    {t('notebook.addForm.discountLabel')}
                  </label>
                  <input
                    id="ref-discount"
                    type="number"
                    value={f.discount}
                    onChange={set('discount')}
                    className={`${field} font-display tabular-nums`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ref-note2" className="mb-0.5 block font-hand text-meta text-ink-muted">
                  {t('notebook.addForm.noteLabel')}
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

      {/* In-flow save bar at the bottom of the form content (above BottomNav on mobile) */}
      <div
        ref={saveBarRef}
        data-testid="form-save-bar"
        className="jr-taped-card relative min-w-0 bg-paper px-3.5 py-3"
      >
        {blockReason && (
          <p
            data-testid="form-save-hint"
            className="mb-2 text-center font-hand text-meta font-semibold text-ink-muted"
          >
            {blockReason}
          </p>
        )}
        <div className="flex min-w-0 gap-3">
          <button
            type="button"
            data-testid="form-cancel"
            onClick={onCancel}
            className="jr-btn-paper inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center whitespace-nowrap rounded-sm px-4 py-2.5 font-hand text-sm font-bold text-ink transition-colors hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          >
            {t('notebook.addForm.cancel')}
          </button>
          <button
            type="submit"
            data-testid="form-save"
            disabled={!valid}
            className="jr-btn-navy inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-4 py-2.5 font-hand text-sm font-bold text-paper transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route disabled:pointer-events-none disabled:opacity-50"
          >
            {Icon.check('h-4 w-4')}
            <span>{t('notebook.addForm.save')}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
