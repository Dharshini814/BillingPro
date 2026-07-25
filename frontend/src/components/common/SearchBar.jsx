import styles from './SearchBar.module.css'

export default function SearchBar({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={[styles.wrap, className].join(' ')}>
      <svg className={styles.icon} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx={9} cy={9} r={6} /><path d="M15 15l3 3" strokeLinecap="round"/>
      </svg>
      <input
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className={styles.clear} onClick={() => onChange('')} aria-label="Clear">×</button>
      )}
    </div>
  )
}
