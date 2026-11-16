import LanguageSwitcher from '../common/LanguageSwitcher.jsx'
import styles from '../../pages/Auth.module.css'

/**
 * Left hero panel shared by SignIn and SignUp — brand mark, headline,
 * subtitle and the language switcher (bottom-left), matching the
 * split-screen reference design.
 */
export default function AuthHero({ title, subtitle }) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroGlow} />

      <div className={styles.heroLogoRow}>
        <div className={styles.heroLogoMark}>V</div>
        <span className={styles.heroLogoText}>Vaultly</span>
      </div>

      <div className={styles.heroCopy}>
        <h1 className={styles.heroTitle}>
          {title === 'Create your account' && (
            <span style={{ 
              background: 'linear-gradient(135deg, var(--color-primary), #F5C518)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              display: 'inline-block'
            }}>
              Welcome! 👋
            </span>
          )}
          {title !== 'Create your account' && title}
        </h1>
        <p className={styles.heroSubtitle}>
          {title === 'Create your account' 
            ? "Let's get you started with your billing journey — it only takes a minute!" 
            : subtitle
          }
        </p>
      </div>

      <div className={styles.heroFooter}>
        <LanguageSwitcher />
      </div>
    </div>
  )
}
