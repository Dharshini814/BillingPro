import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { isValidEmail, getPasswordStrength } from '../utils/validators'
import Input from '../components/common/Input.jsx'
import { useLang } from '../hooks/useLang.js'
import AuthHero from '../components/auth/AuthHero.jsx'
import AuthTabs from '../components/auth/AuthTabs.jsx'
import RoleToggle from '../components/auth/RoleToggle.jsx'
import Button from '../components/common/Button.jsx'
import styles from './Auth.module.css'

export default function SignUp() {
  const { signUp } = useAuth()
  const { t } = useLang()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '', role: 'user', email: '', password: '', confirmPassword: '', companyName: ''
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const strength = getPasswordStrength(form.password)

  function set(key) {
    return (e) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function setRole(role) {
    setForm((prev) => ({ ...prev, role }))
  }

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Full name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!isValidEmail(form.email)) e.email = 'Enter a valid email'
    if (!form.companyName.trim()) e.companyName = 'Company name is required'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    return e
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setErrors({})
    setLoading(true)
    try {
      await signUp(form)
      toast.push({ type: 'success', message: 'Account created! Please sign in.' })
      navigate('/signin')
    } catch (err) {
      toast.push({ type: 'error', message: err.message || 'Sign up failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <AuthHero title={t('auth.signupTitle')} subtitle={t('auth.signupSubtitle')} />

      <div className={styles.formSide}>
        <div className={[styles.card, styles.cardWide].join(' ')}>
          <AuthTabs active="signup" />

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            <Input
              label={t('auth.fullName')}
              placeholder="Ada Lovelace"
              value={form.fullName}
              onChange={set('fullName')}
              error={errors.fullName}
              autoFocus
            />

            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t('auth.role')}</span>
              <RoleToggle value={form.role} onChange={setRole} />
            </div>

            <div className={styles.twoCol}>
              <Input
                label={t('auth.email')}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                error={errors.email}
                autoComplete="email"
              />
              <Input
                label={t('auth.companyName')}
                placeholder="Acme Corp"
                value={form.companyName}
                onChange={set('companyName')}
                error={errors.companyName}
              />
            </div>

            <div>
              <Input
                label={t('auth.password')}
                type="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set('password')}
                error={errors.password}
                autoComplete="new-password"
              />
              {form.password.length > 0 && (
                <div className={styles.strengthWrap}>
                  <div className={styles.strengthBar}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={styles.strengthSegment}
                        style={{ background: n <= strength.score ? strength.color : undefined }}
                      />
                    ))}
                  </div>
                  <span className={styles.strengthLabel} style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
            </div>

            <Input
              label={t('auth.confirmPassword')}
              type="password"
              placeholder="Repeat password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Button type="submit" variant="primary" full loading={loading}>
              {t('auth.createAccount')}
            </Button>
          </form>

          <div className={styles.divider}><span>{t('auth.orSignUpWith')}</span></div>
          <div className={styles.socials}>
            {['Google', 'GitHub'].map((s) => (
              <button key={s} type="button" className={styles.socialBtn}>
                <span className={styles.socialIcon}>{s === 'Google' ? 'G' : '⌥'}</span>
                {s}
              </button>
            ))}
          </div>

          <p className={styles.switchText}>
            {t('auth.haveAccount')}{' '}
            <Link to="/signin" className={styles.switchLink}>{t('auth.signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
