import { useId, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createEmptyRowDraft, withDraftField, withoutDraftRow } from './receiptItemDraft';
import { readCurrencyValue } from './receiptItemsDisplay';

const wrapStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
};

const inputStyle = {
  fontSize: 16,
  minHeight: 44,
  maxWidth: '100%',
};

const buttonStyle = {
  minHeight: 44,
  minWidth: 44,
};

const fieldClass =
  'box-border min-h-11 w-full min-w-0 max-w-full rounded-sm border border-ink-soft bg-paper px-3 py-2 text-ink';

function rowCurrency(row, receiptCurrency) {
  const raw = row?.raw;
  if (raw && typeof raw === 'object') {
    const own = readCurrencyValue(raw.originalCurrency ?? raw.currency);
    if (own) return own;
  }
  return receiptCurrency || '';
}

function fieldError(errors, key, field) {
  return errors.find((error) => error.key === key && error.field === field) || null;
}

function hasDistinctActual(row) {
  const actual = row?.fields?.priceActual;
  if (!actual?.present) return false;
  const printedText = String(row.fields?.price?.text ?? '').trim();
  const actualText = String(actual.text ?? '').trim();
  if (actualText === '') return true;
  const printed = Number(printedText);
  const paid = Number(actualText);
  if (Number.isFinite(printed) && Number.isFinite(paid)) return paid !== printed;
  return actualText !== printedText;
}

const ERROR_FIELD_ID = {
  name: 'name',
  price: 'price',
  priceActual: 'actual',
  quantity: 'qty',
};

function focusFirstInvalid(uid, errors) {
  const first = Array.isArray(errors) ? errors[0] : null;
  if (!first) return;
  const suffix = ERROR_FIELD_ID[first.field];
  if (!suffix) return;
  document.getElementById(`${uid}-${suffix}-${first.key}`)?.focus();
}

function isCompositionKey(event) {
  const code = event.keyCode || event.which || event.nativeEvent?.keyCode || event.nativeEvent?.which || 0;
  return Boolean(event.isComposing || event.nativeEvent?.isComposing || code === 229);
}

function onRowKeyDown(event) {
  const composing = isCompositionKey(event);
  if (event.key !== 'Enter' && !composing) return;
  if (composing) return;
  if (event.key === 'Enter') event.preventDefault();
}

export default function ReceiptItemsEditor({
  drafts,
  currency = '',
  errors = [],
  onChange,
  nextRowKey,
  revealToken = 0,
  composingRef,
}) {
  const { t } = useTranslation();
  const uid = useId().replace(/:/g, '');
  const addId = `${uid}-add`;
  const focusRef = useRef(null);
  const errorsRef = useRef(errors);
  errorsRef.current = errors;
  const list = Array.isArray(drafts) ? drafts : [];

  useLayoutEffect(() => {
    const pending = focusRef.current;
    if (!pending) return;
    focusRef.current = null;
    const id = pending === 'add' ? addId : `${uid}-name-${pending}`;
    document.getElementById(id)?.focus();
  }, [list, addId, uid]);

  useLayoutEffect(() => {
    if (!revealToken) return;
    focusFirstInvalid(uid, errorsRef.current);
  }, [revealToken, uid]);

  const markComposing = (delta) => {
    if (!composingRef) return;
    composingRef.current = Math.max(0, composingRef.current + delta);
  };

  const changeField = (key, field) => (event) => {
    onChange(withDraftField(list, key, field, event.target.value));
  };

  const addRow = () => {
    const row = createEmptyRowDraft(nextRowKey());
    focusRef.current = row.key;
    onChange([...list, row]);
  };

  const removeRow = (key) => {
    const index = list.findIndex((row) => row.key === key);
    const next = withoutDraftRow(list, key);
    const neighbor = next[index] || next[index - 1] || null;
    focusRef.current = neighbor ? neighbor.key : 'add';
    onChange(next);
  };

  const compositionHandlers = {
    onCompositionStart: () => markComposing(1),
    onCompositionEnd: () => markComposing(-1),
    onBlur: () => {
      if (composingRef) composingRef.current = 0;
    },
  };

  return (
    <div data-noswipe data-testid="receipt-item-editor" className="min-w-0 max-w-full" style={wrapStyle}>
      <ul data-testid="receipt-item-editor-list" className="m-0 list-none space-y-2 p-0" style={wrapStyle}>
        {list.map((row) => {
          if (row.kind === 'passthrough') {
            return (
              <li
                key={row.key}
                data-noswipe
                data-testid="receipt-item-preserved"
                className="flex min-w-0 max-w-full items-center gap-2 py-1"
                style={wrapStyle}
              >
                <p className="m-0 min-w-0 flex-1 break-words text-sm text-ink-soft" style={wrapStyle}>
                  {t('notebook.receiptItems.preserved')}
                </p>
                <button
                  type="button"
                  data-testid="receipt-item-remove"
                  onClick={() => removeRow(row.key)}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft px-3 py-2 text-left font-hand text-sm font-bold text-ink"
                  style={buttonStyle}
                >
                  {t('notebook.receiptItems.removeRow')}
                </button>
              </li>
            );
          }
          const code = rowCurrency(row, currency);
          const nameId = `${uid}-name-${row.key}`;
          const priceId = `${uid}-price-${row.key}`;
          const actualId = `${uid}-actual-${row.key}`;
          const qtyId = `${uid}-qty-${row.key}`;
          const nameError = fieldError(errors, row.key, 'name');
          const priceError = fieldError(errors, row.key, 'price');
          const actualError = fieldError(errors, row.key, 'priceActual');
          const qtyError = fieldError(errors, row.key, 'quantity');
          const amountLabel = code
            ? t('notebook.receiptItems.printedAmountLabel', { currency: code })
            : t('notebook.receiptItems.printedAmountLabelPlain');
          const showActual = hasDistinctActual(row);
          const showQty = Boolean(row.fields.quantity.present);
          return (
            <li
              key={row.key}
              data-noswipe
              data-testid="receipt-item-editor-row"
              className="min-w-0 max-w-full space-y-1 py-1"
              style={wrapStyle}
            >
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1" style={wrapStyle}>
                  <label htmlFor={nameId} className="sr-only">
                    {t('notebook.receiptItems.nameLabel')}
                  </label>
                  <input
                    id={nameId}
                    data-testid="receipt-item-name"
                    type="text"
                    autoComplete="off"
                    placeholder={t('notebook.receiptItems.namePlaceholder')}
                    value={row.fields.name.text}
                    onChange={changeField(row.key, 'name')}
                    onKeyDown={onRowKeyDown}
                    {...compositionHandlers}
                    aria-invalid={nameError ? 'true' : 'false'}
                    aria-describedby={nameError ? `${nameId}-error` : undefined}
                    className={fieldClass}
                    style={inputStyle}
                  />
                  {nameError && (
                    <p id={`${nameId}-error`} role="alert" className="m-0 mt-1 break-words text-sm text-stamp" style={wrapStyle}>
                      {t(`notebook.receiptItems.${nameError.code}`)}
                    </p>
                  )}
                </div>
                <div className="w-24 shrink-0 sm:w-28" style={wrapStyle}>
                  <label htmlFor={priceId} className="sr-only">
                    {amountLabel}
                  </label>
                  {code ? (
                    <span data-testid="receipt-item-currency" className="sr-only">
                      {code}
                    </span>
                  ) : null}
                  <p id={`${priceId}-hint`} className="sr-only">
                    {t('notebook.receiptItems.printedAmountHint')}
                  </p>
                  <input
                    id={priceId}
                    data-testid="receipt-item-price-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t('notebook.receiptItems.amountPlaceholder')}
                    value={row.fields.price.text}
                    onChange={changeField(row.key, 'price')}
                    onKeyDown={onRowKeyDown}
                    {...compositionHandlers}
                    aria-invalid={priceError ? 'true' : 'false'}
                    aria-describedby={priceError ? `${priceId}-error` : `${priceId}-hint`}
                    className={`${fieldClass} font-display tabular-nums`}
                    style={inputStyle}
                  />
                  {priceError && (
                    <p id={`${priceId}-error`} role="alert" className="m-0 mt-1 break-words text-sm text-stamp" style={wrapStyle}>
                      {t(`notebook.receiptItems.${priceError.code}`)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="receipt-item-remove"
                  onClick={() => removeRow(row.key)}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm border border-ink-soft px-3 py-2 text-left font-hand text-sm font-bold text-ink"
                  style={buttonStyle}
                >
                  {t('notebook.receiptItems.removeRow')}
                </button>
              </div>
              {showActual && (
                <div className="min-w-0" style={wrapStyle}>
                  <label htmlFor={actualId} className="mb-1 block font-hand text-sm font-bold text-ink-soft">
                    {t('notebook.receiptItems.actualAmountLabel', { currency: code })}
                  </label>
                  <input
                    id={actualId}
                    data-testid="receipt-item-actual-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.fields.priceActual.text}
                    onChange={changeField(row.key, 'priceActual')}
                    onKeyDown={onRowKeyDown}
                    {...compositionHandlers}
                    aria-invalid={actualError ? 'true' : 'false'}
                    aria-describedby={actualError ? `${actualId}-error` : undefined}
                    className={`${fieldClass} font-display tabular-nums`}
                    style={inputStyle}
                  />
                  {actualError && (
                    <p id={`${actualId}-error`} role="alert" className="m-0 mt-1 break-words text-sm text-stamp" style={wrapStyle}>
                      {t(`notebook.receiptItems.${actualError.code}`)}
                    </p>
                  )}
                </div>
              )}
              {showQty && (
                <div className="min-w-0" style={wrapStyle}>
                  <label htmlFor={qtyId} className="mb-1 block font-hand text-sm font-bold text-ink-soft">
                    {t('notebook.receiptItems.quantityLabel')}
                  </label>
                  <input
                    id={qtyId}
                    data-testid="receipt-item-qty-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={row.fields.quantity.text}
                    onChange={changeField(row.key, 'quantity')}
                    onKeyDown={onRowKeyDown}
                    {...compositionHandlers}
                    aria-invalid={qtyError ? 'true' : 'false'}
                    aria-describedby={qtyError ? `${qtyId}-error` : undefined}
                    className={`${fieldClass} font-display tabular-nums`}
                    style={inputStyle}
                  />
                  {qtyError && (
                    <p id={`${qtyId}-error`} role="alert" className="m-0 mt-1 break-words text-sm text-stamp" style={wrapStyle}>
                      {t(`notebook.receiptItems.${qtyError.code}`)}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        id={addId}
        type="button"
        data-testid="receipt-item-add"
        onClick={addRow}
        className="mt-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-ink-soft px-3 py-2 font-hand text-sm font-bold text-ink"
        style={buttonStyle}
      >
        {t('notebook.receiptItems.addRow')}
      </button>
    </div>
  );
}
