import { useCountUp } from '../../hooks/useCountUp'
import styles from './KpiCard.module.css'

export default function KpiCard({ title, value, prefix = '', suffix = '', icon, trend, trendLabel, color = '#D4A800', loading }) {
  const animated = useCountUp(loading ? 0 : (typeof value === 'number' ? value : 0), 1000)
  const displayValue = typeof value === 'number'
    ? `${prefix}${animated >= 1000
        ? animated >= 1_000_000
          ? (animated / 1_000_000).toFixed(1) + 'M'
          : (animated / 1000).toFixed(1) + 'K'
        : Math.round(animated).toLocaleString()}${suffix}`
    : value || '—'

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.iconWrap} style={{ background: `${color}18`, color }}>
          {icon}
        </span>
      </div>

      <div className={styles.value}>
        {loading ? <span className={styles.skeleton} /> : displayValue}
      </div>

      {trend !== undefined && !loading && (
        <div className={[styles.trend, trend >= 0 ? styles.positive : styles.negative].join(' ')}>
          <span>{trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%</span>
          {trendLabel && <span className={styles.trendLabel}>{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
