import { useNavigate } from 'react-router-dom'
import { useLang } from '../../hooks/useLang.js'
import styles from './AuthTabs.module.css'

/**
 * Pill-shaped Sign in / Sign up tab switcher used at the top of the auth card.
 * Navigates between the two routes, keeping SignIn.jsx and SignUp.jsx as
 * fully separate pages/routes while sharing one consistent control.
 */
export default function AuthTabs({ active }) {
  const navigate = useNavigate()
  const { t } = useLang()

  return (
    <div className={styles.tabs} role="tablist" aria-label="Authentication">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'signin'}
        className={[styles.tab, active === 'signin' ? styles.active : ''].join(' ')}
        onClick={() => navigate('/signin')}
      >
        {t('auth.signIn')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'signup'}
        className={[styles.tab, active === 'signup' ? styles.active : ''].join(' ')}
        onClick={() => navigate('/signup')}
      >
        {t('auth.signUp')}
      </button>
    </div>
  )
}
