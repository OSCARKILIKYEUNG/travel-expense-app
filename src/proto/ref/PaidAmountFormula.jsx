import { useTranslation } from 'react-i18next';
import '../../i18n';
import { describePaidAmountFormula } from './paidAmountFormula';

function storedAdjustment(value) {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number) || number === 0) return null;
  return String(number);
}

export default function PaidAmountFormula({
  surface,
  subtotal,
  taxRefund,
  discount,
  paidAmount,
  includedTaxAmount,
  receiptType,
}) {
  const { t } = useTranslation();
  const described = describePaidAmountFormula({
    subtotal,
    taxRefund,
    discount,
    paidAmount,
    includedTaxAmount,
    receiptType,
  });
  const blank = t('notebook.paidFormula.blank');
  const note = described.includedTaxText == null
    ? t('notebook.paidFormula.includedNote')
    : t('notebook.paidFormula.includedNoteAmount', { amount: described.includedTaxText });

  return (
    <div data-testid={`paid-formula-${surface}`} className="min-w-0 space-y-0.5">
      <p data-testid="paid-formula-equation" className="m-0 break-words font-sans text-sm text-ink">
        {t('notebook.paidFormula.equation')}
      </p>
      <p data-testid="paid-formula-values" className="m-0 break-words font-display text-sm tabular-nums text-ink">
        {t('notebook.paidFormula.values', {
          paid: described.paidText ?? blank,
          subtotal: described.subtotalText ?? blank,
          refund: described.taxRefundText ?? blank,
          discount: described.discountText ?? blank,
        })}
      </p>
      <p data-testid="paid-formula-included-note" className="m-0 break-words text-sm text-ink-soft">
        {note}
      </p>
    </div>
  );
}

const containedStyle = {
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
};

/** Stored refund and discount on a saved card. Included tax is not an input here. */
export function SavedAdjustments({ taxRefund, discount }) {
  const { t } = useTranslation();
  const refund = storedAdjustment(taxRefund);
  const discountText = storedAdjustment(discount);
  if (!refund && !discountText) return null;
  return (
    <div data-testid="saved-adjustments" className="mt-1 min-w-0 max-w-full break-words" style={containedStyle}>
      {refund && (
        <p data-testid="saved-tax-refund" className="m-0 min-w-0 max-w-full break-words font-display text-sm tabular-nums text-ink" style={containedStyle}>
          {t('notebook.paidFormula.taxRefundLine')} {refund}
        </p>
      )}
      {discountText && (
        <p data-testid="saved-discount" className="m-0 min-w-0 max-w-full break-words font-display text-sm tabular-nums text-ink" style={containedStyle}>
          {t('notebook.paidFormula.discountLine')} {discountText}
        </p>
      )}
    </div>
  );
}
