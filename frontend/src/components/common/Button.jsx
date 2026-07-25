import styles from './Button.module.css'

export default function Button({
  children,
  variant = 'default',
  size = '',
  loading = false,
  full = false,
  className = '',
  ...props
}) {
  const cls = [
    styles.btn,
    styles[variant] || '',
    size ? styles[size] : '',
    full ? styles.full : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading && (
        <span className={variant === 'primary' || variant === 'danger' ? styles.spinner : styles.spinnerDark} />
      )}
      {children}
    </button>
  )
}
