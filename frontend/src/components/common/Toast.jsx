import styles from './Toast.module.css'

const ICONS = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" width={18}><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" /></svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" width={18}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" width={18}><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-5a1 1 0 00-1 1v2a1 1 0 002 0V9a1 1 0 00-1-1z" /></svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" width={18}><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 4a1 1 0 00-1 1v3a1 1 0 002 0v-3a1 1 0 00-1-1z" /></svg>
  ),
}

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className={styles.stack}>
      {toasts.map((toast) => (
        <div key={toast.id} className={[styles.toast, styles[toast.type]].join(' ')}>
          <span className={styles.iconWrap}>{ICONS[toast.type] || ICONS.info}</span>
          <p className={styles.message}>{toast.message}</p>
          <button className={styles.close} onClick={() => onDismiss(toast.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  )
}
