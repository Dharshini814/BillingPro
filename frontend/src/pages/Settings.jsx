import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../hooks/useLang.js'
import { LANGUAGES } from '../i18n/index.js'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { useNavigate } from 'react-router-dom'
import { getInitials } from '../utils/formatters'
import Input from '../components/common/Input.jsx'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import { SunIcon, MoonIcon, LogOutIcon } from '../components/common/Icons.jsx'
import styles from './Settings.module.css'

export default function Settings() {
  const { user, logout } = useAuth()
  const { t, lang, switchLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
  })
  const [saving, setSaving] = useState(false)
  const [notifications, setNotifications] = useState({
    failedPayments: true, newSubscriptions: true, invoiceDue: false, weeklyReport: true,
  })

  function set(key) { return (e) => setForm((p) => ({ ...p, [key]: e.target.value })) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    toast.push({ type: 'success', message: 'Profile updated successfully.' })
  }

  function handleLogout() {
    logout()
    navigate('/signin')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </div>

      <div className={styles.grid}>
        {/* Profile */}
        <Card className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.avatarLg}>{getInitials(form.name || 'U')}</div>
            <div>
              <h2 className={styles.sectionTitle}>{t('settings.profile')}</h2>
              <p className={styles.sectionSub}>{t('settings.profileSubtitle')}</p>
            </div>
          </div>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.twoCol}>
              <Input label="Full Name" value={form.name} onChange={set('name')} />
              <Input label="Company" value={form.company} onChange={set('company')} />
            </div>
            <Input label="Email Address" type="email" value={form.email} onChange={set('email')} />
            <Input label="New Password" type="password" placeholder="Leave blank to keep current" />
            <Button type="submit" variant="primary" loading={saving}>{t('settings.saveChanges')}</Button>
          </form>
        </Card>

        <div className={styles.rightCol}>
          {/* Appearance */}
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.appearance')}</h2>
            <p className={styles.sectionSub}>Choose your preferred interface theme</p>
            <div className={styles.themeRow}>
              <button
                className={[styles.themeBtn, theme === 'light' ? styles.themeBtnActive : ''].join(' ')}
                onClick={() => theme !== 'light' && toggleTheme()}
              >
                <SunIcon size={20} />
                <span>Light</span>
              </button>
              <button
                className={[styles.themeBtn, theme === 'dark' ? styles.themeBtnActive : ''].join(' ')}
                onClick={() => theme !== 'dark' && toggleTheme()}
              >
                <MoonIcon size={20} />
                <span>Dark</span>
              </button>
            </div>
          </Card>

          {/* Notifications */}
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>Notifications</h2>
            <p className={styles.sectionSub}>Control when you receive email alerts</p>
            <div className={styles.notifList}>
              {Object.entries(notifications).map(([key, val]) => {
                const labels = {
                  failedPayments: 'Failed payment alerts',
                  newSubscriptions: 'New subscription signups',
                  invoiceDue: 'Invoice due reminders',
                  weeklyReport: 'Weekly summary report',
                }
                return (
                  <label key={key} className={styles.notifRow}>
                    <span className={styles.notifLabel}>{labels[key]}</span>
                    <div
                      className={[styles.toggle, val ? styles.toggleOn : ''].join(' ')}
                      onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))}
                      role="switch"
                      aria-checked={val}
                      tabIndex={0}
                    >
                      <div className={styles.toggleThumb} />
                    </div>
                  </label>
                )
              })}
            </div>
          </Card>


          {/* Language */}
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.language')}</h2>
            <p className={styles.sectionSub}>{t('settings.languageSubtitle')}</p>
            <div className={styles.langGrid}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  className={[styles.langBtn, lang === l.code ? styles.langBtnActive : ''].join(' ')}
                  onClick={() => switchLang(l.code)}
                >
                  <span style={{ fontSize: 20 }}>{l.flag}</span>
                  <span>{l.name}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Danger zone */}
          <Card className={[styles.section, styles.dangerSection].join(' ')}>
            <h2 className={[styles.sectionTitle, styles.dangerTitle].join(' ')}>Danger Zone</h2>
            <p className={styles.sectionSub}>Irreversible actions — proceed with caution</p>
            <div className={styles.dangerActions}>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOutIcon size={15} /> Sign Out
              </Button>
              <Button variant="danger">Delete Account</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
