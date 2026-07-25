import styles from './Pagination.module.css'

export default function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)

  const rendered = []
  let prev = null
  for (const p of pages) {
    if (prev !== null && p - prev > 1) rendered.push('...')
    rendered.push(p)
    prev = p
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.info}>
        {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className={styles.controls}>
        <button className={styles.btn} onClick={() => onChange(page - 1)} disabled={page === 1}>‹</button>
        {rendered.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className={styles.ellipsis}>…</span>
            : <button
                key={p}
                className={[styles.btn, p === page ? styles.active : ''].join(' ')}
                onClick={() => onChange(p)}
              >{p}</button>
        )}
        <button className={styles.btn} onClick={() => onChange(page + 1)} disabled={page === totalPages}>›</button>
      </div>
    </div>
  )
}
