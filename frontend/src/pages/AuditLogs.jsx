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

const ENTITIES = ['all', 'Subscription', 'Customer', 'Invoice', 'Payment', 'Plan', 'User']
const ACTIONS  = ['all', 'created', 'updated', 'canceled', 'deleted', 'refunded', 'logged in', 'exported']

const ACTION_COLORS = {
  created:    '#4CAF50',
  updated:    '#D4A800',
  canceled:   '#FFB547',
  deleted:    '#FF5A5A',
  refunded:   '#F5C518',
  'logged in':'#4CAF50',
  exported:   '#D4A800',
}

export default function AuditLogs() {
  const toast = useToast()
  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [entity,  setEntity]  = useState('all')
  const [action,  setAction]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const debouncedSearch = useDebounce(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await auditService.list({ entity, action, search: debouncedSearch, page, pageSize: 10 })
      setItems(res?.items  ?? [])
      setTotal(res?.total  ?? 0)
    } catch (err) {
      toast.push({ type: 'error', message: 'Failed to load audit logs' })
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [entity, action, debouncedSearch, page])

  useEffect(() => { load() },                          [load])
  useEffect(() => { setPage(1) }, [entity, action, debouncedSearch])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Audit Logs</h1>
          <p className={styles.subtitle}>
            Complete activity trail — {total} total {total === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>

      <div className={styles.filters}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search logs…" className={styles.search} />
        <select className={styles.select} value={entity} onChange={(e) => setEntity(e.target.value)}>
          {ENTITIES.map((e) => (
            <option key={e} value={e}>{e === 'all' ? 'All Entities' : e}</option>
          ))}
        </select>
        <select className={styles.select} value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a === 'all' ? 'All Actions' : a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.logCard}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.logRow}>
              <Skeleton height={14} width="12%" borderRadius={99} />
              <Skeleton height={14} width="10%" borderRadius={99} />
              <Skeleton height={14} width="50%" />
              <Skeleton height={14} width="18%" />
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
                  color: ACTION_COLORS[log.action] || '#6B7280',
                  background: `${ACTION_COLORS[log.action] || '#6B7280'}18`,
                }}
              >
                {log.action}
              </span>
              <span className={styles.description}>{log.description}</span>
              <span className={styles.timestamp}>{formatDateTime(log.timestamp)}</span>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={10} total={total} onChange={setPage} />
    </div>
  )
}
