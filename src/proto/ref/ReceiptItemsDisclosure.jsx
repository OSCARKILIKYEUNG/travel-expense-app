import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../i18n';
import ReceiptItemsEditor from './ReceiptItemsEditor';
import {
  formatRecordedAmount,
  normalizeReceiptItemsForDisplay,
} from './receiptItemsDisplay';

const wrapStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
};

const frameStyle = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflowWrap: 'anywhere',
};

function amountLabel(code, value) {
  const formatted = formatRecordedAmount(value);
  return code ? `${code} ${formatted}` : formatted;
}

function Chevron({ open }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0"
      style={{ transform: open ? 'rotate(90deg)' : 'none' }}
    >
      <path
        d="M7 4.5 13 10 7 15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Collapsed chevron for scan lines. Saved cards stay read-only. The form can pass an editor draft. */
export default function ReceiptItemsDisclosure({
  items,
  currency = '',
  scanned = false,
  identity = '',
  editable = false,
  drafts = null,
  onDraftsChange,
  nextRowKey,
  errors = [],
  revealToken = 0,
  onEditDetails,
  composingRef,
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage || i18n.language || 'zh-TW';
  const view = normalizeReceiptItemsForDisplay(items, { lang, scanned });
  const reactId = useId();
  const panelId = `${reactId}-panel`;
  const buttonId = `${reactId}-button`;
  const [open, setOpen] = useState(false);
  const [seenIdentity, setSeenIdentity] = useState(identity);
  const [seenReveal, setSeenReveal] = useState(revealToken);

  if (seenIdentity !== identity) {
    setSeenIdentity(identity);
    setOpen(false);
  }

  // A blocked form save can reopen this editor. Saved cards never pass a token.
  if (seenReveal !== revealToken) {
    setSeenReveal(revealToken);
    if (editable && revealToken && Array.isArray(errors) && errors.length) setOpen(true);
  }

  const editorDrafts = Array.isArray(drafts) ? drafts : [];
  if (!view.show && !editable) return null;

  return (
    <div
      data-noswipe
      data-testid="receipt-items"
      className="mt-1 min-w-0 max-w-full"
      style={frameStyle}
    >
      <button
        id={buttonId}
        type="button"
        data-noswipe
        data-testid="receipt-items-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t(open ? 'notebook.receiptItems.collapseAria' : 'notebook.receiptItems.expandAria')}
        onClick={() => setOpen((value) => !value)}
        className="jr-btn-paper flex w-full min-h-11 min-w-11 max-w-full items-center gap-2 rounded-sm px-2 py-1 text-left font-hand text-sm font-bold text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
        style={{ minHeight: 44, minWidth: 44, maxWidth: '100%', whiteSpace: 'normal' }}
      >
        <Chevron open={open} />
        <span className="min-w-0 break-words" style={wrapStyle}>{t('notebook.receiptItems.toggle')}</span>
      </button>
      {typeof onEditDetails === 'function' && (
        <button
          type="button"
          data-noswipe
          data-testid="receipt-items-edit"
          onClick={onEditDetails}
          aria-label={t('notebook.receiptItems.editDetailsAria')}
          className="jr-btn-paper inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm px-3 py-1 text-left font-hand text-sm font-bold text-ink hover:bg-paper-shade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-route"
          style={{ minHeight: 44, minWidth: 44, maxWidth: '100%', whiteSpace: 'normal' }}
        >
          {t('notebook.receiptItems.editDetails')}
        </button>
      )}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={open ? undefined : true}
        data-testid="receipt-items-panel"
        className="min-w-0 max-w-full"
        style={wrapStyle}
      >
        {!open ? null : editable ? (
          <>
            {editorDrafts.length === 0 && scanned ? (
              <p data-testid="receipt-items-empty" className="m-0 break-words px-2 py-1 text-sm text-ink-soft" style={wrapStyle}>
                {t('notebook.receiptItems.empty')}
              </p>
            ) : null}
            <ReceiptItemsEditor
              drafts={editorDrafts}
              currency={currency}
              errors={errors}
              onChange={onDraftsChange}
              nextRowKey={nextRowKey}
              revealToken={revealToken}
              composingRef={composingRef}
            />
            {editorDrafts.length > 0 ? (
              <p
                data-testid="receipt-items-disclaimer"
                className="m-0 break-words px-0 py-1 font-hand text-meta text-ink-muted"
                style={wrapStyle}
              >
                {t('notebook.receiptItems.notSum')}
              </p>
            ) : null}
          </>
        ) : view.empty ? (
          <p data-testid="receipt-items-empty" className="m-0 break-words px-2 py-1 text-sm text-ink-soft" style={wrapStyle}>
            {t('notebook.receiptItems.empty')}
          </p>
        ) : (
          <>
            <ul data-testid="receipt-items-list" className="m-0 list-none p-0">
              {view.rows.map((row) => {
                const code = row.currency || currency || '';
                return (
                  <li
                    key={row.key}
                    data-testid="receipt-item-row"
                    className="min-w-0 max-w-full whitespace-normal break-words py-1"
                    style={wrapStyle}
                  >
                    <p className="m-0 min-w-0 max-w-full break-words text-sm text-ink" style={wrapStyle}>
                      {row.name ? <span>{row.name}</span> : null}
                      {row.quantity !== null && (
                        <span data-testid="receipt-item-qty">
                          {` ×${formatRecordedAmount(row.quantity)}`}
                          <span className="sr-only">
                            {t('notebook.receiptItems.qty', { qty: formatRecordedAmount(row.quantity) })}
                          </span>
                        </span>
                      )}
                    </p>
                    <p className="m-0 min-w-0 max-w-full break-words font-display text-sm tabular-nums text-ink" style={wrapStyle}>
                      {row.price === null ? (
                        <span data-testid="receipt-item-price-missing">{t('notebook.receiptItems.priceMissing')}</span>
                      ) : (
                        <span data-testid="receipt-item-price">
                          {row.priceActual !== null ? `${t('notebook.receiptItems.listPrice')} ` : ''}
                          {amountLabel(code, row.price)}
                        </span>
                      )}
                      {row.priceActual !== null && (
                        <span data-testid="receipt-item-actual">
                          {` ${t('notebook.receiptItems.actualPrice')} ${amountLabel(code, row.priceActual)}`}
                        </span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p
              data-testid="receipt-items-disclaimer"
              className="m-0 break-words px-0 py-1 font-hand text-meta text-ink-muted"
              style={wrapStyle}
            >
              {t('notebook.receiptItems.notSum')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
