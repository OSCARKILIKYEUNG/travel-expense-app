/**
 * Printed included-tax metadata.
 * Omitted means unknown. 0 is a printed zero. null and [] are explicit clears.
 * Amounts are copied, never computed from a rate.
 */

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function firstKey(source, keys) {
  for (const key of keys) {
    if (hasOwn(source, key)) return key;
  }
  return null;
}

export function parsePrintedNumber(text) {
  const trimmed = String(text ?? '').trim().normalize('NFKC');
  if (trimmed === '') return { ok: true, empty: true };
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return { ok: false, empty: false };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, empty: false };
  return { ok: true, empty: false, value };
}

function canonicalAmount(value) {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parsePrintedNumber(value);
    if (parsed.ok && !parsed.empty) return parsed.value;
  }
  return undefined;
}

function canonicalBasis(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'gross' || text === 'net' || text === 'unknown') return text;
  return 'unknown';
}

function optionalPrinted(source, keys) {
  const key = firstKey(source, keys);
  if (!key) return undefined;
  return canonicalAmount(source[key]);
}

function canonicalRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const ratePercent = optionalPrinted(row, ['rate_percent', 'ratePercent']);
  const targetAmount = optionalPrinted(row, ['target_amount', 'targetAmount']);
  const includedTaxAmount = optionalPrinted(row, ['included_tax_amount', 'includedTaxAmount']);
  if (ratePercent === undefined && targetAmount === undefined && includedTaxAmount === undefined) return null;
  const next = { basis: canonicalBasis(row.basis) };
  if (ratePercent !== undefined) next.ratePercent = ratePercent;
  if (targetAmount !== undefined) next.targetAmount = targetAmount;
  if (includedTaxAmount !== undefined) next.includedTaxAmount = includedTaxAmount;
  return next;
}

export function canonicalBreakdown(value) {
  if (value === null) return [];
  if (!Array.isArray(value)) return undefined;
  if (value.length === 0) return [];
  const rows = [];
  for (const row of value) {
    const next = canonicalRow(row);
    if (next) rows.push(next);
  }
  return rows.length ? rows : undefined;
}

export function normalizeIncludedTax(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  const amountKey = firstKey(source, ['included_tax_amount', 'includedTaxAmount']);
  if (amountKey) {
    const amount = canonicalAmount(source[amountKey]);
    if (amount !== undefined) out.includedTaxAmount = amount;
  }
  const rowsKey = firstKey(source, ['included_tax_breakdown', 'includedTaxBreakdown']);
  if (rowsKey) {
    const rows = canonicalBreakdown(source[rowsKey]);
    if (rows !== undefined) out.includedTaxBreakdown = rows;
  }
  return out;
}

function amountText(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return Object.is(value, -0) ? '0' : String(value);
}

function rowDraft(row, key) {
  const source = row && typeof row === 'object' ? row : {};
  return {
    key,
    rateText: amountText(source.ratePercent),
    targetText: amountText(source.targetAmount),
    taxText: amountText(source.includedTaxAmount),
    basis: canonicalBasis(source.basis),
  };
}

export function createIncludedTaxDraft(source) {
  const src = source && typeof source === 'object' ? source : {};
  let amountMode = 'unknown';
  let text = '';
  if (hasOwn(src, 'includedTaxAmount')) {
    if (src.includedTaxAmount === null) amountMode = 'cleared';
    else if (typeof src.includedTaxAmount === 'number' && Number.isFinite(src.includedTaxAmount)) {
      amountMode = 'value';
      text = amountText(src.includedTaxAmount);
    }
  }

  let rowsMode = 'unknown';
  let rows = [];
  if (hasOwn(src, 'includedTaxBreakdown')) {
    if (src.includedTaxBreakdown === null || (Array.isArray(src.includedTaxBreakdown) && src.includedTaxBreakdown.length === 0)) {
      rowsMode = 'cleared';
    } else if (Array.isArray(src.includedTaxBreakdown)) {
      rows = src.includedTaxBreakdown.map((row, index) => rowDraft(row, `included-tax-${index}`));
      rowsMode = rows.length ? 'rows' : 'cleared';
    }
  }

  return {
    amount: { text, initial: text, mode: amountMode },
    rowsMode,
    rows,
  };
}

export function withIncludedTaxAmountText(draft, text) {
  const nextText = String(text ?? '');
  const current = draft.amount;
  let mode = 'value';
  if (current.mode === 'cleared' && nextText.trim() === '') mode = 'cleared';
  else if (current.mode === 'unknown' && nextText.trim() === '' && current.initial === '') mode = 'unknown';
  return {
    ...draft,
    amount: { ...current, text: nextText, mode },
  };
}

export function clearIncludedTaxAmount(draft) {
  return {
    ...draft,
    amount: { ...draft.amount, text: '', mode: 'cleared' },
  };
}

export function withIncludedTaxRow(draft, key, field, value) {
  return {
    ...draft,
    rowsMode: 'rows',
    rows: draft.rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
  };
}

export function addIncludedTaxRow(draft, key) {
  return {
    ...draft,
    rowsMode: 'rows',
    rows: [
      ...draft.rows,
      { key, rateText: '', targetText: '', taxText: '', basis: 'unknown' },
    ],
  };
}

export function removeIncludedTaxRow(draft, key) {
  const rows = draft.rows.filter((row) => row.key !== key);
  return { ...draft, rowsMode: rows.length ? 'rows' : 'cleared', rows };
}

export function clearIncludedTaxRows(draft) {
  return { ...draft, rowsMode: 'cleared', rows: [] };
}

function commitRow(row, errors) {
  const rate = parsePrintedNumber(row.rateText);
  const target = parsePrintedNumber(row.targetText);
  const tax = parsePrintedNumber(row.taxText);
  if (!rate.ok) errors.push({ field: 'rate', key: row.key });
  if (!target.ok) errors.push({ field: 'target', key: row.key });
  if (!tax.ok) errors.push({ field: 'tax', key: row.key });
  if (!rate.ok || !target.ok || !tax.ok) return null;
  if (rate.empty && target.empty && tax.empty) {
    errors.push({ field: 'row', key: row.key });
    return null;
  }
  const next = { basis: canonicalBasis(row.basis) };
  if (!rate.empty) next.ratePercent = rate.value;
  if (!target.empty) next.targetAmount = target.value;
  if (!tax.empty) next.includedTaxAmount = tax.value;
  return next;
}

export function commitIncludedTaxDraft(draft) {
  const safe = draft && typeof draft === 'object' ? draft : createIncludedTaxDraft(null);
  const errors = [];
  const patch = {};
  const amount = safe.amount || { text: '', mode: 'unknown', initial: '' };
  const parsed = parsePrintedNumber(amount.text);
  if (amount.mode === 'cleared' && String(amount.text ?? '').trim() === '') {
    patch.includedTaxAmount = null;
  } else if (amount.mode === 'unknown' && String(amount.text ?? '').trim() === '') {
    // Unknown stays omitted.
  } else if (!parsed.ok || parsed.empty) {
    errors.push({ field: 'amount', key: 'amount' });
  } else {
    patch.includedTaxAmount = parsed.value;
  }

  if (safe.rowsMode === 'cleared') {
    patch.includedTaxBreakdown = [];
  } else if (safe.rowsMode === 'rows') {
    const rows = [];
    for (const row of safe.rows || []) {
      const next = commitRow(row, errors);
      if (next) rows.push(next);
    }
    patch.includedTaxBreakdown = rows;
  }

  return { ok: errors.length === 0, errors, patch };
}

export function includedTaxPrintedMismatch(metadata) {
  const amount = metadata?.includedTaxAmount;
  const rows = metadata?.includedTaxBreakdown;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Array.isArray(rows) || rows.length === 0) {
    return false;
  }
  if (!rows.every((row) => typeof row?.includedTaxAmount === 'number' && Number.isFinite(row.includedTaxAmount))) {
    return false;
  }
  const sum = rows.reduce((total, row) => total + row.includedTaxAmount, 0);
  return Math.abs(sum - amount) > 0.000001;
}
