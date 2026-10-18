import DataService from './DataService';
import { supabase } from '../lib/supabaseClient';
import { mergeRemoteWithLocalStorage } from '../utils/persistMerge';

/**
 * Pull Supabase into the local cache, or seed a row when the user has none.
 * A newer local replace is kept: an older remote blob must not clobber it.
 */
export async function bootstrapUserAppData(userId) {
  if (!supabase) throw new Error('Supabase not configured');
  DataService.setStorageScope(userId);

  const { data, error } = await supabase
    .from('user_app_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const merged = mergeRemoteWithLocalStorage(localStorage, userId, data);
    return { source: merged.source };
  }

  DataService.loadTripsData();
  DataService.loadSettings();
  DataService.loadPeople();
  await persistUserAppData(userId);
  return { source: 'seeded' };
}

/**
 * One uploader at a time. A slow older request must not finish after a newer
 * snapshot and put the pre-replace blob back on the server.
 */
let persistTail = Promise.resolve();

export function enqueuePersistUserAppData(userId) {
  const run = persistTail.then(() => persistUserAppData(userId));
  persistTail = run.then(() => {}, () => {});
  return run;
}

/**
 * Upsert the current DataService cache. The payload is read when the call runs,
 * not when it was scheduled, so a debounced flush sees the latest replace.
 */
export async function persistUserAppData(userId) {
  if (!supabase) return;
  DataService.setStorageScope(userId);

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
}
