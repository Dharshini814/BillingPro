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
        <h1 className={styles.heroTitle}>{title}</h1>
        <p className={styles.heroSubtitle}>{subtitle}</p>
      </div>

      <div className={styles.heroFooter}>
        <LanguageSwitcher />
      </div>
    </div>
  )
}
