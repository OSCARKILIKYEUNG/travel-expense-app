/**
 * Display-only readout of the paid-amount formula.
 * Callers must not write this result into originalAmount, FX, shares, or refund math.
 */

function termText(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(number)) return null;
  if (Object.is(number, -0)) return '0';
  return String(number);
}

export function describePaidAmountFormula(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    paidText: termText(source.paidAmount),
    subtotalText: termText(source.subtotal),
    taxRefundText: termText(source.taxRefund),
    discountText: termText(source.discount),
    includedTaxText: source.includedTaxAmount === null ? null : termText(source.includedTaxAmount),
    receiptType: String(source.receiptType || ''),
  };
}

/** Printed included-tax amount for the formula note. null is an explicit clear. */
export function readIncludedTaxDisplayAmount(draft) {
  const amount = draft && draft.amount;
  if (!amount) return undefined;
  const text = String(amount.text ?? '').trim();
  if (amount.mode === 'cleared' && text === '') return null;
  if (text === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}
