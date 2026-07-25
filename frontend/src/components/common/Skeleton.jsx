import styles from './Skeleton.module.css'

export default function Skeleton({ width, height, borderRadius, className = '' }) {
  return (
    <span
      className={[styles.skeleton, className].join(' ')}
      style={{ width, height, borderRadius }}
    />
  )
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className={styles.card}>
      <Skeleton height={18} width="55%" borderRadius={8} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} height={12} width={`${70 + i * 8}%`} borderRadius={6} />
        ))}
      </div>
    </div>
  )
}
