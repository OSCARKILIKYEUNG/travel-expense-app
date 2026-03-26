import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import { readStoredUiLanguage } from './utils/locale';

i18n.use(initReactI18next).init({
  resources: {
    'zh-TW': { translation: zhTW },
    en: { translation: en },
  },
  lng: readStoredUiLanguage(),
  fallbackLng: 'zh-TW',
  supportedLngs: ['zh-TW', 'en'],
  interpolation: { escapeValue: false },
});

export default i18n;
