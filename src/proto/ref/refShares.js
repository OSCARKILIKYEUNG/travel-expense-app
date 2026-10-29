import { getPartialMatchPersonShareHKD } from '../../utils/personShare';

/** People who settle: drop blanks and 共同. */
export function settlementParticipants(people) {
  return (Array.isArray(people) ? people : [])
    .map((p) => String(p ?? '').trim())
    .filter((p) => p && p !== '共同');
}

/**
 * Who paid. A payer in `participants` is kept; blank, 共同, or unknown falls back to participants[0].
 * `participants` may be the raw people list — 共同 and blanks are removed here.
 * @param {{ payer?: string }} expense
 * @param {string[]} participants
 * @returns {string}
 */
export function resolvePayer(expense, participants) {
  const list = settlementParticipants(participants);
  const payer = String(expense?.payer ?? '').trim();
  if (payer && payer !== '共同' && list.includes(payer)) return payer;
  return list[0] || '';
}

function cardAssigneeBucket(expense) {
  const raw = String(expense?.assignedTo ?? '').trim();
  return raw || '共同';
}

/**
 * HKD buckets for one expense. Line items with their own named assignee (not 共同, not blank)
 * move that item's HKD share out of the card. The remainder stays on the card assignee.
 * A blank card assignee is always 共同 — never the first person in `people`.
 * An unknown name keeps its own bucket.
 * @returns {Record<string, number>}
 */
export function expenseAllocation(expense, people, exchangeRates = null) {
  const hkd = Number(expense?.hkdAmount) || 0;
  const buckets = {};
  const explicit = [];
  const seen = new Set();
  for (const item of expense?.items || []) {
    const raw = String(item?.assignedTo ?? '').trim();
    if (!raw || raw === '共同' || seen.has(raw)) continue;
    seen.add(raw);
    explicit.push(raw);
  }

  let moved = 0;
  for (const person of explicit) {
    const share = Number(getPartialMatchPersonShareHKD(expense, person, exchangeRates, '共同')) || 0;
    if (share === 0) continue;
    buckets[person] = (buckets[person] || 0) + share;
    moved += share;
  }

  const remainder = hkd - moved;
  if (remainder !== 0) {
    const card = cardAssigneeBucket(expense);
    buckets[card] = (buckets[card] || 0) + remainder;
  }
  return buckets;
}

/**
 * What each participant owes for one expense: own bucket, plus an even split of 共同 and unknown buckets.
 * @returns {Record<string, number>}
 */
export function personOwed(expense, people, exchangeRates = null) {
  const participants = settlementParticipants(people);
  const buckets = expenseAllocation(expense, people, exchangeRates);
  const known = new Set(participants);
  let pool = 0;
  for (const [name, amount] of Object.entries(buckets)) {
    if (!known.has(name)) pool += amount;
  }
  const split = participants.length > 0 ? pool / participants.length : 0;
  const owed = {};
  for (const person of participants) {
    owed[person] = (buckets[person] || 0) + split;
  }
  return owed;
}

/**
 * Per-person settlement breakdown of paid expenses and owed shares.
 * `paidTotal`, `owedTotal`, and `net` match `settleUp` for that person.
 * `blankPayer` is true when the expense's own payer was blank, 共同, or unknown and fell back to `person`.
 * Owed lines with total 0 are skipped.
 * @param {Array} expenses
 * @param {string[]} people
 * @param {Record<string, number> | null} [exchangeRates]
 * @param {string} [person]
 */
export function settlementBreakdown(expenses, people, exchangeRates = null, person = '') {
  const rates = typeof exchangeRates === 'string' && person === '' ? null : exchangeRates;
  const target = String(typeof exchangeRates === 'string' && person === '' ? exchangeRates : person ?? '').trim();
  const participants = settlementParticipants(people);
  const known = new Set(participants);
  const sharedCount = participants.length;

  const paidLines = [];
  const owedLines = [];
  let paidTotal = 0;
  let owedTotal = 0;

  if (!target || !known.has(target)) {
    return {
      person: target,
      paidLines,
      paidTotal: 0,
      owedLines,
      owedTotal: 0,
      net: 0,
    };
  }

  for (const e of expenses || []) {
    const id = e?.id;
    const title = String(e?.store ?? e?.title ?? '').trim();
    const date = String(e?.date ?? '').trim();
    const hkd = Number(e?.hkdAmount || 0);

    const creditTo = resolvePayer(e, participants);
    if (creditTo === target) {
      const rawPayer = String(e?.payer ?? '').trim();
      const blankPayer = !(rawPayer && rawPayer !== '共同' && known.has(rawPayer));
      paidLines.push({
        id,
        title,
        date,
        hkd,
        blankPayer,
      });
      paidTotal += hkd;
    }

    const buckets = expenseAllocation(e, people, rates);
    const owedMap = personOwed(e, people, rates);
    const total = owedMap[target] || 0;
    owedTotal += total;

    if (total > 0) {
      const own = buckets[target] || 0;
      let sharedPart = 0;
      for (const [name, amount] of Object.entries(buckets)) {
        if (!known.has(name)) sharedPart += amount;
      }
      owedLines.push({
        id,
        title,
        date,
        own,
        sharedPart,
        sharedCount,
        total,
      });
    }
  }

  const net = paidTotal - owedTotal;

  return {
    person: target,
    paidLines,
    paidTotal,
    owedLines,
    owedTotal,
    net,
  };
}

