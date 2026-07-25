import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { useLang } from '../hooks/useLang'
import { isValidEmail } from '../utils/validators'
import { REMEMBER_KEY } from '../utils/constants'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'
import AuthHero from '../components/auth/AuthHero.jsx'
import AuthTabs from '../components/auth/AuthTabs.jsx'
import styles from './Auth.module.css'

export default function SignIn() {
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const from = location.state?.from?.pathname || '/dashboard'

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(!!localStorage.getItem(REMEMBER_KEY))
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!email) e.email = 'Email is required'
    else if (!isValidEmail(email)) e.email = 'Enter a valid email'
    if (!password) e.password = 'Password is required'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setLoading(true)
    try {
      await signIn({ email, password })
      if (remember) localStorage.setItem(REMEMBER_KEY, email)
      else localStorage.removeItem(REMEMBER_KEY)
      toast.push({ type: 'success', message: 'Welcome back!' })
      navigate(from, { replace: true })
    } catch (err) {
      toast.push({ type: 'error', message: err.message || 'Sign in failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <AuthHero title={t('auth.welcomeBack')} subtitle={t('auth.loginSubtitle')} />

      <div className={styles.formSide}>
        <div className={styles.card}>
          <AuthTabs active="signin" />

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <Input
              label={t('auth.email')}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
              autoFocus
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />

            <div className={styles.row}>
              <label className={styles.check}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span>{t('auth.rememberMe')}</span>
              </label>
              <button type="button" className={styles.link}>{t('auth.forgotPassword')}</button>
            </div>

            <Button type="submit" variant="primary" full loading={loading}>
              {t('auth.signIn')}
            </Button>
          </form>

          <div className={styles.divider}><span>{t('auth.orContinueWith')}</span></div>
          <div className={styles.socials}>
            {['Google', 'GitHub'].map((s) => (
              <button key={s} type="button" className={styles.socialBtn}>
                <span className={styles.socialIcon}>{s === 'Google' ? 'G' : '⌥'}</span>{s}
              </button>
            ))}
          </div>

          <p className={styles.switchText}>
            {t('auth.noAccount')}{' '}
            <Link to="/signup" className={styles.switchLink}>{t('auth.createFree')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
