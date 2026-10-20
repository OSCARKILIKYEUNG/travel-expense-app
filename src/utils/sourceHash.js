/**
 * Exact-file duplicate pre-check (SHA-256 of the original File bytes).
 * Pure helpers: no network, no resized-JPEG hashing.
 */

/**
 * @param {File|Blob|ArrayBuffer|ArrayBufferView} fileOrArrayBuffer
 * @returns {Promise<string>} lowercase hex
 */
export async function sha256Hex(fileOrArrayBuffer) {
  const buffer = await toArrayBuffer(fileOrArrayBuffer);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * First expense in this trip whose sourceHash matches. Records without sourceHash never match.
 * @param {string} hash
 * @param {object[]} expenses
 * @returns {object|null}
 */
export function findExpenseBySourceHash(hash, expenses) {
  const want = normalizeHash(hash);
  if (!want) return null;
  for (const expense of expenses || []) {
    const got = normalizeHash(expense?.sourceHash);
    if (got && got === want) return expense;
  }
  return null;
}

/**
 * Split a batch into files safe to parse and exact-hash conflicts.
 * An existing trip sourceHash wins over an in-batch peer (so the prompt can name store and date).
 * A later file with the same hash as an earlier file in this batch, and no saved record yet, is `sameFile`.
 * Empty hashes are not comparable and go straight to the parse queue.
 *
 * @param {Array<{ file?: File, hash?: string, index?: number }>} files
 * @param {object[]} expenses
 * @returns {{
 *   toParse: Array<{ file: File, hash: string, index: number }>,
 *   conflicts: Array<{ file: File, hash: string, index: number, match: object|null, sameFile: boolean, peerIndex?: number }>,
 * }}
 */
export function collectHashHits(files, expenses) {
  const toParse = [];
  const conflicts = [];
  const firstIndexByHash = new Map();

  (files || []).forEach((entry, position) => {
    const file = entry?.file ?? entry;
    const hash = normalizeHash(entry?.hash);
    const index = Number.isInteger(entry?.index) ? entry.index : position;

    if (!hash) {
      toParse.push({ file, hash: '', index });
      return;
    }

    const match = findExpenseBySourceHash(hash, expenses);
    if (match) {
      conflicts.push({ file, hash, index, match, sameFile: false });
      return;
    }

    if (firstIndexByHash.has(hash)) {
      conflicts.push({
        file,
        hash,
        index,
        match: null,
        sameFile: true,
        peerIndex: firstIndexByHash.get(hash),
      });
      return;
    }

    firstIndexByHash.set(hash, index);
    toParse.push({ file, hash, index });
  });

  return { toParse, conflicts };
}

/**
 * Copy for the pre-AI prompt. Batch peers (no saved record yet) use the same-file wording.
 * @param {{ sameFile?: boolean, match?: { store?: string, date?: string }|null }} conflict
 * @returns {{ sameFile: true } | { sameFile: false, store: string, date: string }}
 */
export function describeHashConflict(conflict) {
  if (!conflict || conflict.sameFile || !conflict.match) return { sameFile: true };
  const store = String(conflict.match.store || '').trim();
  const date = String(conflict.match.date || '').trim();
  if (!store && !date) return { sameFile: true };
  return { sameFile: false, store, date };
}

/**
 * Default choice is skip. Only an explicit `scan` spends quota.
 * @param {Array<{ index: number }>} conflicts
 * @param {Record<string, string>} [choices]
 * @returns {Record<string, 'skip'|'scan'>}
 */
export function hashDecisionsFromChoices(conflicts, choices = {}) {
  const decisions = {};
  for (const conflict of conflicts || []) {
    const raw = choices?.[conflict.index] ?? choices?.[String(conflict.index)];
    decisions[String(conflict.index)] = raw === 'scan' ? 'scan' : 'skip';
  }
  return decisions;
}

/**
 * Files that will be sent to parseReceipt: non-conflicts, plus conflicts the user chose to scan.
 * @param {Array<{ file: File, hash: string, index: number }>} toParse
 * @param {Array<{ file: File, hash: string, index: number }>} conflicts
 * @param {Record<string, string>} [decisions]
 */
export function resolveParseQueue(toParse, conflicts, decisions = {}) {
  const chosen = [];
  for (const conflict of conflicts || []) {
    const choice = decisions?.[conflict.index] ?? decisions?.[String(conflict.index)];
    if (choice === 'scan') chosen.push(conflict);
  }
  return [...(toParse || []), ...chosen].sort((a, b) => a.index - b.index);
}

function normalizeHash(hash) {
  return String(hash || '').trim().toLowerCase();
}

async function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }
  if (input && typeof input.arrayBuffer === 'function') {
    return input.arrayBuffer();
  }
  throw new TypeError('sha256Hex expects File, Blob, ArrayBuffer, or a typed array');
}
