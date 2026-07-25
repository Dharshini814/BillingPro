import styles from './Input.module.css'

export default function Input({
  label,
  error,
  hint,
  icon,
  rightElement,
  className = '',
  wrapperClass = '',
  ...props
}) {
  return (
    <div className={[styles.wrapper, wrapperClass].join(' ')}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={[styles.inputWrap, error ? styles.hasError : ''].join(' ')}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input
          className={[styles.input, icon ? styles.withIcon : '', className].filter(Boolean).join(' ')}
          {...props}
        />
        {rightElement && <span className={styles.right}>{rightElement}</span>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}
