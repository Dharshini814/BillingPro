import styles from './Card.module.css'

export default function Card({ children, className = '', padding = 'md', hover = false, ...props }) {
  const cls = [
    styles.card,
    styles[`pad_${padding}`],
    hover ? styles.hover : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} {...props}>
      {children}
    </div>
  )
}
