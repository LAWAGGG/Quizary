import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import id from '../locales/id.json'
import en from '../locales/en.json'

const STORE_KEY = 'quizary-lang'

const stored = localStorage.getItem(STORE_KEY)
i18n.use(initReactI18next).init({
  resources: { id: { translation: id }, en: { translation: en } },
  lng: stored || ((navigator.language || 'id').toLowerCase().startsWith('en') ? 'en' : 'id'),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
})

export function persistLang(lng) {
  localStorage.setItem(STORE_KEY, lng)
}

export default i18n
