/**
 * App UI language: Traditional Chinese or English.
 * @param {'system' | 'zh-TW' | 'en' | undefined} uiLanguage From settings
 * @returns {'zh-TW' | 'en'}
 */
export function resolveAppLanguage(uiLanguage) {
  if (uiLanguage === 'zh-TW') return 'zh-TW';
  if (uiLanguage === 'en') return 'en';
  if (typeof navigator !== 'undefined' && navigator.language) {
    const n = navigator.language.toLowerCase();
    if (n.startsWith('zh')) return 'zh-TW';
  }
  return 'en';
}

/**
 * Read initial uiLanguage from persisted settings (sync, before React).
 * @returns {'system' | 'zh-TW' | 'en'}
 */
export function readStoredUiLanguageMode() {
  try {
    const raw = localStorage.getItem('travel_app_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.uiLanguage === 'zh-TW' || s.uiLanguage === 'en' || s.uiLanguage === 'system') {
        return s.uiLanguage;
      }
    }
  } catch {
    /* ignore */
  }
  return 'system';
}
