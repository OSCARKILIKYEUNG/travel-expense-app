import DataService, { KEYS, scopedLocalStorageKey } from './DataService';
import { supabase } from '../lib/supabaseClient';

/**
 * 從 Supabase 拉取並寫入本機快取（localStorage），若無列則以預設旅程建立並上傳。
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
    localStorage.setItem(
      scopedLocalStorageKey(userId, KEYS.TRIPS),
      JSON.stringify(data.trips_data)
    );
    localStorage.setItem(
      scopedLocalStorageKey(userId, KEYS.SETTINGS),
      JSON.stringify(data.app_settings)
    );
    localStorage.setItem(
      scopedLocalStorageKey(userId, KEYS.PEOPLE),
      JSON.stringify(data.people_list)
    );
    const td = DataService.loadTripsData();
    const trip = DataService.getCurrentTrip(td);
    DataService.saveExpenses(trip?.expenses || []);
    return { source: 'remote' };
  }

  DataService.loadTripsData();
  DataService.loadSettings();
  DataService.loadPeople();
  await persistUserAppData(userId);
  return { source: 'seeded' };
}

/**
 * 將目前 DataService（本機快取）完整狀態 upsert 至 Supabase。
 */
export async function persistUserAppData(userId) {
  if (!supabase) return;
  DataService.setStorageScope(userId);

  const { error } = await supabase.from('user_app_data').upsert(
    {
      user_id: userId,
      trips_data: DataService.loadTripsData(),
      app_settings: DataService.loadSettings(),
      people_list: DataService.loadPeople(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}
