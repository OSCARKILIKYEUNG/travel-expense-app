import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  findExpenseBySourceHash,
  collectHashHits,
  describeHashConflict,
  hashDecisionsFromChoices,
  resolveParseQueue,
} from './sourceHash';

const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('sha256Hex', () => {
  it('hashes known bytes to the known SHA-256 hex', async () => {
    const bytes = new Uint8Array([97, 98, 99]); // "abc"
    expect(await sha256Hex(bytes)).toBe(ABC);
    expect(await sha256Hex(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).toBe(ABC);
  });

  it('hashes a File of the original bytes, not a re-encoded copy', async () => {
    const file = new File([new Uint8Array([97, 98, 99])], 'receipt.jpg', { type: 'image/jpeg' });
    expect(await sha256Hex(file)).toBe(ABC);
  });

  it('hashes an empty buffer', async () => {
    expect(await sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

describe('findExpenseBySourceHash', () => {
  const hash = ABC;
  const hit = { id: 4, sourceHash: hash.toUpperCase(), store: '羅森', date: '2026年10月18日' };

  it('returns the first expense with that hash, case-insensitive', () => {
    expect(findExpenseBySourceHash(hash, [{ id: 1 }, hit, { id: 9, sourceHash: hash }])).toBe(hit);
  });

  it('ignores records that have no sourceHash', () => {
    expect(findExpenseBySourceHash(hash, [{ id: 1, store: '羅森', date: '2026年10月18日' }])).toBeNull();
    expect(findExpenseBySourceHash('', [hit])).toBeNull();
    expect(findExpenseBySourceHash(hash, [])).toBeNull();
  });
});

describe('collectHashHits', () => {
  const file = (name, hash) => ({ file: { name }, hash, index: undefined });

  it('flags a later copy of the same file in one batch', () => {
    const a = { file: { name: 'a.jpg' }, hash: 'aa' };
    const b = { file: { name: 'b.jpg' }, hash: 'aa' };
    const c = { file: { name: 'c.jpg' }, hash: 'bb' };
    const { toParse, conflicts } = collectHashHits([a, b, c], []);
    expect(toParse.map((row) => row.file.name)).toEqual(['a.jpg', 'c.jpg']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].file.name).toBe('b.jpg');
    expect(conflicts[0].sameFile).toBe(true);
    expect(conflicts[0].match).toBeNull();
    expect(conflicts[0].peerIndex).toBe(0);
    expect(describeHashConflict(conflicts[0])).toEqual({ sameFile: true });
  });

  it('matches an existing trip expense before the in-batch peer label', () => {
    const existing = { id: 7, sourceHash: 'aa', store: '羅森', date: '2026年10月18日' };
    const { toParse, conflicts } = collectHashHits(
      [{ file: { name: 'again.jpg' }, hash: 'AA' }, { file: { name: 'again-2.jpg' }, hash: 'aa' }],
      [existing, { id: 8, store: '唐吉訶德' }],
    );
    expect(toParse).toHaveLength(0);
    expect(conflicts.map((row) => row.match)).toEqual([existing, existing]);
    expect(conflicts.every((row) => row.sameFile === false)).toBe(true);
    expect(describeHashConflict(conflicts[0])).toEqual({
      sameFile: false,
      store: '羅森',
      date: '2026年10月18日',
    });
  });

  it('does not treat a missing hash as a duplicate of another missing hash', () => {
    const { toParse, conflicts } = collectHashHits(
      [{ file: { name: 'a' }, hash: '' }, { file: { name: 'b' }, hash: '  ' }],
      [{ id: 1, sourceHash: '' }],
    );
    expect(conflicts).toHaveLength(0);
    expect(toParse.map((row) => row.file.name)).toEqual(['a', 'b']);
  });

  it('uses 同一檔案 when the matched record has neither store nor date', () => {
    const { conflicts } = collectHashHits(
      [{ file: { name: 'x' }, hash: 'aa' }],
      [{ id: 1, sourceHash: 'aa' }],
    );
    expect(describeHashConflict(conflicts[0])).toEqual({ sameFile: true });
  });

  it('keeps caller indexes', () => {
    const { toParse } = collectHashHits([{ file: { name: 'a' }, hash: 'aa', index: 3 }], []);
    expect(toParse[0].index).toBe(3);
    expect(file('unused', 'zz').hash).toBe('zz');
  });
});

describe('hash decisions', () => {
  const conflicts = [{ index: 1, hash: 'aa' }, { index: 2, hash: 'bb' }];

  it('defaults every row to skip', () => {
    expect(hashDecisionsFromChoices(conflicts, {})).toEqual({ 1: 'skip', 2: 'skip' });
  });

  it('keeps an explicit scan', () => {
    expect(hashDecisionsFromChoices(conflicts, { 2: 'scan' })).toEqual({ 1: 'skip', 2: 'scan' });
  });

  it('resolveParseQueue scans only the chosen files, in batch order', () => {
    const toParse = [{ file: { name: 'clean' }, hash: 'cc', index: 0 }];
    const rows = [
      { file: { name: 'dup' }, hash: 'aa', index: 2 },
      { file: { name: 'mid' }, hash: 'bb', index: 1 },
    ];
    expect(resolveParseQueue(toParse, rows, {}).map((row) => row.file.name)).toEqual(['clean']);
    expect(resolveParseQueue(toParse, rows, { 1: 'scan', 2: 'skip' }).map((row) => row.file.name)).toEqual([
      'clean',
      'mid',
    ]);
  });
});
