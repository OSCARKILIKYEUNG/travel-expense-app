import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import { buildSettlementRow } from './refRepayment';

const hk = (n) => `HK$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/**
 * Controlled repayment form for recording or editing a settlement repayment.
 * Fits within 390px screens with ≥44px touch targets and paper-diary styling.
 */
export default function RepaymentForm({
  participants = [],
  initial = null,
  accountingCurrency = 'HKD',
  tripCurrency = 'JPY',
  rate = 0.0526,
  oweAmount = 0,
  transfers = null,
  today = '',
  onSave,
  onDelete,
  onCancel,
}) {
  const { t } = useTranslation();

  const cleanParticipants = useMemo(
    () =>
      (Array.isArray(participants) ? participants : [])
        .map((p) => String(p ?? '').trim())
        .filter((p) => p && p !== '共同'),
    [participants],
  );

  const accCode = String(accountingCurrency || 'HKD').trim().toUpperCase() || 'HKD';
  const tripCode = String(tripCurrency || 'JPY').trim().toUpperCase() || 'JPY';

  const [from, setFrom] = useState(() => String(initial?.from ?? '').trim());
  const [to, setTo] = useState(() => String(initial?.to ?? '').trim());
  const [amount, setAmount] = useState(() =>
    initial?.amount !== undefined && initial?.amount !== null && initial?.amount !== ''
      ? String(initial.amount)
      : '',
  );
  const [currency, setCurrency] = useState(
    () => String(initial?.currency || accCode).trim().toUpperCase() || accCode,
  );
  const [date, setDate] = useState(() =>
    initial?.date !== undefined && initial?.date !== null ? String(initial.date) : today || '',
  );
  const [note, setNote] = useState(() => (initial?.note != null ? String(initial.note) : ''));

  useEffect(() => {
    setFrom(String(initial?.from ?? '').trim());
    setTo(String(initial?.to ?? '').trim());
    setAmount(
      initial?.amount !== undefined && initial?.amount !== null && initial?.amount !== ''
        ? String(initial.amount)
        : '',
    );
    setCurrency(String(initial?.currency || accCode).trim().toUpperCase() || accCode);
    setDate(
      initial?.date !== undefined && initial?.date !== null ? String(initial.date) : today || '',
    );
    setNote(initial?.note != null ? String(initial.note) : '');
  }, [
    initial?.id,
    initial?.from,
    initial?.to,
    initial?.amount,
    initial?.currency,
    initial?.date,
    initial?.note,
    accCode,
    today,
  ]);

  const currencyOptions = useMemo(() => {
    const set = new Set([accCode, tripCode]);
    if (currency) set.add(currency);
    return [...set];
  }, [accCode, tripCode, currency]);

  const preview = useMemo(
    () =>
      buildSettlementRow(
        {
          id: initial?.id,
          from,
          to,
          amount,
          currency,
          date,
          note,
        },
        {
          accountingCurrency: accCode,
          tripCurrency: tripCode,
          rate,
        },
      ),
    [initial?.id, from, to, amount, currency, date, note, accCode, tripCode, rate],
  );

  const effectiveOweAmount = useMemo(() => {
    if (Array.isArray(transfers)) {
      const matched = transfers.find((tr) => tr.from === from && tr.to === to);
      if (matched && Number(matched.amount) > 0) {
        return Math.round(Number(matched.amount));
      }
      if (initial?.from === from && initial?.to === to && Number(oweAmount) > 0) {
        return Math.round(Number(oweAmount));
      }
      return 0;
    }
    const n = Number(oweAmount);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [oweAmount, transfers, from, to, initial?.from, initial?.to]);

  const isOverpay = effectiveOweAmount > 0 && preview.hkdAmount > effectiveOweAmount;
  const isValid =
    Boolean(from) &&
    Boolean(to) &&
    from !== to &&
    Number(amount) > 0 &&
    preview.hkdAmount > 0;

  const fromUnknown = Boolean(from) && !cleanParticipants.includes(from);
  const toUnknown = Boolean(to) && !cleanParticipants.includes(to);
  const displayPerson = (name) => (name === '共同' ? t('expenseCard.shared') : name);

  const handleFromChange = (e) => {
    const nextFrom = e.target.value;
    setFrom(nextFrom);
    if (nextFrom && nextFrom === to && cleanParticipants.length >= 2) {
      const alt = cleanParticipants.find((p) => p !== nextFrom);
      if (alt) setTo(alt);
    }
  };

  const handleToChange = (e) => {
    const nextTo = e.target.value;
    setTo(nextTo);
    if (nextTo && nextTo === from && cleanParticipants.length >= 2) {
      const alt = cleanParticipants.find((p) => p !== nextTo);
      if (alt) setFrom(alt);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!isValid) return;
    onSave?.(preview);
  };

  const fieldClass =
    'h-11 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-teal';
  const labelClass = 'mb-1 block truncate whitespace-nowrap text-meta font-medium text-ink-muted';

  return (
    <form
      data-testid="repayment-form"
      onSubmit={handleSubmit}
      noValidate
      className="min-w-0 space-y-2.5 rounded-xl border border-line bg-cream p-3"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h4 className="min-w-0 truncate font-display text-sm font-bold text-ink">
          {initial?.id ? t('notebook.settle.edit') : t('notebook.settle.recordRepayment')}
        </h4>
        {currency !== accCode && preview.hkdAmount > 0 && (
          <span className="shrink-0 whitespace-nowrap font-mono text-meta font-semibold text-teal-strong">
            ≈ {hk(preview.hkdAmount)}
          </span>
        )}
      </div>

      {/* From / To selects */}
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <label htmlFor="repayment-from-select" className={labelClass}>
            {t('notebook.settle.from')}
          </label>
          <select
            id="repayment-from-select"
            data-testid="repayment-from"
            aria-label={t('notebook.settle.from')}
            value={from}
            onChange={handleFromChange}
            className={fieldClass}
          >
            {!from && <option value="">—</option>}
            {fromUnknown && (
              <option value={from}>
                {displayPerson(from)} ({t('notebook.settle.unknownMember')})
              </option>
            )}
            {cleanParticipants.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor="repayment-to-select" className={labelClass}>
            {t('notebook.settle.to')}
          </label>
          <select
            id="repayment-to-select"
            data-testid="repayment-to"
            aria-label={t('notebook.settle.to')}
            value={to}
            onChange={handleToChange}
            className={fieldClass}
          >
            {!to && <option value="">—</option>}
            {toUnknown && (
              <option value={to}>
                {displayPerson(to)} ({t('notebook.settle.unknownMember')})
              </option>
            )}
            {cleanParticipants.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount & Currency */}
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <label htmlFor="repayment-amount-input" className={labelClass}>
            {t('notebook.settle.amount')}
          </label>
          <input
            id="repayment-amount-input"
            data-testid="repayment-amount"
            aria-label={t('notebook.settle.amount')}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="repayment-currency-select" className={labelClass}>
            {t('notebook.settle.currency')}
          </label>
          <select
            id="repayment-currency-select"
            data-testid="repayment-currency"
            aria-label={t('notebook.settle.currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date & Note */}
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <label htmlFor="repayment-date-input" className={labelClass}>
            {t('notebook.settle.date')}
          </label>
          <input
            id="repayment-date-input"
            data-testid="repayment-date"
            aria-label={t('notebook.settle.date')}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${fieldClass} font-mono`}
          />
        </div>

        <div className="min-w-0">
          <label htmlFor="repayment-note-input" className={labelClass}>
            {t('notebook.settle.note')}
          </label>
          <input
            id="repayment-note-input"
            data-testid="repayment-note"
            aria-label={t('notebook.settle.note')}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('notebook.settle.note')}
            className={fieldClass}
          />
        </div>
      </div>

      {/* Overpay warning (allowed, not blocked) */}
      {isOverpay && (
        <p
          role="status"
          data-testid="repayment-overpay-warning"
          className="min-w-0 break-words rounded-xl border border-mustard-ink/30 bg-mustard-soft px-3 py-2 text-meta font-semibold text-mustard-ink"
        >
          {t('notebook.settle.overpayWarning', { amount: hk(effectiveOweAmount) })}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 pt-1">
        {onDelete && (
          <button
            type="button"
            data-testid="repayment-delete"
            onClick={() => onDelete(initial)}
            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-coral-ink/30 bg-coral-soft px-3.5 text-meta font-bold text-coral-ink transition-colors hover:bg-coral-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-ink"
          >
            {t('notebook.settle.delete')}
          </button>
        )}
        {onCancel && (
          <button
            type="button"
            data-testid="repayment-cancel"
            onClick={onCancel}
            className="inline-flex h-11 min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-cream-soft px-3.5 text-meta font-semibold text-ink-soft transition-colors hover:bg-beige focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {t('notebook.settle.cancel')}
          </button>
        )}
        <button
          type="submit"
          data-testid="repayment-save"
          disabled={!isValid}
          className="inline-flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center whitespace-nowrap rounded-xl bg-teal-strong px-4 text-meta font-bold text-white shadow-sm transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-50"
        >
          {t('notebook.settle.save')}
        </button>
      </div>
    </form>
  );
}
