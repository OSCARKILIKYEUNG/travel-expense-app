import { CURRENCY_NAMES } from './constants';

export function getExchangeRate(currency, rates) {
  return rates[currency] || 1;
}

export function toHKD(amount, currency, rates) {
  return amount * getExchangeRate(currency, rates);
}

export function formatCurrency(amount, options = {}) {
  const { decimals = 0, prefix = '$' } = options;
  const rounded = decimals > 0 ? amount.toFixed(decimals) : Math.round(amount);
  return `${prefix}${Number(rounded).toLocaleString()}`;
}

export function getCurrencyLabel(code) {
  return CURRENCY_NAMES[code] || code;
}
