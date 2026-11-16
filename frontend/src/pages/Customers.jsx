import { useCallback, useEffect, useState } from 'react'
import { customerService } from '../services/customerService'
import { useToast } from '../hooks/useToast'
import { useDebounce } from '../hooks/useDebounce'
import { formatDate, formatCurrency, getInitials } from '../utils/formatters'
import SearchBar from '../components/common/SearchBar.jsx'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Modal from '../components/common/Modal.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import { UsersIcon, TrashIcon, PlusIcon } from '../components/common/Icons.jsx'
import api from '../services/api'
import styles from './Customers.module.css'

const STATUS_OPTIONS = ['all', 'active', 'inactive']

const COUNTRY_CURRENCY_MAP = {
  "India": "INR", "United States": "USD", "United Kingdom": "GBP",
  "Germany": "EUR", "France": "EUR", "Netherlands": "EUR", "Italy": "EUR",
  "Spain": "EUR", "Canada": "CAD", "Australia": "AUD", "New Zealand": "NZD",
  "UAE": "AED", "Singapore": "SGD", "Japan": "JPY", "South Korea": "KRW",
  "Brazil": "BRL", "Mexico": "MXN", "South Africa": "ZAR", "China": "CNY",
  "Russia": "RUB", "Switzerland": "CHF", "Sweden": "SEK", "Norway": "NOK",
  "Denmark": "DKK", "Finland": "EUR", "Poland": "PLN", "Thailand": "THB",
  "Malaysia": "MYR", "Indonesia": "IDR", "Philippines": "PHP",
}

const EMPTY_FORM = {
  name: '', email: '', company: '', phone: '', address: '',
  status: 'Active', country: 'India', currency: 'INR'
}

const inp = {
  background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
  borderRadius: 10, padding: '9px 14px', fontSize: 14,
  color: 'var(--color-text)', boxShadow: 'var(--shadow-pressed)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

// ── Type → color / icon for billing timeline ──
const EVENT_STYLES = {
  subscription:          { color: '#4CAF50', label: '🔁' },
  subscription_cancelled:{ color: '#FF5A5A', label: '🚫' },
  invoice:               { color: '#D4A800', label: '🧾' },
  payment:               { color: '#4CAF50', label: '💳' },
  refund:                { color: '#FFB547', label: '↩️' },
}

function TimelineEvent({ event }) {
  const style = EVENT_STYLES[event.type] || { color: '#6B7280', label: '•' }
  const isPaymentFailed = event.type === 'payment' && event.status === 'failed'
  return (
    <div style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: `${isPaymentFailed ? '#FF5A5A' : style.color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>
        {style.label}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 13, color: isPaymentFailed ? '#FF5A5A' : 'var(--color-text-primary)', margin: 0 }}>
          {event.title}
        </p>
        {event.meta?.amount != null && (
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            {formatCurrency(event.meta.amount)}
            {event.meta.method ? ` · ${event.meta.method}` : ''}
            {event.meta.plan ? ` · ${event.meta.plan}` : ''}
          </p>
        )}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginTop: 2 }}>
        {event.date ? new Date(event.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
      </span>
    </div>
  )
}

function ActivityCard({ summary, loading }) {
  const items = [
    { label: 'Total Invoices',       value: summary?.total_invoices ?? '—',                  color: '#D4A800' },
    { label: 'Total Paid',           value: summary ? formatCurrency(summary.total_paid) : '—', color: '#4CAF50' },
    { label: 'Failed Payments',      value: summary?.failed_payments ?? '—',                color: '#FF5A5A' },
    { label: 'Refunds',              value: summary?.refunds ?? '—',                        color: '#FFB547' },
    { label: 'Active Subscriptions', value: summary?.active_subscriptions ?? '—',           color: '#4CAF50' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          background: `${color}10`, border: `1px solid ${color}28`,
          borderRadius: 12, padding: '14px 16px',
        }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
          <p style={{ fontSize: 20, fontWeight: 800, color, margin: '6px 0 0' }}>
            {loading ? '…' : value}
          </p>
        </div>
      ))}
    </div>
  )
}

function SubscriptionHistory({ history, loading }) {
  if (loading) return <Skeleton height={14} width="80%" />
  if (!history || history.changes?.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No plan change history recorded yet.</p>
  }
  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
        Current Plan: <span style={{ color: '#D4A800' }}>{history.current_plan}</span>
        &nbsp;·&nbsp;Status: <span style={{ textTransform: 'capitalize' }}>{history.current_status}</span>
      </p>
      {history.changes.map((c, i) => (
        <div key={i} style={{
          display: 'flex', gap: 12, padding: '10px 0',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 13,
        }}>
          <span style={{ color: 'var(--color-text-secondary)', minWidth: 90, fontSize: 11 }}>
            {c.date ? new Date(c.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—'}
          </span>
          <span style={{ flex: 1, color: 'var(--color-text-primary)', fontWeight: 500 }}>
            {c.description || c.action}
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{c.performed_by}</span>
        </div>
      ))}
    </div>
  )
}

// ── Customer Detail Modal ──
function CustomerDetailModal({ customer, onClose }) {
  const [activeTab, setActiveTab]   = useState('timeline')
  const [timeline,  setTimeline]    = useState(null)
  const [summary,   setSummary]     = useState(null)
  const [subHistory, setSubHistory] = useState(null)
  const [tLoading,  setTLoading]    = useState(true)
  const [sLoading,  setSLoading]    = useState(true)
  const [hLoading,  setHLoading]    = useState(true)

  const AVATAR_COLORS = ['#D4A800', '#F5C518', '#4CAF50', '#FFB547', '#FF5A5A']
  const avatarColor = AVATAR_COLORS[customer.id % AVATAR_COLORS.length]

  useEffect(() => {
    if (!customer) return

    // Load billing history
    api.get(`/customers/${customer.id}/billing-history`)
      .then(r => setTimeline(r.data))
      .finally(() => setTLoading(false))

    // Load activity summary
    api.get(`/customers/${customer.id}/activity-summary`)
      .then(r => setSummary(r.data))
      .finally(() => setSLoading(false))
  }, [customer])

  // Load subscription history lazily when tab is opened
  useEffect(() => {
    if (activeTab !== 'subscriptions' || subHistory !== null) return
    // Find first subscription from timeline to get id, or try customer's subscriptions endpoint
    api.get(`/subscriptions/`, { params: { customer_id: customer.id, pageSize: 50 } })
      .then(async r => {
        const subs = r.data?.items || []
        if (subs.length === 0) { setSubHistory({ changes: [] }); return }
        // Load history for first (most recent) subscription
        const latestSub = subs[0]
        const hr = await api.get(`/subscriptions/${latestSub.id}/history`)
        setSubHistory(hr.data)
      })
      .catch(() => setSubHistory({ changes: [] }))
      .finally(() => setHLoading(false))
  }, [activeTab, customer, subHistory])

  const TABS = [
    { key: 'timeline',      label: 'Billing Timeline' },
    { key: 'activity',      label: 'Activity Summary' },
    { key: 'subscriptions', label: 'Subscription History' },
  ]

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
      style={{
        padding: '8px 16px', border: 'none', borderRadius: 99,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        background: activeTab === key ? '#D4A800' : 'transparent',
        color: activeTab === key ? '#fff' : 'var(--color-text-secondary)',
        transition: 'all 0.18s',
      }}
    >
      {label}
    </button>
  )

  return (
    <Modal
      isOpen={!!customer}
      onClose={onClose}
      title=""
      width={680}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {/* Customer Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 18, flexShrink: 0,
        }}>
          {getInitials(customer.name)}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{customer.name}</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {customer.email} · {customer.company || 'No company'} · {customer.country || 'India'}
          </p>
        </div>
        <Badge status={customer.status?.toLowerCase()} style={{ marginLeft: 'auto' }} />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--color-bg)',
        boxShadow: 'var(--shadow-pressed)', borderRadius: 99,
        padding: 4, marginBottom: 20, width: 'fit-content',
      }}>
        {TABS.map(t => tabBtn(t.key, t.label))}
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
          {tLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <Skeleton height={36} width={36} borderRadius={99} />
                <div style={{ flex: 1 }}><Skeleton height={13} width="70%" /><Skeleton height={11} width="40%" /></div>
              </div>
            ))
          ) : !timeline?.events?.length ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, padding: '20px 0' }}>No billing events found for this customer.</p>
          ) : (
            timeline.events.map((event, i) => <TimelineEvent key={i} event={event} />)
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityCard summary={summary} loading={sLoading} />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionHistory history={subHistory} loading={hLoading} />
      )}
    </Modal>
  )
}

// ── Main Customers Page ──
export default function Customers() {
  const toast = useToast()
  const [items, setItems]               = useState([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [search, setSearch]             = useState('')
  const [status, setStatus]             = useState('all')
  const [loading, setLoading]           = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showAdd, setShowAdd]           = useState(false)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const debouncedSearch = useDebounce(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerService.list({ search: debouncedSearch, status, page, pageSize: 8 })
      setItems(res?.items || [])
      setTotal(res?.total || 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load customers' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch, status])

  async function handleDelete() {
    try {
      await customerService.remove(deleteTarget.id)
      toast.push({ type: 'success', message: `${deleteTarget.name} removed.` })
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.response?.data?.detail || err.message })
    }
  }

  function setField(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'country') next.currency = COUNTRY_CURRENCY_MAP[v] || 'USD'
      return next
    })
  }

  async function handleAddCustomer() {
    if (!form.name || !form.email) {
      toast.push({ type: 'error', message: 'Name and email are required.' })
      return
    }
    setSaving(true)
    try {
      await customerService.create(form)
      toast.push({ type: 'success', message: `${form.name} added successfully.` })
      setShowAdd(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.response?.data?.detail || 'Failed to add customer' })
    } finally {
      setSaving(false)
    }
  }

  const AVATAR_COLORS = ['#D4A800', '#F5C518', '#4CAF50', '#FFB547', '#FF5A5A']

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customers</h1>
          <p className={styles.subtitle}>{total} total customers</p>
        </div>
        <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true) }}>
          <PlusIcon size={14} /> Add Customer
        </Button>
      </div>

      <div className={styles.filters}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search customers…" className={styles.search} />
        <div className={styles.statusTabs}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Customer</span>
          <span>Company</span>
          <span>Phone</span>
          <span>Country</span>
          <span>Status</span>
          <span>Joined</span>
          <span></span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tableRow}>
              {Array.from({length:8}).map((_,j)=><Skeleton key={j} height={14} width="70%" />)}
            </div>
          ))
        ) : (items?.length || 0) === 0 ? (
          <EmptyState icon={<UsersIcon size={26}/>} title="No customers found" description="Add your first customer to get started." />
        ) : (
          items?.map((c, i) => (
            <div key={c.id} className={styles.tableRow}>
              <div className={styles.customerCell}>
                <div
                  className={styles.avatar}
                  style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], cursor: 'pointer' }}
                  onClick={() => setDetailCustomer(c)}
                  title="View billing history"
                >
                  {getInitials(c.name)}
                </div>
                <div>
                  <p
                    className={styles.custName}
                    style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                    onClick={() => setDetailCustomer(c)}
                  >
                    {c.name}
                  </p>
                  <p className={styles.custEmail}>{c.email}</p>
                </div>
              </div>
              <span className={styles.planTag}>{c.company || '—'}</span>
              <span className={styles.mrr}>{c.phone || '—'}</span>
              <span className={styles.countryCell}>
                {c.country || 'India'}
                <span className={styles.currency}>{c.currency || 'INR'}</span>
              </span>
              <Badge status={c.status?.toLowerCase()} />
              <span className={styles.date}>{formatDate(c.joined)}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => setDetailCustomer(c)}
                  title="View billing history"
                  style={{ color: '#D4A800' }}
                >
                  👁
                </button>
                <button className={styles.deleteBtn} onClick={() => setDeleteTarget(c)} title="Remove customer">
                  <TrashIcon size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* ── Customer Detail Modal (Billing Timeline + Activity Summary + Sub History) ── */}
      {detailCustomer && (
        <CustomerDetailModal
          customer={detailCustomer}
          onClose={() => setDetailCustomer(null)}
        />
      )}

      {/* ── Add Customer Modal ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Customer"
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleAddCustomer}>Add Customer</Button>
          </>
        }
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full Name *</label>
              <input style={inp} value={form.name} onChange={e=>setField('name',e.target.value)} placeholder="Jane Doe" />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e=>setField('email',e.target.value)} placeholder="jane@company.com" />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Company</label>
              <input style={inp} value={form.company} onChange={e=>setField('company',e.target.value)} placeholder="Acme Inc." />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Phone</label>
              <input style={inp} value={form.phone} onChange={e=>setField('phone',e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Address</label>
            <input style={inp} value={form.address} onChange={e=>setField('address',e.target.value)} placeholder="123 Main Street, City" />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Country</label>
              <select style={inp} value={form.country} onChange={e=>setField('country',e.target.value)}>
                {Object.keys(COUNTRY_CURRENCY_MAP).map(c=>(
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Currency (auto)</label>
              <input style={{...inp, background:'rgba(var(--color-primary-rgb),0.04)', color:'var(--color-text-secondary)'}} value={form.currency} readOnly />
            </div>
          </div>
          <div style={{ background:'rgba(var(--color-primary-rgb),0.05)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--color-text-secondary)', borderLeft:'3px solid var(--color-primary)' }}>
            Tax will be auto-calculated based on country: <strong>India → GST 18%</strong>, USA → Sales Tax 10%, UK → VAT 20%, UAE → VAT 5%, etc.
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Customer"
        width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Remove</Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Remove <strong>{deleteTarget?.name}</strong> from your customer list?
        </p>
      </Modal>
    </div>
  )
}
