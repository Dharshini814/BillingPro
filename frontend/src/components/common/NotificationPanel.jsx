import { useEffect, useRef } from 'react'
import { timeAgo } from '../../utils/formatters'
import styles from './NotificationPanel.module.css'

const ADMIN_NOTIFS = [
  { id: 1, type: 'error',   title: 'Payment Failed',        message: 'Ava Thompson — Visa ••4242 declined', time: new Date(Date.now() - 1000*60*12).toISOString() },
  { id: 2, type: 'success', title: 'New Subscription',       message: 'Orbital Cloud signed up for Scale plan', time: new Date(Date.now() - 1000*60*40).toISOString() },
  { id: 3, type: 'warning', title: 'Invoice Overdue',        message: 'INV-03005 is 7 days overdue — $199', time: new Date(Date.now() - 1000*60*90).toISOString() },
  { id: 4, type: 'info',    title: 'New Customer',           message: 'Priya Sharma joined from Enterprise trial', time: new Date(Date.now() - 1000*60*180).toISOString() },
  { id: 5, type: 'success', title: 'Refund Processed',       message: '$79 refund issued to Noah Patel', time: new Date(Date.now() - 1000*60*300).toISOString() },
]

const USER_NOTIFS = [
  { id: 1, type: 'warning', title: 'Invoice Due Soon',    message: 'INV-03020 of $79 is due in 3 days', time: new Date(Date.now() - 1000*60*30).toISOString() },
  { id: 2, type: 'success', title: 'Payment Successful',  message: 'Your Growth plan payment of $79 was processed', time: new Date(Date.now() - 1000*60*60*24).toISOString() },
  { id: 3, type: 'info',    title: 'Plan Renewal',        message: 'Your subscription renews in 7 days', time: new Date(Date.now() - 1000*60*60*48).toISOString() },
]

const TYPE_COLORS = { error: '#FF5A5A', success: '#4CAF50', warning: '#FFB547', info: '#D4A800' }
const TYPE_ICONS  = { error: '✕', success: '✓', warning: '!', info: 'i' }

export default function NotificationPanel({ open, onClose, isAdmin }) {
  const ref = useRef(null)
  const notifs = isAdmin ? ADMIN_NOTIFS : USER_NOTIFS

  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.panel} ref={ref}>
      <div className={styles.header}>
        <h3 className={styles.title}>Notifications</h3>
        <span className={styles.badge}>{notifs.length}</span>
      </div>
      <div className={styles.list}>
        {notifs.map((n) => (
          <div key={n.id} className={styles.item}>
            <div className={styles.dot} style={{ background: TYPE_COLORS[n.type] }}>
              {TYPE_ICONS[n.type]}
            </div>
            <div className={styles.body}>
              <p className={styles.itemTitle}>{n.title}</p>
              <p className={styles.itemMsg}>{n.message}</p>
              <p className={styles.itemTime}>{timeAgo(n.time)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <button className={styles.clearBtn} onClick={onClose}>Mark all as read</button>
      </div>
    </div>
  )
}
