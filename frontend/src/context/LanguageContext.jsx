import { createContext, useCallback, useMemo, useState } from 'react'
import { getTranslation } from '../i18n/index.js'

export const LanguageContext = createContext(null)

const LANG_KEY = 'vri_lang'

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'en')

  const switchLang = useCallback((code) => {
    setLang(code)
    localStorage.setItem(LANG_KEY, code)
    // set dir for future RTL support
    document.documentElement.lang = code
  }, [])

  const t = useCallback((key) => getTranslation(lang, key), [lang])

  const value = useMemo(() => ({ lang, switchLang, t }), [lang, switchLang, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
