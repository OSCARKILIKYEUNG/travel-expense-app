import DataService from './DataService';
import { supabase } from '../lib/supabaseClient';
import { mergeRemoteWithLocalStorage, parseTimestamp, remoteContentTimestamp } from '../utils/persistMerge';

/**
 * Stale-overwrite guard. `baseline` is the content time of the cloud row this
 * device last loaded or wrote. A row newer than that was written by another
 * device; uploading over it blind would erase that device's changes.
 */
const baseline = new Map();

function noteBaseline(userId, stamp) {
  const ms = parseTimestamp(stamp);
  if (ms != null) baseline.set(userId, ms);
}

/** Content time this device last saw in the cloud (ms), or null. Test seam. */
export function getSyncBaseline(userId) {
  return baseline.has(userId) ? baseline.get(userId) : null;
}

/** True when the cloud row carries content newer than this device last saw. */
export function isRemoteNewer(remoteStamp, baselineMs) {
  const remoteMs = parseTimestamp(remoteStamp);
  if (remoteMs == null || baselineMs == null) return false;
  return remoteMs > baselineMs;
}

async function fetchRow(userId, columns = '*') {
  const { data, error } = await supabase
    .from('user_app_data')
    .select(columns)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Pull Supabase into the local cache, or seed a row when the user has none.
 * A newer local replace is kept: an older remote blob must not clobber it.
 */
export async function bootstrapUserAppData(userId) {
  if (!supabase) throw new Error('Supabase not configured');
  DataService.setStorageScope(userId);
  baseline.delete(userId);

  const data = await fetchRow(userId);

  if (data) {
    const merged = mergeRemoteWithLocalStorage(localStorage, userId, data);
    noteBaseline(userId, remoteContentTimestamp(data));
    return { source: merged.source };
  }

  DataService.loadTripsData();
  DataService.loadSettings();
  DataService.loadPeople();
  await persistUserAppData(userId);
  return { source: 'seeded' };
}

/**
 * One cloud operation at a time. A slow older request must not finish after a
 * newer snapshot and put the pre-replace blob back on the server, and a pull
 * must not interleave with an upload.
 */
let syncTail = Promise.resolve();

function enqueue(task) {
  const run = syncTail.then(task);
  syncTail = run.then(() => {}, () => {});
  return run;
}

export function enqueuePersistUserAppData(userId) {
  return enqueue(() => persistUserAppData(userId));
}

export function enqueuePullUserAppData(userId) {
  return enqueue(() => pullUserAppData(userId));
}

/**
 * Re-read the cloud row (focus / tab visible). When another device saved newer
 * content, merge it into the local cache with the same newest-wins rule as boot.
 *
 * @returns {Promise<{ changed: boolean, source?: 'local'|'remote' }>}
 */
export async function pullUserAppData(userId) {
  if (!supabase) return { changed: false };
  DataService.setStorageScope(userId);
  const row = await fetchRow(userId);
  if (!row) return { changed: false };
  const stamp = remoteContentTimestamp(row);
  if (!isRemoteNewer(stamp, getSyncBaseline(userId))) return { changed: false };
  const merged = mergeRemoteWithLocalStorage(localStorage, userId, row);
  noteBaseline(userId, stamp);
  return { changed: true, source: merged.source };
}

/**
 * Upsert the current DataService cache. The payload is read when the call runs,
 * not when it was scheduled, so a debounced flush sees the latest replace.
 *
 * Before writing, check the cloud row. If another device saved newer content
 * since this device last loaded, merge first (newest wins):
 * - remote content newer than local -> keep it, skip the upload ('remote-applied');
 * - local content still newer      -> upload local ('local-kept').
 *
 * @returns {Promise<{ status: 'saved'|'remote-applied'|'local-kept'|'offline' }>}
 */
export async function persistUserAppData(userId) {
  if (!supabase) return { status: 'offline' };
  DataService.setStorageScope(userId);

  let status = 'saved';
  const head = await fetchRow(userId, 'updated_at, trips_data_updated_at:trips_data->>updatedAt');
  const headStamp = head ? (head.trips_data_updated_at ?? head.updated_at) : null;
  if (head && isRemoteNewer(headStamp, getSyncBaseline(userId))) {
    const row = await fetchRow(userId);
    const merged = mergeRemoteWithLocalStorage(localStorage, userId, row);
    noteBaseline(userId, remoteContentTimestamp(row));
    if (merged.source === 'remote') return { status: 'remote-applied' };
    status = 'local-kept';
  }

  const trips = DataService.loadTripsData();
  const updatedAt = trips?.updatedAt || new Date().toISOString();

  const { error } = await supabase.from('user_app_data').upsert(
    {
      user_id: userId,
      trips_data: trips,
      app_settings: DataService.loadSettings(),
      people_list: DataService.loadPeople(),
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
  noteBaseline(userId, updatedAt);
  return { status };
}
