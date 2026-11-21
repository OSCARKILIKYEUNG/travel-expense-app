/**
 * Form-owned receipt line drafts.
 * Price is the printed row amount. Quantity never multiplies it.
 * Untouched rows stay the same object. UI keys and dirty flags are not persisted.
 * A real canonical name edit clears nameEn/name_en only. originalName/original_name stay.
 */

import { readExplicitQuantity, readFiniteAmount } from './receiptItemsDisplay';

function hasOwn(item, key) {
  return Boolean(item) && Object.prototype.hasOwnProperty.call(item, key);
}

function safeId(value) {
  const text = String(value ?? 'items').replace(/[^A-Za-z0-9_-]/g, '-');
  return text || 'items';
}

function textField(text) {
  return { text, initial: text, dirty: false };
}

function suppliedAmount(item, keys) {
  if (!item || typeof item !== 'object') return null;
  for (const key of keys) {
    if (!hasOwn(item, key)) continue;
    const amount = readFiniteAmount(item[key]);
    if (amount !== null) return amount;
  }
  return null;
}

function priceText(item) {
  if (!hasOwn(item, 'price')) return '';
  const raw = item.price;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Object.is(raw, -0) ? '0' : String(raw);
  return '';
}

function quantityText(item) {
  const hasQuantity = hasOwn(item, 'quantity');
  const hasQty = hasOwn(item, 'qty');
  if (!hasQuantity && !hasQty) return null;
  const explicit = readExplicitQuantity(item);
  if (explicit !== null && hasQuantity && readFiniteAmount(item.quantity) !== null && readFiniteAmount(item.quantity) > 0) {
    return typeof item.quantity === 'string' ? item.quantity : String(item.quantity);
  }
  if (explicit !== null && hasQty) {
    return typeof item.qty === 'string' ? item.qty : String(item.qty);
  }
  const raw = hasQuantity ? item.quantity : item.qty;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return '';
}

function rowFromSource(item, key) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { key, kind: 'passthrough', raw: item ?? null, isNew: false };
  }
  const actual = suppliedAmount(item, ['priceActual', 'price_actual']);
  const quantity = quantityText(item);
  return {
    key,
    kind: 'edit',
    raw: item,
    isNew: false,
    fields: {
      name: textField(typeof item.name === 'string' ? item.name : ''),
      price: textField(priceText(item)),
      priceActual: { ...textField(actual === null ? '' : String(actual)), present: actual !== null },
      quantity: { ...textField(quantity === null ? '' : quantity), present: quantity !== null },
    },
  };
}

export function createItemDrafts(items, identity = 'items') {
  const list = Array.isArray(items) ? items : [];
  const prefix = safeId(identity);
  return list.map((item, index) => rowFromSource(item, `${prefix}-base-${index}`));
}

export function createEmptyRowDraft(key) {
  return {
    key,
    kind: 'edit',
    raw: null,
    isNew: true,
    fields: {
      name: textField(''),
      price: textField(''),
      priceActual: { ...textField(''), present: false },
      quantity: { ...textField(''), present: false },
    },
  };
}

export function withDraftField(drafts, key, field, text) {
  return drafts.map((row) => {
    if (row.key !== key || row.kind !== 'edit' || !row.fields?.[field]) return row;
    const current = row.fields[field];
    if (current.present === false) return row;
    return {
      ...row,
      fields: {
        ...row.fields,
        [field]: { ...current, text, dirty: text !== current.initial },
      },
    };
  });
}

export function withoutDraftRow(drafts, key) {
  return drafts.filter((row) => row.key !== key);
}

export function parseDraftAmount(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: false, reason: 'blank' };
  const value = readFiniteAmount(trimmed);
  if (value === null) return { ok: false, reason: 'invalid' };
  return { ok: true, value: Object.is(value, -0) ? 0 : value };
}

export function parseDraftQuantity(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { ok: true, clear: true };
  const value = readFiniteAmount(trimmed);
  if (value === null || !(value > 0)) return { ok: false };
  return { ok: true, value };
}

function pushError(errors, key, field, code) {
  errors.push({ key, field, code });
}

function applyActual(copy, raw, field, errors, key) {
  if (!field?.present || !field.dirty) return true;
  if (field.text.trim() === '') {
    delete copy.priceActual;
    delete copy.price_actual;
    return true;
  }
  const parsed = parseDraftAmount(field.text);
  if (!parsed.ok) {
    pushError(errors, key, 'priceActual', 'actualInvalid');
    return false;
  }
  const hadCamel = hasOwn(raw, 'priceActual');
  const hadSnake = hasOwn(raw, 'price_actual');
  if (hadSnake && !hadCamel) {
    copy.price_actual = parsed.value;
    return true;
  }
  copy.priceActual = parsed.value;
  if (hadSnake) copy.price_actual = parsed.value;
  return true;
}

function applyQuantity(copy, raw, field, errors, key, isNew) {
  if (!field?.present) return true;
  const entered = field.text.trim() !== '';
  if (!field.dirty && !(isNew && entered)) return true;
  if (!entered) {
    if (!isNew) {
      delete copy.quantity;
      delete copy.qty;
    }
    return true;
  }
  const parsed = parseDraftQuantity(field.text);
  if (!parsed.ok) {
    pushError(errors, key, 'quantity', 'quantityInvalid');
    return false;
  }
  copy.quantity = parsed.value;
  delete copy.qty;
  return true;
}

function applyEditRow(row, errors) {
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
  const copy = row.isNew ? {} : { ...raw };
  let ok = true;
  const nameField = row.fields.name;
  if (row.isNew || nameField.dirty) {
    if (nameField.text.trim() === '') {
      pushError(errors, row.key, 'name', 'nameRequired');
      ok = false;
    } else {
      copy.name = nameField.text;
      const original = typeof raw.name === 'string' ? raw.name : '';
      if (nameField.text !== original) {
        delete copy.nameEn;
        delete copy.name_en;
      }
    }
  }
  const priceField = row.fields.price;
  if (row.isNew || priceField.dirty) {
    const parsed = parseDraftAmount(priceField.text);
    if (!parsed.ok) {
      pushError(errors, row.key, 'price', parsed.reason === 'blank' ? 'priceRequired' : 'priceInvalid');
      ok = false;
    } else {
      copy.price = parsed.value;
    }
  }
  if (!applyActual(copy, raw, row.fields.priceActual, errors, row.key)) ok = false;
  if (!applyQuantity(copy, raw, row.fields.quantity, errors, row.key, row.isNew)) ok = false;
  return ok ? copy : null;
}

function rowDirty(row) {
  if (row.isNew) return true;
  if (!row.fields) return false;
  return Object.values(row.fields).some((field) => field?.dirty);
}

export function commitItemDrafts(drafts, { sourceCount = Array.isArray(drafts) ? drafts.length : 0 } = {}) {
  const list = Array.isArray(drafts) ? drafts : [];
  const dirty = list.some(rowDirty) || list.length !== sourceCount;
  if (!dirty) return { ok: true, dirty: false, items: null, errors: [] };
  const errors = [];
  const items = [];
  list.forEach((row) => {
    if (row.kind === 'passthrough') {
      items.push(row.raw);
      return;
    }
    if (!rowDirty(row)) {
      items.push(row.raw);
      return;
    }
    const next = applyEditRow(row, errors);
    if (next) items.push(next);
  });
  if (errors.length) return { ok: false, dirty: true, items: null, errors };
  return { ok: true, dirty: true, items, errors: [] };
}
