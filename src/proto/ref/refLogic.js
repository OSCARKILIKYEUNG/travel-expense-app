/**
 * Pure helpers for the ?proto=ref build (executor takeover; gemini-4-argon-high was region-blocked).
 * Ledger grouping reuses the real app's list logic (src/utils/date.js, src/utils/people.js),
 * the same helpers src/components/expense/ExpenseList.jsx uses.
 */
import { sortExpenses, expenseDateKey, expenseDateLabel } from '../../utils/date';
import { resolveAssigneeDisplay } from '../../utils/people';

const WEEK = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

export const fmtHKD = (n) => `HKD $${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
export const fmtJPY = (n) => `JPY ¥${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/** '2026-10-22' -> '10月22日 週四' (zh-HK style, used instead of the browser's mm/dd/yyyy). */
export function zhDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '未有日期';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}月${d}日 ${WEEK[new Date(y, m - 1, d).getDay()]}`;
}

/** Hash routes: '' | day=ISO&pane=itinerary|expenses[&edit=1] | add[&date=ISO][&scan=1][&edit=ID] | ledger | charts | settings */
export function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const q = new URLSearchParams(raw);
  if (q.has('day')) {
    const pane = q.get('pane') === 'expenses' ? 'expenses' : 'itinerary'; // 'overview' (old) maps to itinerary
    return { screen: 'day', day: q.get('day'), pane, edit: q.get('edit') === '1' };
  }
  const head = raw.split('&')[0];
  if (head === 'add') {
    return { screen: 'add', date: q.get('date') || null, scan: q.get('scan') === '1', expenseId: q.get('edit') || null };
  }
  if (['ledger', 'charts', 'settings'].includes(head)) return { screen: head };
  return { screen: 'home' };
}

/** Day strip title budget: shorten the title (never the font) so the strip stays on one line. */
export function shortenTitle(title, max = 8) {
  const chars = Array.from(String(title || ''));
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`;
}

export function dayStrip({ n, title, hkd }, max = 8) {
  const parts = [];
  if (n) parts.push(`Day ${n}`);
  if (title) parts.push(shortenTitle(title, max));
  parts.push(fmtHKD(hkd));
  return parts.join('・');
}

export function dayStats(expenses, iso) {
  const list = (expenses || []).filter((e) => e.date === iso);
  return {
    count: list.length,
    total: list.reduce((s, e) => s + Number(e.hkdAmount || 0), 0),
    scanned: list.filter((e) => e.scanned).length,
    manual: list.filter((e) => !e.scanned).length,
  };
}

export function personCounts(expenses, people) {
  const counts = { 全部: expenses.length };
  for (const p of people) counts[p] = 0;
  for (const e of expenses) {
    const who = resolveAssigneeDisplay(e.assignedTo, people);
    counts[who] = (counts[who] || 0) + 1;
  }
  return counts;
}

export function filterExpenses(list, { person = '全部', category = '全部', date = '全部', query = '' } = {}, people = []) {
  const q = query.trim().toLowerCase();
  return list.filter((e) => {
    if (person !== '全部' && resolveAssigneeDisplay(e.assignedTo, people) !== person) return false;
    if (category !== '全部' && e.category !== category) return false;
    if (date === 'undated' && e.date) return false;
    if (date !== '全部' && date !== 'undated' && e.date !== date) return false;
    if (q && !`${e.store} ${e.place} ${e.category}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Ledger groups: 未有日期 first, then dates newest first, each with an HKD subtotal. */
export function groupLedger(list) {
  const undated = list.filter((e) => !e.date);
  const dated = sortExpenses(list.filter((e) => e.date));
  const groups = [];
  if (undated.length) groups.push({ key: 'undated', label: '未有日期', iso: null, items: undated });
  for (const e of dated) {
    const key = expenseDateKey(e.date);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: expenseDateLabel(e.date), iso: key, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  return groups.map((g) => ({ ...g, total: g.items.reduce((s, e) => s + Number(e.hkdAmount || 0), 0) }));
}
