import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import ml from './locales/ml.json';
import hi from './locales/hi.json';

const resources = {
    en: { translation: en },
    ta: { translation: ta },
    te: { translation: te },
    ml: { translation: ml },
    hi: { translation: hi }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        lng: localStorage.getItem('selectedLanguage') || 'en',
        interpolation: {
            escapeValue: false
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage']
        }
    });

export default i18n;
