import styles from './Badge.module.css'

const STATUS_MAP = {
  active: 'success',
  trialing: 'primary',
  past_due: 'warning',
  canceled: 'neutral',
  cancelled: 'neutral',
  paused: 'neutral',
  paid: 'success',
  pending: 'warning',
  overdue: 'error',
  draft: 'neutral',
  void: 'neutral',
  succeeded: 'success',
  failed: 'error',
  refunded: 'primary',
  pending_approval: 'warning',
  rejected: 'error',
  completed: 'success',
}

export default function Badge({ status, label, variant, className = '' }) {
  const resolvedVariant = variant || STATUS_MAP[status] || 'neutral'
  const displayLabel = label || (status ? status.replace(/_/g, ' ') : '')

  return (
    <span className={[styles.badge, styles[resolvedVariant], className].join(' ')}>
      <span className={styles.dot} />
      {displayLabel}
    </span>
  )
}
