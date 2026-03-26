/**
 * UI language is only Traditional Chinese or English.
 * Legacy persisted value "system" (or unknown) → zh-TW.
 * @param {unknown} raw
 * @returns {'zh-TW' | 'en'}
 */
export function normalizeUiLanguage(raw) {
  if (raw === 'en') return 'en';
  return 'zh-TW';
}

/**
 * @param {unknown} uiLanguage From settings
 * @returns {'zh-TW' | 'en'}
 */
export function resolveAppLanguage(uiLanguage) {
  return normalizeUiLanguage(uiLanguage);
}

/**
 * Initial language before React (reads localStorage; same rules as DataService.loadSettings).
 * @returns {'zh-TW' | 'en'}
 */
export function readStoredUiLanguage() {
  try {
    const raw = localStorage.getItem('travel_app_settings');
    if (raw) {
      const s = JSON.parse(raw);
      return normalizeUiLanguage(s.uiLanguage);
    }
  } catch {
    /* ignore */
  }
  return 'zh-TW';
}
