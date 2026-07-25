import en from './locales/en.json'
import hi from './locales/hi.json'
import kn from './locales/kn.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import es from './locales/es.json'
import ja from './locales/ja.json'

export const LANGUAGES = [
  { code: 'en', name: 'English',  flag: '🇬🇧' },
  { code: 'hi', name: 'हिंदी',    flag: '🇮🇳' },
  { code: 'kn', name: 'ಕನ್ನಡ',   flag: '🇮🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch',  flag: '🇩🇪' },
  { code: 'es', name: 'Español',  flag: '🇪🇸' },
  { code: 'ja', name: '日本語',   flag: '🇯🇵' },
]

const LOCALES = { en, hi, kn, fr, de, es, ja }

/** Get nested value safely: t('auth.signIn') */
export function getTranslation(locale, key) {
  const parts = key.split('.')
  let obj = LOCALES[locale] || LOCALES.en
  for (const p of parts) {
    if (obj == null) return key
    obj = obj[p]
  }
  // fallback to English if key missing in locale
  if (obj === undefined) {
    let fallback = LOCALES.en
    for (const p of parts) {
      if (fallback == null) return key
      fallback = fallback[p]
    }
    return fallback ?? key
  }
  return obj ?? key
}
