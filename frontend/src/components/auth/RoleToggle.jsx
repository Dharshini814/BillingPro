import { useLang } from '../../hooks/useLang.js'
import styles from './AuthTabs.module.css'

/**
 * User / Admin pill toggle for the sign-up form.
 * Reuses the same pill visual language as AuthTabs for consistency.
 */
export default function RoleToggle({ value, onChange }) {
  const { t } = useLang()

  return (
    <div className={styles.tabs} role="radiogroup" aria-label={t('auth.role')}>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'user'}
        className={[styles.tab, value === 'user' ? styles.active : ''].join(' ')}
        onClick={() => onChange('user')}
      >
        {t('auth.roleUser')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'admin'}
        className={[styles.tab, value === 'admin' ? styles.active : ''].join(' ')}
        onClick={() => onChange('admin')}
      >
        {t('auth.roleAdmin')}
      </button>
    </div>
  )
}
