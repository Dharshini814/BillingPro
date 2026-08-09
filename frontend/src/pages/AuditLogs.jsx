import { useCallback, useEffect, useState } from 'react'
import { auditService } from '../services/auditService'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../hooks/useToast'
import { formatDateTime } from '../utils/formatters'
import SearchBar from '../components/common/SearchBar.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { ShieldIcon } from '../components/common/Icons.jsx'
import styles from './AuditLogs.module.css'

const ENTITIES = ['all', 'subscription', 'customer', 'payment', 'refund', 'plan']
const ACTIONS  = ['all', 'created', 'updated', 'deleted', 'cancelled', 'refunded', 'payment', 'plan_change']

const ACTION_COLORS = {
  created:     '#4CAF50',
  updated:     '#D4A800',
  canceled:    '#FFB547',
  deleted:     '#FF5A5A',
  refunded:    '#F5C518',
  'logged in': '#4CAF50',
  exported:    '#D4A800',
}

const inp = {
  background: 'var(--color-bg)', border: 'none', borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--shadow-pressed)', padding: '11px 14px', fontSize: 13,
  color: 'var(--color-text-primary)', outline: 'none', fontFamily: 'inherit',
}

export default function AuditLogs() {
  const toast = useToast()
  const [items,    setItems]    = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [entity,   setEntity]   = useState('all')
  const [action,   setAction]   = useState('all')
  const [search,   setSearch]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const debouncedSearch = useDebounce(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditService.list({
        entity, action,
        search: debouncedSearch,
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        page,
        pageSize: 15,
      })
      setItems(res?.items ?? [])
      setTotal(res?.total ?? 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load audit logs' })
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [entity, action, debouncedSearch, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [entity, action, debouncedSearch, dateFrom, dateTo])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Log Viewer</h1>
          <p className={styles.subtitle}>
            Complete activity trail — {total} total {total === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className={styles.filters}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search description…" className={styles.search} />

        <select className={styles.select} value={entity} onChange={(e) => setEntity(e.target.value)}>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>
              {e === 'all' ? 'All Entities' : e.charAt(0).toUpperCase() + e.slice(1)}
            </option>
          ))}
        </select>

        <select className={styles.select} value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? 'All Actions'
                : a === 'plan_change' ? 'Plan Change'
                : a === 'payment' ? 'Payment Processed'
                : a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>

        {/* Date Range filters */}
        <input
          type="date"
          style={{ ...inp, minWidth: 140 }}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
        />
        <input
          type="date"
          style={{ ...inp, minWidth: 140 }}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="To date"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            style={{
              padding: '8px 14px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'rgba(255,90,90,0.12)', color: '#FF5A5A',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Clear dates
          </button>
        )}
      </div>

      {/* ── Log Table ── */}
      <div className={styles.logCard}>
        {/* Header row */}
        <div className={styles.logRow} style={{ borderBottom: '2px solid var(--color-border)', opacity: 0.6 }}>
          <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entity</span>
          <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</span>
          <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</span>
          <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Date / Time</span>
        </div>

        {loading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={styles.logRow}>
              <Skeleton height={14} width="70%" borderRadius={99} />
              <Skeleton height={14} width="60%" borderRadius={99} />
              <Skeleton height={14} width="85%" />
              <Skeleton height={14} width="50%" />
            </div>
          ))
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon size={26} />}
            title="No log entries"
            description="Actions like creating customers, plans, and payments will appear here automatically."
          />
        ) : (
          items.map((log) => (
            <div key={log.id} className={styles.logRow}>
              <span className={styles.entityBadge}>{log.entity}</span>
              <span
                className={styles.actionBadge}
                style={{
                  color: ACTION_COLORS[log.action?.toLowerCase()] || '#6B7280',
                  background: `${ACTION_COLORS[log.action?.toLowerCase()] || '#6B7280'}18`,
                }}
              >
                {log.action}
              </span>
              <span className={styles.description} title={log.description}>{log.description}</span>
              <span className={styles.timestamp}>{formatDateTime(log.timestamp)}</span>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={15} total={total} onChange={setPage} />
    </div>
  )
}
