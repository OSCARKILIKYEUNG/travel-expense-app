// Compiled with the same PostCSS + Tailwind pipeline Vite uses, then
// resolved at a CSS width. Specificity, !important, and source order are
// applied here. jsdom in this repo lets a later element selector beat an
// earlier class, so it is not the cascade oracle. This is not a device
// layout and not an iOS zoom session.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { beforeAll, describe, expect, it } from 'vitest';

const root = process.cwd();
const indexSource = readFileSync(resolve(root, 'src/index.css'), 'utf8');
const journalSource = readFileSync(resolve(root, 'src/theme/journal.css'), 'utf8');
const htmlSource = readFileSync(resolve(root, 'index.html'), 'utf8');
const dayViewSource = readFileSync(resolve(root, 'src/proto/ref/DayView.jsx'), 'utf8');

const MARK = 'mobile-viewport-lock';
const KEEP = new Set([
  'font-size',
  'min-width',
  'max-width',
  'width',
  'overflow',
  'overflow-x',
  'overflow-y',
  'touch-action',
  'height',
]);
const PHONE_WIDTHS = [320, 390, 430];

function markedBlock(source, name) {
  const start = source.indexOf(`/* ${name}`);
  const end = source.indexOf(`/* /${name} */`);
  if (start < 0 || end <= start) throw new Error(`missing ${name} block`);
  return source.slice(start, end);
}

function mediaMatches(params, width, pointer = 'fine') {
  const parts = params.split(/\band\b/i).map((part) => part.trim()).filter(Boolean);
  return parts.every((part) => {
    if (/prefers-|forced-colors|\bprint\b/.test(part)) return false;
    const max = part.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
    if (max) return width <= Number(max[1]);
    const min = part.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
    if (min) return width >= Number(min[1]);
    const pointing = part.match(/\(pointer:\s*(coarse|fine)\)/);
    if (pointing) return pointing[1] === pointer;
    if (/^(all|screen)$/.test(part)) return true;
    if (part.includes('(')) return false;
    return true;
  });
}

function unescapeIdent(value) {
  return value.replace(/\\(.)/g, '$1');
}

function readIdent(source, start) {
  let value = '';
  let i = start;
  while (i < source.length) {
    if (source[i] === '\\') {
      value += source[i];
      i += 1;
      if (i < source.length) {
        value += source[i];
        i += 1;
      }
      continue;
    }
    if (/[A-Za-z0-9_-]/.test(source[i])) {
      value += source[i];
      i += 1;
      continue;
    }
    break;
  }
  return { value, end: i };
}

function readParen(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return { value: source.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

function splitList(selector) {
  const parts = [];
  let buf = '';
  let depth = 0;
  for (const ch of selector) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
    } else buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function parseSimple(selector) {
  const source = selector.trim();
  if (!source || source.includes('::')) return null;
  const pieces = [];
  let i = 0;
  while (i < source.length) {
    const before = i;
    const ch = source[i];
    if (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~') return null;
    if (ch === '.') {
      const ident = readIdent(source, i + 1);
      pieces.push({ kind: 'class', name: unescapeIdent(ident.value) });
      i = ident.end;
      continue;
    }
    if (ch === '#') {
      const ident = readIdent(source, i + 1);
      pieces.push({ kind: 'id', name: unescapeIdent(ident.value) });
      i = ident.end;
      continue;
    }
    if (ch === '[') {
      const end = source.indexOf(']', i);
      if (end < 0) return null;
      const body = source.slice(i + 1, end).trim();
      const eq = body.match(/^([\w-]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s\]]+))$/);
      if (!eq) return null;
      pieces.push({ kind: 'attr', name: eq[1], value: eq[2] ?? eq[3] ?? eq[4] });
      i = end + 1;
      continue;
    }
    if (ch === ':') {
      const ident = readIdent(source, i + 1);
      const name = ident.value.toLowerCase();
      i = ident.end;
      if (source[i] === '(') {
        const inner = readParen(source, i);
        if (!inner || name !== 'not') return null;
        pieces.push({ kind: 'not', inner: inner.value });
        i = inner.end;
        continue;
      }
      pieces.push({ kind: 'pseudo', name });
      continue;
    }
    if (ch === '*') {
      pieces.push({ kind: 'element', name: '*' });
      i += 1;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      const ident = readIdent(source, i);
      if (ident.end === i) return null;
      pieces.push({ kind: 'element', name: ident.value.toLowerCase() });
      i = ident.end;
      continue;
    }
    if (i === before) return null;
  }
  return pieces.length ? pieces : null;
}

function specificity(pieces) {
  let a = 0;
  let b = 0;
  let c = 0;
  for (const piece of pieces) {
    if (piece.kind === 'id') a += 1;
    else if (piece.kind === 'class' || piece.kind === 'attr' || piece.kind === 'pseudo') b += 1;
    else if (piece.kind === 'element' && piece.name !== '*') c += 1;
    else if (piece.kind === 'not') {
      const inner = parseSimple(piece.inner);
      if (!inner) continue;
      const [ia, ib, ic] = specificity(inner);
      a += ia;
      b += ib;
      c += ic;
    }
  }
  return [a, b, c];
}

function compareSpec(left, right) {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}

function matches(pieces, subject) {
  for (const piece of pieces) {
    if (piece.kind === 'element' && piece.name !== '*' && piece.name !== subject.tag) return false;
    if (piece.kind === 'class' && !subject.classes.has(piece.name)) return false;
    if (piece.kind === 'id' && piece.name !== subject.id) return false;
    if (piece.kind === 'attr') {
      if (piece.name !== 'type' || subject.type !== piece.value) return false;
    }
    if (piece.kind === 'pseudo') {
      if (piece.name === 'disabled') {
        if (!subject.disabled) return false;
      } else return false;
    }
    if (piece.kind === 'not') {
      const inner = parseSimple(piece.inner);
      if (!inner || matches(inner, subject)) return false;
    }
  }
  return true;
}

function collectRules(parsed, width, state, pointer = 'fine') {
  const rules = [];
  const visit = (node, on, media) => {
    if (!node) return;
    if (node.type === 'root' || (node.type === 'atrule' && node.name === 'layer')) {
      node.each?.((child) => visit(child, on, media));
      return;
    }
    if (node.type === 'atrule' && node.name === 'media') {
      visitChildren(node, on && mediaMatches(node.params, width, pointer), media.concat(node.params));
      return;
    }
    if (node.type === 'atrule' && node.name === 'supports') {
      visitChildren(node, on, media);
      return;
    }
    if (node.type !== 'rule' || !on) return;
    const alternatives = [];
    for (const part of splitList(node.selector)) {
      const pieces = parseSimple(part);
      if (!pieces) continue;
      alternatives.push({ pieces, spec: specificity(pieces) });
    }
    if (!alternatives.length) return;
    node.each?.((child) => {
      if (child.type !== 'decl' || !KEEP.has(child.prop)) return;
      rules.push({
        prop: child.prop,
        value: child.value.trim(),
        important: Boolean(child.important),
        selector: node.selector,
        alternatives,
        order: state.order,
        media: media.join(' '),
      });
      state.order += 1;
    });
  };
  const visitChildren = (node, on, media) => {
    node.each?.((child) => visit(child, on, media));
  };
  visit(parsed, true, []);
  return rules;
}

function winner(rules, subject, prop) {
  let best = null;
  for (const rule of rules) {
    if (rule.prop !== prop) continue;
    let spec = null;
    for (const alt of rule.alternatives) {
      if (!matches(alt.pieces, subject)) continue;
      if (!spec || compareSpec(alt.spec, spec) > 0) spec = alt.spec;
    }
    if (!spec) continue;
    const candidate = { ...rule, spec };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.important !== best.important) {
      if (candidate.important) best = candidate;
      continue;
    }
    const specCmp = compareSpec(candidate.spec, best.spec);
    if (specCmp > 0 || (specCmp === 0 && candidate.order > best.order)) best = candidate;
  }
  return best;
}

function subject({ tag, type = '', classes = [], disabled = false, id = '' }) {
  return { tag, type, classes: new Set(classes), disabled, id };
}

const subjects = {
  email: subject({ tag: 'input', type: 'email', classes: ['mc-editorial-input'] }),
  field: subject({ tag: 'input', type: 'text', classes: ['input-field', 'text-sm'] }),
  area: subject({ tag: 'textarea', classes: ['text-sm'] }),
  select: subject({ tag: 'select', classes: ['text-sm'] }),
  time: subject({ tag: 'input', type: 'time', classes: ['text-sm', '!w-36'] }),
  date: subject({ tag: 'input', type: 'date', classes: ['input-field'] }),
  button: subject({ tag: 'input', type: 'button', classes: ['text-sm'] }),
  check: subject({ tag: 'input', type: 'checkbox', classes: ['text-sm'] }),
  disabled: subject({
    tag: 'input',
    type: 'text',
    classes: ['mc-editorial-input', 'text-sm'],
    disabled: true,
  }),
  readonly: subject({ tag: 'input', type: 'text', classes: ['text-sm'] }),
  editorial: subject({ tag: 'span', classes: ['mc-editorial-input'] }),
  html: subject({ tag: 'html' }),
  body: subject({ tag: 'body' }),
};

let journalRoot;
let indexRoot;

beforeAll(async () => {
  const compiled = await postcss([tailwindcss(), autoprefixer()]).process(indexSource, {
    from: resolve(root, 'src/index.css'),
  });
  journalRoot = postcss.parse(journalSource, { from: resolve(root, 'src/theme/journal.css') });
  indexRoot = postcss.parse(compiled.css, { from: resolve(root, 'src/index.css') });
});

function rulesAt(width, pointer = 'fine') {
  const state = { order: 0 };
  return [
    ...collectRules(journalRoot, width, state, pointer),
    ...collectRules(indexRoot, width, state, pointer),
  ];
}

function font(rules, name) {
  return winner(rules, subjects[name], 'font-size');
}

describe('mobile viewport lock', () => {
  it('asks for device width without a fixed canvas, and records the zoom restriction', () => {
    const meta = htmlSource.match(/<meta\s+name="viewport"\s+content="([^"]+)"/);
    expect(meta?.[1]).toBe('width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    expect(meta[1]).not.toMatch(/width=\d|viewport-fit/);
    expect(htmlSource).toMatch(/low-vision/);
    expect(htmlSource).toMatch(/WCAG 1\.4\.4/);
    expect(htmlSource).toMatch(/viewport-fit is omitted/);
    expect(htmlSource).not.toMatch(/addEventListener|ontouch|preventDefault/);

    const block = markedBlock(indexSource, MARK);
    expect(block).toContain('@media (max-width: 639px)');
    expect(block).toMatch(/low-vision/);
    expect(block).toMatch(/WCAG 1\.4\.4/);
    const parsed = postcss.parse(block);
    const decls = [];
    parsed.walkDecls((decl) => decls.push(decl));
    const props = new Set(decls.map((decl) => decl.prop));
    expect(props.has('touch-action')).toBe(false);
    expect(props.has('height')).toBe(false);
    expect(decls.some((decl) => decl.prop === 'overflow-y' && decl.value === 'hidden')).toBe(false);
    expect(decls.some((decl) => decl.prop === 'overflow' && decl.value.includes('hidden'))).toBe(false);
    expect(decls.some((decl) => decl.prop === 'width' && /\d+px/.test(decl.value))).toBe(false);
    expect(decls.some((decl) => decl.prop === 'overflow-x' && decl.value === 'clip')).toBe(true);
    expect(decls.some((decl) => decl.prop === 'overflow-y' && decl.value === 'visible')).toBe(true);
    expect(block).not.toMatch(/position\s*:\s*fixed|overflow-x-auto|mc-cover|data-noswipe|preventDefault|addEventListener/);
    expect(indexSource).toMatch(/touch-action:\s*manipulation/);
    expect(indexSource).not.toMatch(/touch-action:\s*none/);
    expect(dayViewSource).toContain('overflow-x-auto');
    expect(dayViewSource).not.toMatch(/onTouch|touchstart|touchmove/);
  });

  it.each(PHONE_WIDTHS)('at %ipx editable text is 16px and the page clips sideways only', (width) => {
    const rules = rulesAt(width);
    const editorial = font(rules, 'editorial');
    expect(editorial.value).toBe('var(--fs-sm, 14px)');
    expect(editorial.media).not.toContain('639px');

    for (const name of ['email', 'field', 'area', 'select', 'time', 'date', 'readonly']) {
      const win = font(rules, name);
      expect(win.value, name).toBe('16px');
      expect(win.media, name).toContain('max-width: 639px');
      expect(compareSpec(win.spec, [0, 1, 0]), name).toBeGreaterThan(0);
    }
    expect(font(rules, 'button').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'check').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'disabled').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'button').media).not.toContain('639px');

    const timeMin = winner(rules, subjects.time, 'min-width');
    const timeMax = winner(rules, subjects.time, 'max-width');
    const timeWidth = winner(rules, subjects.time, 'width');
    expect(timeMin.value === '0' || timeMin.value === '0px').toBe(true);
    expect(timeMax.value).toBe('100%');
    expect(timeWidth.value).toBe('9rem');
    expect(timeWidth.important).toBe(true);
    expect(timeMin.media).toContain('max-width: 639px');

    const dateWidth = winner(rules, subjects.date, 'width');
    const dateMax = winner(rules, subjects.date, 'max-width');
    expect(dateWidth.value).toBe('100%');
    expect(dateMax.value).toBe('100%');
    expect(winner(rules, subjects.email, 'min-width')).toBeNull();

    const htmlX = winner(rules, subjects.html, 'overflow-x');
    const htmlY = winner(rules, subjects.html, 'overflow-y');
    expect(htmlX.value).toBe('clip');
    expect(htmlY.value).toBe('visible');
    expect(winner(rules, subjects.html, 'height')).toBeNull();
    expect(winner(rules, subjects.body, 'max-width').value).toBe('100%');
    expect(winner(rules, subjects.body, 'overflow-y')).toBeNull();
    expect(winner(rules, subjects.body, 'touch-action').value).toBe('manipulation');
    expect(winner(rules, subjects.body, 'touch-action').media).not.toContain('639px');
  });

  it.each([640, 1024])('at %ipx the lock rules stay off and desktop type is unchanged', (width) => {
    const rules = rulesAt(width);
    expect(font(rules, 'email').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'email').value).toBe(font(rules, 'editorial').value);
    expect(font(rules, 'field').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'readonly').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'area').value).not.toBe('16px');
    expect(winner(rules, subjects.time, 'min-width')).toBeNull();
    expect(winner(rules, subjects.date, 'max-width')).toBeNull();
    expect(winner(rules, subjects.time, 'width').value).toBe('9rem');
    expect(winner(rules, subjects.date, 'width').value).toBe('100%');
    expect(winner(rules, subjects.html, 'overflow-x')).toBeNull();
    expect(winner(rules, subjects.html, 'overflow-y')).toBeNull();
    expect(winner(rules, subjects.body, 'max-width')).toBeNull();
    expect(winner(rules, subjects.body, 'touch-action').value).toBe('manipulation');
  });

  it.each(PHONE_WIDTHS)('at %ipx a coarse pointer still uses the narrow 16px lock', (width) => {
    const rules = rulesAt(width, 'coarse');
    for (const name of ['email', 'field', 'area', 'select', 'time', 'date', 'readonly']) {
      const win = font(rules, name);
      expect(win.value, name).toBe('16px');
      expect(win.media, name).toContain('max-width: 639px');
      expect(win.media, name).not.toContain('pointer: coarse');
    }
  });

  it('at 844px a coarse pointer focuses editable text at 16px', () => {
    const rules = rulesAt(844, 'coarse');
    for (const name of ['email', 'field', 'area', 'select', 'time', 'date', 'readonly']) {
      const win = font(rules, name);
      expect(win.value, name).toBe('16px');
      expect(win.media, name).toContain('pointer: coarse');
      expect(win.media, name).toContain('max-width: 1023px');
      expect(win.media, name).toContain('min-width: 640px');
      expect(win.media, name).not.toContain('639px');
    }
    expect(font(rules, 'button').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'check').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'disabled').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'editorial').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'editorial').media).not.toContain('pointer: coarse');
    expect(winner(rules, subjects.html, 'overflow-x')).toBeNull();
    expect(winner(rules, subjects.html, 'overflow-y')).toBeNull();
    expect(winner(rules, subjects.time, 'min-width')).toBeNull();
    expect(winner(rules, subjects.time, 'width').value).toBe('9rem');
    expect(winner(rules, subjects.body, 'touch-action').value).toBe('manipulation');
    expect(winner(rules, subjects.body, 'touch-action').media).not.toContain('pointer: coarse');

    const block = markedBlock(indexSource, MARK);
    expect(block).toContain('@media (min-width: 640px) and (max-width: 1023px) and (pointer: coarse)');
    const landscapeDecls = [];
    postcss.parse(block).walkAtRules('media', (rule) => {
      if (!rule.params.includes('pointer: coarse')) return;
      rule.walkDecls((decl) => landscapeDecls.push(decl));
    });
    expect(landscapeDecls.map((decl) => decl.prop)).toEqual(['font-size']);
    expect(landscapeDecls[0].value).toBe('16px');
  });

  it('at 844px a fine pointer keeps 14px type', () => {
    const rules = rulesAt(844, 'fine');
    expect(font(rules, 'email').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'field').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'area').value).not.toBe('16px');
    expect(font(rules, 'readonly').value).toBe('var(--fs-sm, 14px)');
    expect(winner(rules, subjects.html, 'overflow-x')).toBeNull();
    expect(winner(rules, subjects.time, 'min-width')).toBeNull();
  });

  it('at 1024px a coarse pointer keeps desktop type', () => {
    const rules = rulesAt(1024, 'coarse');
    expect(font(rules, 'email').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'field').value).toBe('var(--fs-sm, 14px)');
    expect(font(rules, 'area').value).not.toBe('16px');
    expect(font(rules, 'readonly').value).toBe('var(--fs-sm, 14px)');
    expect(winner(rules, subjects.html, 'overflow-x')).toBeNull();
    expect(winner(rules, subjects.html, 'overflow-y')).toBeNull();
    expect(winner(rules, subjects.time, 'min-width')).toBeNull();
    expect(winner(rules, subjects.body, 'max-width')).toBeNull();
    expect(winner(rules, subjects.body, 'touch-action').value).toBe('manipulation');
  });
});
