import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import {
  addIncludedTaxRow,
  clearIncludedTaxAmount,
  clearIncludedTaxRows,
  commitIncludedTaxDraft,
  includedTaxPrintedMismatch,
  removeIncludedTaxRow,
  withIncludedTaxAmountText,
  withIncludedTaxRow,
} from '../../domain/includedTax';

const inputStyle = { fontSize: 16, minHeight: 44, maxWidth: '100%' };
const buttonStyle = { minHeight: 44, minWidth: 44 };

function isCompositionKey(event) {
  const code = event.keyCode || event.which || event.nativeEvent?.keyCode || event.nativeEvent?.which || 0;
  return Boolean(event.isComposing || event.nativeEvent?.isComposing || code === 229);
}

function onRowKeyDown(event) {
  if (isCompositionKey(event)) return;
  if (event.key === 'Enter') event.preventDefault();
}

function formatPrinted(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Object.is(value, -0) ? '0' : String(value);
}

function basisLabel(t, basis) {
  if (basis === 'gross') return t('notebook.includedTax.basisGross');
  if (basis === 'net') return t('notebook.includedTax.basisNet');
  return t('notebook.includedTax.basisUnknown');
}

export function IncludedTaxSummary({
  includedTaxAmount,
  includedTaxBreakdown,
  currency = '',
}) {
  const { t } = useTranslation();
  const hasAmount = typeof includedTaxAmount === 'number' && Number.isFinite(includedTaxAmount);
  const rows = Array.isArray(includedTaxBreakdown) ? includedTaxBreakdown : [];
  if (!hasAmount && rows.length === 0) return null;
  const code = currency ? `${currency} ` : '';
  const mismatch = includedTaxPrintedMismatch({ includedTaxAmount, includedTaxBreakdown: rows });

  const containedStyle = {
    minWidth: 0,
    maxWidth: '100%',
    overflowWrap: 'anywhere',
    whiteSpace: 'normal',
  };

  return (
    <div data-testid="included-tax-summary" className="mt-1 min-w-0 max-w-full break-words" style={containedStyle}>
      <p className="m-0 min-w-0 max-w-full break-words font-hand text-sm font-bold text-ink" style={containedStyle}>
        {t('notebook.includedTax.toggle')}
      </p>
      {hasAmount && (
        <p className="m-0 min-w-0 max-w-full break-words font-display text-sm tabular-nums text-ink" style={containedStyle}>
          {t('notebook.includedTax.summaryAmount', { amount: `${code}${formatPrinted(includedTaxAmount)}` })}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="m-0 min-w-0 max-w-full list-none p-0" style={containedStyle}>
          {rows.map((row, index) => (
            <li key={`${index}-${row.ratePercent ?? ''}-${row.targetAmount ?? ''}`} data-testid="included-tax-summary-row" className="min-w-0 max-w-full break-words font-display text-sm tabular-nums text-ink-soft" style={containedStyle}>
              {row.ratePercent != null ? `${formatPrinted(row.ratePercent)}% ` : ''}
              {basisLabel(t, row.basis)}
              {row.targetAmount != null ? ` ${code}${formatPrinted(row.targetAmount)}` : ''}
              {row.includedTaxAmount != null ? ` / ${code}${formatPrinted(row.includedTaxAmount)}` : ''}
            </li>
          ))}
        </ul>
      )}
      {mismatch && (
        <p data-testid="included-tax-mismatch" className="m-0 break-words text-sm text-ink-soft">
          {t('notebook.includedTax.mismatch')}
        </p>
      )}
    </div>
  );
}

const ERROR_TEXT = {
  amount: 'notebook.includedTax.amountInvalid',
  rate: 'notebook.includedTax.rateInvalid',
  target: 'notebook.includedTax.targetInvalid',
  tax: 'notebook.includedTax.rowTaxInvalid',
  row: 'notebook.includedTax.rowEmpty',
};

export default function IncludedTaxSection({
  draft,
  currency = '',
  errors = [],
  revealToken = 0,
  onChange,
  nextRowKey,
  composingRef,
}) {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const panelId = `${uid}-panel`;
  const amountId = `${uid}-amount`;
  const amountHintId = `${uid}-amount-hint`;
  const amountErrorId = `${uid}-amount-error`;
  const recognized = draft?.amount?.mode === 'value' || draft?.rowsMode === 'rows';
  const [open, setOpen] = useState(recognized);
  const [seenReveal, setSeenReveal] = useState(revealToken);
  if (seenReveal !== revealToken) {
    setSeenReveal(revealToken);
    if (revealToken && Array.isArray(errors) && errors.length) setOpen(true);
  }

  const amountError = errors.find((error) => error.field === 'amount');
  const committed = commitIncludedTaxDraft(draft);
  const mismatch = committed.ok && includedTaxPrintedMismatch(committed.patch);
  const markComposing = (delta) => {
    if (!composingRef) return;
    composingRef.current = Math.max(0, composingRef.current + delta);
  };

  return (
    <div data-noswipe data-testid="included-tax" className="min-w-0 max-w-full">
      <button
        type="button"
        data-testid="included-tax-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(open ? 'notebook.includedTax.collapseAria' : 'notebook.includedTax.expandAria')}
        onClick={() => setOpen((value) => !value)}
        className="jr-btn-paper flex w-full items-center rounded-sm px-2 py-1 text-left font-hand text-sm font-bold text-ink"
        style={buttonStyle}
      >
        {t('notebook.includedTax.toggle')}
      </button>
      {open && (
        <div id={panelId} data-testid="included-tax-panel" className="min-w-0 space-y-2 px-1 py-2">
          <p className="m-0 break-words text-sm text-ink-soft">{t('notebook.includedTax.hint')}</p>
          <div>
            <label htmlFor={amountId} className="mb-1 block text-sm font-bold text-ink">
              {t('notebook.includedTax.amountLabel')}
            </label>
            <input
              id={amountId}
              data-testid="included-tax-amount"
              data-mode={draft.amount.mode}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={draft.amount.text}
              aria-invalid={amountError ? 'true' : 'false'}
              aria-describedby={amountError ? `${amountHintId} ${amountErrorId}` : amountHintId}
              onChange={(event) => onChange(withIncludedTaxAmountText(draft, event.target.value))}
              onKeyDown={onRowKeyDown}
              onCompositionStart={() => markComposing(1)}
              onCompositionEnd={() => markComposing(-1)}
              onBlur={() => {
                if (composingRef) composingRef.current = 0;
              }}
              className="w-full rounded-sm border border-ink-soft bg-paper px-3 text-ink"
              style={inputStyle}
            />
            <p id={amountHintId} className="m-0 break-words text-sm text-ink-soft">
              {t('notebook.includedTax.amountHint')}
            </p>
            {amountError && (
              <p id={amountErrorId} role="alert" data-testid="included-tax-error" className="m-0 break-words text-sm text-stamp">
                {t(ERROR_TEXT.amount)}
              </p>
            )}
          </div>
          <button
            type="button"
            data-testid="included-tax-clear-amount"
            onClick={() => onChange(clearIncludedTaxAmount(draft))}
            className="inline-flex items-center justify-center rounded-sm border border-ink-soft px-3 font-hand text-sm font-bold text-ink"
            style={buttonStyle}
          >
            {t('notebook.includedTax.clearAmount')}
          </button>
          <ul className="m-0 list-none space-y-2 p-0">
            {draft.rows.map((row, index) => {
              const n = index + 1;
              const rowErrors = errors.filter((error) => error.key === row.key);
              return (
                <li key={row.key} data-testid="included-tax-row" className="min-w-0 space-y-1">
                  <label className="block text-sm font-bold text-ink" htmlFor={`${uid}-rate-${row.key}`}>
                    {t('notebook.includedTax.rateLabel', { n })}
                  </label>
                  <input
                    id={`${uid}-rate-${row.key}`}
                    data-testid="included-tax-rate"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.rateText}
                    aria-invalid={rowErrors.some((error) => error.field === 'rate') ? 'true' : 'false'}
                    onChange={(event) => onChange(withIncludedTaxRow(draft, row.key, 'rateText', event.target.value))}
                    onKeyDown={onRowKeyDown}
                    onCompositionStart={() => markComposing(1)}
                    onCompositionEnd={() => markComposing(-1)}
                    className="w-full rounded-sm border border-ink-soft bg-paper px-3 text-ink"
                    style={inputStyle}
                  />
                  <label className="block text-sm font-bold text-ink" htmlFor={`${uid}-target-${row.key}`}>
                    {t('notebook.includedTax.targetLabel', { n })}
                  </label>
                  <input
                    id={`${uid}-target-${row.key}`}
                    data-testid="included-tax-target"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.targetText}
                    aria-invalid={rowErrors.some((error) => error.field === 'target') ? 'true' : 'false'}
                    onChange={(event) => onChange(withIncludedTaxRow(draft, row.key, 'targetText', event.target.value))}
                    onKeyDown={onRowKeyDown}
                    onCompositionStart={() => markComposing(1)}
                    onCompositionEnd={() => markComposing(-1)}
                    className="w-full rounded-sm border border-ink-soft bg-paper px-3 text-ink"
                    style={inputStyle}
                  />
                  <label className="block text-sm font-bold text-ink" htmlFor={`${uid}-basis-${row.key}`}>
                    {t('notebook.includedTax.basisLabel', { n })}
                  </label>
                  <select
                    id={`${uid}-basis-${row.key}`}
                    data-testid="included-tax-basis"
                    value={row.basis}
                    onChange={(event) => onChange(withIncludedTaxRow(draft, row.key, 'basis', event.target.value))}
                    onKeyDown={onRowKeyDown}
                    className="w-full rounded-sm border border-ink-soft bg-paper px-3 text-ink"
                    style={inputStyle}
                  >
                    <option value="gross">{t('notebook.includedTax.basisGross')}</option>
                    <option value="net">{t('notebook.includedTax.basisNet')}</option>
                    <option value="unknown">{t('notebook.includedTax.basisUnknown')}</option>
                  </select>
                  <label className="block text-sm font-bold text-ink" htmlFor={`${uid}-tax-${row.key}`}>
                    {t('notebook.includedTax.rowTaxLabel', { n, currency: currency || '' })}
                  </label>
                  <input
                    id={`${uid}-tax-${row.key}`}
                    data-testid="included-tax-row-tax"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.taxText}
                    aria-invalid={rowErrors.some((error) => error.field === 'tax' || error.field === 'row') ? 'true' : 'false'}
                    onChange={(event) => onChange(withIncludedTaxRow(draft, row.key, 'taxText', event.target.value))}
                    onKeyDown={onRowKeyDown}
                    onCompositionStart={() => markComposing(1)}
                    onCompositionEnd={() => markComposing(-1)}
                    className="w-full rounded-sm border border-ink-soft bg-paper px-3 text-ink"
                    style={inputStyle}
                  />
                  {rowErrors.map((error) => (
                    <p key={`${error.field}`} role="alert" data-testid="included-tax-error" className="m-0 break-words text-sm text-stamp">
                      {t(ERROR_TEXT[error.field] || ERROR_TEXT.row)}
                    </p>
                  ))}
                  <button
                    type="button"
                    data-testid="included-tax-remove-row"
                    onClick={() => onChange(removeIncludedTaxRow(draft, row.key))}
                    className="inline-flex items-center justify-center rounded-sm border border-ink-soft px-3 font-hand text-sm font-bold text-ink"
                    style={buttonStyle}
                  >
                    {t('notebook.includedTax.removeRow', { n })}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="included-tax-add-row"
              onClick={() => onChange(addIncludedTaxRow(draft, nextRowKey()))}
              className="inline-flex items-center justify-center rounded-sm border border-ink-soft px-3 font-hand text-sm font-bold text-ink"
              style={buttonStyle}
            >
              {t('notebook.includedTax.addRow')}
            </button>
            <button
              type="button"
              data-testid="included-tax-clear-rows"
              onClick={() => onChange(clearIncludedTaxRows(draft))}
              className="inline-flex items-center justify-center rounded-sm border border-ink-soft px-3 font-hand text-sm font-bold text-ink"
              style={buttonStyle}
            >
              {t('notebook.includedTax.clearRows')}
            </button>
          </div>
          {mismatch && (
            <p data-testid="included-tax-mismatch" className="m-0 break-words text-sm text-ink-soft">
              {t('notebook.includedTax.mismatch')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
