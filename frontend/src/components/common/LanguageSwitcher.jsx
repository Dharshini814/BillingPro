import { useEffect, useRef, useState } from 'react'
import { LANGUAGES } from '../../i18n/index.js'
import { useLang } from '../../hooks/useLang.js'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher() {
  const { lang, switchLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.wrap} ref={ref}>
      <button className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-label="Switch language">
        <span className={styles.flag}>{current.flag}</span>
        <span className={styles.code}>{current.code.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.5 }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={[styles.option, l.code === lang ? styles.active : ''].join(' ')}
              onClick={() => { switchLang(l.code); setOpen(false) }}
            >
              <span className={styles.flag}>{l.flag}</span>
              <span className={styles.name}>{l.name}</span>
              {l.code === lang && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
